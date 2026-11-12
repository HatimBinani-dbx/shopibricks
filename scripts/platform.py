"""Deploy helpers. Authentication stays inside the Databricks CLI."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
HOST = "https://fevm-serverless-stable-vwywqi.cloud.databricks.com"
CATALOG = "serverless_stable_vwywqi_catalog"
SCHEMA = "shopibricks_laurent"
WAREHOUSE = "05f329bec7bdb08b"

def cli(*args, payload=None):
    cmd = ["databricks", *args, "--profile", "fevm", "-o", "json"]
    if payload is not None:
        cmd += ["--json", json.dumps(payload)]
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode:
        raise RuntimeError(result.stderr[-3000:])
    return json.loads(result.stdout) if result.stdout.strip() else {}

def sql(statement):
    result = cli("api", "post", "/api/2.0/sql/statements", payload={
        "warehouse_id": WAREHOUSE, "statement": statement, "wait_timeout": "30s"})
    deadline = time.monotonic() + 240
    while result["status"]["state"] in ("PENDING", "RUNNING"):
        if time.monotonic() > deadline:
            raise TimeoutError(result["statement_id"])
        time.sleep(2)
        result = cli("api", "get", "/api/2.0/sql/statements/" + result["statement_id"])
    if result["status"]["state"] != "SUCCEEDED":
        raise RuntimeError(json.dumps(result["status"]))
    return result

def bootstrap():
    sql(f"CREATE SCHEMA IF NOT EXISTS {CATALOG}.{SCHEMA} COMMENT 'ShopiBricks OpenAI Paris synthetic commerce demo'")
    sql(f"CREATE VOLUME IF NOT EXISTS {CATALOG}.{SCHEMA}.streaming")
    sql(f"CREATE TABLE IF NOT EXISTS {CATALOG}.{SCHEMA}.products (id STRING, name STRING, category STRING, description STRING, price_cents INT, currency STRING, stock INT, tags ARRAY<STRING>, content STRING) USING DELTA TBLPROPERTIES ('delta.enableChangeDataFeed'='true')")
    products = json.loads((ROOT / "data/products.json").read_text())
    def quote(value):
        return "'" + str(value).replace("'", "''") + "'"
    rows = []
    for p in products:
        content = " ".join([p["name"], p["description"], *p["tags"]])
        values = [quote(p[k]) for k in ("id", "name", "category", "description")]
        values += [str(p["price_cents"]), quote("eur"), str(p["stock"]), "array(" + ",".join(quote(t) for t in p["tags"]) + ")", quote(content)]
        rows.append("(" + ",".join(values) + ")")
    sql(f"MERGE INTO {CATALOG}.{SCHEMA}.products t USING (SELECT * FROM VALUES " + ",".join(rows) + " AS p(id,name,category,description,price_cents,currency,stock,tags,content)) s ON t.id=s.id WHEN NOT MATCHED THEN INSERT *")
    sql(f"CREATE TABLE IF NOT EXISTS {CATALOG}.{SCHEMA}.customers AS SELECT concat('customer-',id) customer_id, CASE WHEN id % 10 < 6 THEN 'Paris' WHEN id % 10 < 8 THEN 'Lyon' ELSE 'Bordeaux' END city, CASE WHEN id % 5=0 THEN 'loyalty' ELSE 'discovery' END segment, true is_synthetic FROM range(2500)")
    print(json.dumps({"schema": f"{CATALOG}.{SCHEMA}", "products": len(products), "customers": 2500}))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["bootstrap", "sql", "inspect", "finish"])
    parser.add_argument("--statement")
    args = parser.parse_args()
    if args.command == "bootstrap":
        bootstrap()
    elif args.command == "sql":
        result = sql(args.statement)
        print(json.dumps(result, indent=2))
    elif args.command == "finish":
        inventory=json.loads((ROOT/"docs/deployment.json").read_text())
        sql((ROOT/"data/lakebase_views.sql").read_text())
        principal="9c5e32a5-bf3f-4ec5-9544-7cbc2212ab5a"
        sql(f"GRANT USE CATALOG ON CATALOG {CATALOG} TO `{principal}`")
        sql(f"GRANT USE SCHEMA, SELECT ON SCHEMA {CATALOG}.{SCHEMA} TO `{principal}`")
        app=cli("apps","get","shopibricks-paris")
        resources=app["resources"]
        for resource in resources:
            if "uc_securable" in resource:
                resource["uc_securable"].pop("securable_kind",None)
        resources=[r for r in resources if r["name"]!="genie-space"]
        resources.append({"name":"genie-space","genie_space":{"space_id":inventory["genie_space_id"],"permission":"CAN_RUN"}})
        payload={"name":app["name"],"description":app.get("description", "ShopiBricks · OpenAI Paris"),"resources":resources}
        (ROOT/"resources/app-update.json").write_text(json.dumps(payload,indent=2))
        inventory.update({"app_service_principal":principal,"app_url":app["url"],"dashboard_id":"01f1da3c06ef14dda98059288ee88ad5"})
        (ROOT/"docs/deployment.json").write_text(json.dumps(inventory,indent=2))
        print("CDC current-orders view created; app granted catalog/schema query access; resource update prepared.")
    else:
        for command in [("vector-search-endpoints", "list-endpoints"), ("postgres", "get-project", "projects/shopibricks-paris")]:
            print(json.dumps(cli(*command), indent=2))
