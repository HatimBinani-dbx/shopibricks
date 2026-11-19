"""Provision the ShopiBricks analytics assets in the showcase workspace, so the second deployment is self-contained.

Creates, in <CATALOG>.<SCHEMA> (idempotent, safe to rerun):
  - the UC products and customers tables and the streaming volume,
  - the bundle resources (Lakeflow pipeline, bounded event emitter job, refresh job, AI/BI dashboard),
  - the commerce_metrics metric view, once the pipeline has produced gold_commerce_daily,
  - a Vector Search index on products, and the merchant Genie space,
then prints the app env and resources to wire in (and writes them to resources/showcase.provisioned.json, git-ignored).

Reads PROFILE, APP, CATALOG, SCHEMA and optional VS_ENDPOINT (default shopibricks-ug) from scripts/showcase.local.env.
The reference deployment is never touched: everything is staged in a temporary bundle with its own target.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROFILE, APP = os.environ.get("PROFILE", ""), os.environ.get("APP", "")
CATALOG, SCHEMA = os.environ.get("CATALOG", ""), os.environ.get("SCHEMA", "")
VS_ENDPOINT = os.environ.get("VS_ENDPOINT", "shopibricks-ug")
REF_CATALOG, REF_SCHEMA = "serverless_stable_vwywqi_catalog", "shopibricks_laurent"
OUT = ROOT / "resources/showcase.provisioned.json"


def run(*cmd, payload=None, check=True, cwd=None):
    cmd = list(cmd) + (["--json", json.dumps(payload)] if payload is not None else [])
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)
    if check and r.returncode:
        raise RuntimeError(f"{' '.join(cmd[:4])}: {r.stderr.strip()[-1500:]}")
    return r


def cli(*args, payload=None, check=True):
    r = run("databricks", *args, "--profile", PROFILE, "-o", "json", payload=payload, check=check)
    return json.loads(r.stdout) if r.returncode == 0 and r.stdout.strip() else {}


def sql(statement, warehouse):
    res = cli("api", "post", "/api/2.0/sql/statements", payload={"warehouse_id": warehouse, "statement": statement, "wait_timeout": "50s"})
    while res["status"]["state"] in ("PENDING", "RUNNING"):
        time.sleep(2)
        res = cli("api", "get", f"/api/2.0/sql/statements/{res['statement_id']}")
    if res["status"]["state"] != "SUCCEEDED":
        raise RuntimeError(json.dumps(res["status"])[:800])
    return res.get("result", {}).get("data_array") or []


def retarget(text):
    return text.replace(f"{REF_CATALOG}.{REF_SCHEMA}", f"{CATALOG}.{SCHEMA}").replace(REF_CATALOG, CATALOG).replace(REF_SCHEMA, SCHEMA)


def log(msg):
    print(msg, flush=True)


def bootstrap(warehouse):
    sql(f"CREATE SCHEMA IF NOT EXISTS {CATALOG}.{SCHEMA}", warehouse)
    sql(f"CREATE VOLUME IF NOT EXISTS {CATALOG}.{SCHEMA}.streaming", warehouse)
    sql(f"CREATE TABLE IF NOT EXISTS {CATALOG}.{SCHEMA}.products (id STRING, name STRING, category STRING, description STRING, price_cents INT, currency STRING, stock INT, tags ARRAY<STRING>, content STRING) USING DELTA TBLPROPERTIES ('delta.enableChangeDataFeed'='true')", warehouse)
    q = lambda v: "'" + str(v).replace("'", "''") + "'"
    products = json.loads((ROOT / "data/products.json").read_text())
    rows = ["(" + ",".join([*(q(p[k]) for k in ("id", "name", "category", "description")), str(p["price_cents"]), q("eur"), str(p["stock"]), "array(" + ",".join(q(t) for t in p["tags"]) + ")", q(" ".join([p["name"], p["description"], *p["tags"]]))]) + ")" for p in products]
    sql(f"MERGE INTO {CATALOG}.{SCHEMA}.products t USING (SELECT * FROM VALUES {','.join(rows)} AS p(id,name,category,description,price_cents,currency,stock,tags,content)) s ON t.id=s.id WHEN NOT MATCHED THEN INSERT *", warehouse)
    sql(f"CREATE TABLE IF NOT EXISTS {CATALOG}.{SCHEMA}.customers AS SELECT concat('customer-',id) customer_id, CASE WHEN id % 10 < 6 THEN 'Paris' WHEN id % 10 < 8 THEN 'Lyon' ELSE 'Bordeaux' END city, CASE WHEN id % 5=0 THEN 'loyalty' ELSE 'discovery' END segment, true is_synthetic FROM range(2500)", warehouse)
    return f"{len(products)} products, 2500 customers"


def bundle(host, user, warehouse):
    stage = Path(tempfile.mkdtemp())
    try:
        (stage / "resources").mkdir()
        for f in ("commerce.pipeline.yml", "stream.job.yml", "refresh.job.yml", "commerce.dashboard.yml", "commerce.lvdash.json"):
            shutil.copy(ROOT / "resources" / f, stage / "resources" / f)
        shutil.copytree(ROOT / "data", stage / "data")
        (stage / "databricks.yml").write_text(f"""bundle:
  name: {APP}-analytics
include:
  - resources/*.yml
variables:
  catalog:
    default: {CATALOG}
  schema:
    default: {SCHEMA}
  warehouse_id:
    default: {warehouse}
targets:
  showcase:
    default: true
    mode: production
    workspace:
      host: {host}
      profile: {PROFILE}
      root_path: /Workspace/Users/{user}/.bundle/{APP}-analytics
    permissions:
      - user_name: {user}
        level: CAN_MANAGE
""")
        run("databricks", "bundle", "deploy", "-t", "showcase", "--profile", PROFILE, cwd=stage)
        summary = json.loads(run("databricks", "bundle", "summary", "-t", "showcase", "--profile", PROFILE, "-o", "json", cwd=stage).stdout)
        res = summary["resources"]
        return {"pipeline_id": res["pipelines"]["commerce"]["id"], "stream_job_id": res["jobs"]["stream"]["id"], "refresh_job_id": res["jobs"]["refresh"]["id"], "dashboard_id": res["dashboards"]["commerce_dashboard"]["id"]}
    finally:
        shutil.rmtree(stage, ignore_errors=True)


def run_stream(job_id, history_rows, minutes):
    run_id = cli("jobs", "run-now", "--no-wait", payload={"job_id": int(job_id), "job_parameters": {"history_rows": str(history_rows), "minutes": str(minutes)}})["run_id"]
    for _ in range(240):
        r = cli("jobs", "get-run", str(run_id))
        state = r["state"]
        if state.get("life_cycle_state") in ("TERMINATED", "INTERNAL_ERROR", "SKIPPED"):
            if state.get("result_state") != "SUCCESS":
                raise RuntimeError(f"stream job run {run_id}: {state}")
            return run_id
        time.sleep(10)
    raise TimeoutError(f"stream job run {run_id} still running")


def wait_pipeline(pipeline_id):
    for _ in range(120):
        p = cli("pipelines", "get", pipeline_id)
        latest = (p.get("latest_updates") or [{}])[0]
        if latest.get("state") in ("COMPLETED", "FAILED", "CANCELED") and p.get("state") != "RUNNING":
            if latest["state"] != "COMPLETED":
                raise RuntimeError(f"pipeline update {latest}")
            return latest.get("update_id")
        time.sleep(10)
    raise TimeoutError("pipeline still running")


def vector_index():
    spec = json.loads(retarget((ROOT / "resources/product-index.json").read_text()))
    spec["endpoint_name"] = VS_ENDPOINT
    name = spec["name"]
    existing = cli("vector-search-indexes", "get-index", name, check=False)
    if not existing:
        cli("vector-search-indexes", "create-index", payload=spec)
    else:
        cli("vector-search-indexes", "sync-index", name, check=False)
    return name


def genie(warehouse, user):
    spec = json.loads((ROOT / "resources/genie.json").read_text())
    spec["warehouse_id"] = warehouse
    spec["parent_path"] = f"/Workspace/Users/{user}"
    spec["serialized_space"] = retarget(spec["serialized_space"])
    spaces = cli("api", "get", "/api/2.0/genie/spaces").get("spaces", [])
    mine = next((s for s in spaces if s.get("title") == spec["title"]), None)
    if mine:
        cli("api", "patch", f"/api/2.0/genie/spaces/{mine['space_id']}", payload={k: spec[k] for k in ("title", "description", "warehouse_id", "serialized_space")})
        return mine["space_id"]
    return cli("api", "post", "/api/2.0/genie/spaces", payload=spec)["space_id"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--history-rows", type=int, default=20000, help="historical events generated on the first run")
    ap.add_argument("--skip-data", action="store_true", help="do not run the event emitter")
    a = ap.parse_args()
    if not all([PROFILE, APP, CATALOG, SCHEMA]):
        sys.exit("Set PROFILE, APP, CATALOG and SCHEMA (scripts/showcase.local.env)")
    host = cli("auth", "env")["env"]["DATABRICKS_HOST"].rstrip("/")
    user = cli("current-user", "me")["userName"]
    app = cli("apps", "get", APP)
    warehouse = next(r["sql_warehouse"]["id"] for r in app["resources"] if r.get("sql_warehouse"))
    sp = app.get("service_principal_client_id")
    state = json.loads(OUT.read_text()) if OUT.exists() else {}

    log("1/7 Unity Catalog tables and volume…"); log("   " + bootstrap(warehouse))
    log("2/7 Bundle: pipeline, jobs, dashboard…"); state.update(bundle(host, user, warehouse)); log("   " + json.dumps(state))
    if not a.skip_data:
        log(f"3/7 Event emitter ({a.history_rows} historical events) and pipeline update…")
        run_stream(state["stream_job_id"], a.history_rows, 1)
        wait_pipeline(state["pipeline_id"])
        log("   " + ", ".join(f"{t} {sql(f'SELECT count(*) FROM {CATALOG}.{SCHEMA}.{t}', warehouse)[0][0]}" for t in ("silver_events", "gold_commerce_daily", "gold_product_demand")))
    log("4/7 Metric view commerce_metrics…"); sql(retarget((ROOT / "data/commerce_metrics.sql").read_text()), warehouse)
    log("5/7 Vector Search index…"); state["vector_index"] = vector_index(); log("   " + state["vector_index"])
    log("6/7 Genie space…"); state["genie_space_id"] = genie(warehouse, user); log("   " + state["genie_space_id"])
    log("7/7 App service principal grants…")
    if sp:
        sql(f"GRANT USE CATALOG ON CATALOG {CATALOG} TO `{sp}`", warehouse)
        sql(f"GRANT USE SCHEMA, SELECT ON SCHEMA {CATALOG}.{SCHEMA} TO `{sp}`", warehouse)
        cli("permissions", "update", "genie", state["genie_space_id"], payload={"access_control_list": [{"service_principal_name": sp, "permission_level": "CAN_RUN"}]}, check=False)
    OUT.write_text(json.dumps(state, indent=2))
    log(f"\nDone. Wrote {OUT.relative_to(ROOT)}. Dashboard: {host}/dashboardsv3/{state['dashboard_id']}")


if __name__ == "__main__":
    main()
