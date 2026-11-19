"""Warm the showcase deployment before the talk (run 15 minutes before going on stage).

Starts the app and the SQL warehouse, puts the demo policies back to their talk defaults, sends one real request
through every demo so models, warehouse and caches are hot, and leaves recent rows in the usage and inference tables.
Prints a checklist at the end. It never touches the reference deployment.

  scripts/warmup-showcase.sh            # everything (about 4 minutes)
  scripts/warmup-showcase.sh --quick    # infrastructure, policies and SQL panels only (about 1 minute)

Reads PROFILE and APP from scripts/showcase.local.env (git-ignored). Optional: CONCIERGE_PRIMARY (default gpt-6-luna).
"""
import argparse
import json
import re
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

PROFILE = os.environ.get("PROFILE", "")
APP = os.environ.get("APP", "")
CONCIERGE_PRIMARY = os.environ.get("CONCIERGE_PRIMARY", "gpt-6-luna")
CONCIERGE_FALLBACK = os.environ.get("CONCIERGE_FALLBACK", "gpt-6-1-sol")
SPLIT = {"weights": [{"model": "gpt-6-luna", "pct": 50}, {"model": "gpt-6-1-terra", "pct": 50}], "fallback": ["gpt-6-1-sol"]}
results = []


def cli(*args):
    out = subprocess.run(["databricks", *args, "--profile", PROFILE, "-o", "json"], capture_output=True, text=True)
    if out.returncode:
        raise RuntimeError(out.stderr.strip()[:300])
    return json.loads(out.stdout or "{}")


TOKEN = {"value": "", "at": 0.0}


def token():
    if time.time() - TOKEN["at"] > 1800:
        TOKEN.update(value=cli("auth", "token")["access_token"], at=time.time())
    return TOKEN["value"]


def http(method, url, body=None, timeout=180):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"Authorization": f"Bearer {token()}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw and r.headers.get_content_type() == "application/json" else raw)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


def step(name, fn):
    t = time.time()
    print(f"… {name}", flush=True)
    try:
        detail = fn() or ""
        ok = True
    except Exception as e:  # keep warming the rest: one failing panel should not stop the others
        detail, ok = str(e)[:240], False
    results.append((ok, name, time.time() - t, detail))
    print(f"{'✓' if ok else '✗'} {name} · {time.time() - t:.1f} s · {detail}", flush=True)


def need(status, body, what):
    if status >= 300:
        raise RuntimeError(f"{what}: HTTP {status} {str(body)[:200]}")
    if isinstance(body, dict) and body.get("error"):
        raise RuntimeError(f"{what}: {str(body['error'])[:200]}")
    return body


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true", help="skip the model runs")
    a = ap.parse_args()
    if not PROFILE or not APP:
        sys.exit("Set PROFILE and APP (scripts/showcase.local.env)")
    host = cli("auth", "env")["env"]["DATABRICKS_HOST"].rstrip("/")
    app = cli("apps", "get", APP)
    url = app["url"].rstrip("/")
    warehouse = next((r["sql_warehouse"]["id"] for r in app.get("resources", []) if r.get("sql_warehouse")), None)
    api = lambda path: f"{url}{path}"
    ws = lambda path: f"{host}{path}"
    t0 = time.time()

    # ---------------------------------------------------------------- infrastructure
    def app_up():
        state = app.get("compute_status", {}).get("state")
        if state != "ACTIVE":
            cli("apps", "start", APP)
        for _ in range(60):
            s, b = http("GET", api("/api/health"), timeout=30)
            if s == 200 and isinstance(b, dict) and b.get("database") == "connected":
                return f"compute {state} · Lakebase connected"
            if s == 200 and isinstance(b, dict):
                raise RuntimeError(f"Lakebase {b.get('database')}: {b.get('error')}")
            time.sleep(5)
        raise RuntimeError("app did not answer /api/health in 5 min")

    def warehouse_up():
        if not warehouse:
            raise RuntimeError("no SQL warehouse resource on the app")
        w = cli("warehouses", "get", warehouse)
        if w.get("auto_stop_mins", 0) < 120:
            cli("warehouses", "edit", warehouse, "--auto-stop-mins", "120", "--no-wait")
        if w["state"] != "RUNNING":
            cli("warehouses", "start", warehouse, "--timeout", "10m")
        w = cli("warehouses", "get", warehouse)
        if w["state"] != "RUNNING" or w.get("auto_stop_mins", 0) < 120:
            raise RuntimeError(f"state {w['state']} · auto-stop {w.get('auto_stop_mins')} min")
        return f"RUNNING · auto-stop {w['auto_stop_mins']} min"

    step("App running", app_up)
    step("SQL warehouse running", warehouse_up)

    # ---------------------------------------------------------------- talk defaults
    overview = {}

    def read_overview():
        s, b = http("GET", api("/api/ug/overview?refresh=1"))
        overview.update(need(s, b, "overview"))
        return overview.get("service", "")

    def concierge_route():
        svc = overview.get("service")
        if not svc:
            raise RuntimeError("concierge service unknown")
        dest = lambda kind, m, pct=None: {"name": f"{kind}-{m}", "destination_type": "DESTINATION_TYPE_PAY_PER_TOKEN_FOUNDATION_MODEL", **({"traffic_percentage": pct} if pct else {}), "pay_per_token_config": {"model": f"models/system.ai.databricks-{m}"}}
        body = {"config": {"routing": {"destinations": [dest("primary", CONCIERGE_PRIMARY, 100)], "fallback": {"destinations": [dest("fallback", CONCIERGE_FALLBACK)]}}}}
        s, b = http("PATCH", ws(f"/api/2.1/unity-catalog/model-services/{svc}?update_mask=config.routing.destinations,config.routing.fallback.destinations"), body)
        need(s, b, "concierge routing")
        return f"{CONCIERGE_PRIMARY} primary · {CONCIERGE_FALLBACK} fallback"

    def split_reset():
        s, b = http("POST", api("/api/ug/split"), SPLIT)
        need(s, b, "routing policy")
        return " · ".join(f"{d['model']} {d['pct']}%" for d in b.get("destinations", [])) + f" · fallback {', '.join(b.get('fallback', []))}"

    step("Gateway overview", read_overview)
    step("Concierge route", concierge_route)
    step("Routing demo policy", split_reset)

    # ---------------------------------------------------------------- live runs (models, inference tables)
    if not a.quick:
        def split_send():
            s, b = http("POST", api("/api/ug/split/send"), {})
            rows = need(s, b, "split send")["rows"]
            ids = [r["request_id"] for r in rows if r.get("request_id")]
            served = {}
            for _ in range(20):
                time.sleep(2)
                s, b = http("GET", api(f"/api/ug/split/served?ids={','.join(ids)}"))
                served = b.get("served", {}) if s == 200 else served
                if len(served) >= len(ids):
                    break
            answered = sum(r["status"] < 300 for r in rows)
            if answered < len(rows) or len(served) < len(ids) or not ids:
                raise RuntimeError(f"{answered}/{len(rows)} answered, {len(served)}/{len(ids)} traced")
            counts = {}
            for m in served.values():
                counts[m] = counts.get(m, 0) + 1
            return f"{answered}/{len(rows)} answered · traced {len(served)} · " + ", ".join(f"{k} {v}" for k, v in counts.items())

        def tries():
            s, b = http("POST", api("/api/ug/try"), {"demo": "identity"})
            got = {r["label"]: r.get("status") for r in need(s, b, "identity").get("rows", [])}
            if got.get("Granted") != 200 or got.get("Not granted") not in (401, 403):
                raise RuntimeError(f"identity: expected 200 and 403, got {got}")
            s, b = http("POST", api("/api/ug/try"), {"demo": "limit"})
            limit = need(s, b, "rate limit").get("status")
            if limit not in (200, 429):
                raise RuntimeError(f"rate limit: unexpected status {limit}")
            return f"identity 200 / {got['Not granted']} · rate limit {limit}"

        def lab(scenario, runs, label, expect=None):
            def go():
                s, b = http("POST", api("/api/ug/lab"), {"scenario": scenario, "runs": runs}, timeout=240)
                rows = need(s, b, label)["rows"]
                bad = [r["model"] for r in rows if r.get("error")]
                if len(rows) != len(runs) or bad:
                    raise RuntimeError(f"{len(rows)}/{len(runs)} runs, errors on {bad}")
                if expect and not expect(rows):
                    raise RuntimeError("unexpected outcome: " + " · ".join(f"{r['model']} pass={r['pass']} guardrail={r.get('guardrail_fired')}" for r in rows))
                return " · ".join(f"{r['model']} {'pass' if r['pass'] else 'fail'}{' (guardrail)' if r.get('guardrail_fired') else ''} {r['latency_s']:.0f}s" for r in rows)
            return go

        def concierge():
            req = urllib.request.Request(api("/api/agent/run"), data=json.dumps({"message": "I need wireless headphones and a bag for a weekend in Paris, under 200 euros."}).encode(), method="POST", headers={"Authorization": f"Bearer {token()}", "Content-Type": "application/json"})
            kinds, models = {}, set()
            with urllib.request.urlopen(req, timeout=240) as r:
                for line in r:
                    line = line.decode().strip()
                    if not line.startswith("data:"):
                        continue
                    ev = json.loads(line[5:])
                    kinds[ev.get("type", "?")] = kinds.get(ev.get("type", "?"), 0) + 1
                    models.update(re.findall(r'"served_model":\s*"([^"]+)"', line))
            if kinds.get("RUN_ERROR") or not kinds.get("RUN_FINISHED") or not kinds.get("TEXT_MESSAGE_CONTENT"):
                raise RuntimeError(f"run did not finish cleanly: {kinds}")
            return f"{sum(kinds.values())} events · served {', '.join(sorted(models)) or 'n/a'}"

        step("Concierge run (AG-UI)", concierge)
        step("Routing demo: 12 requests", split_send)
        step("Identity and rate limit", tries)
        step("Model lab: 4 OpenAI models", lab("weekend", [{"model": m} for m in ("gpt-6-luna", "gpt-6-1-terra", "gpt-6-1-sol", "gpt-6-astra")], "lab", lambda rows: sum(r["pass"] for r in rows) >= 3))
        step("Guardrail story: attack", lab("injection", [{"model": m} for m in ("gpt-oss-120b", "gpt-6-luna", "gpt-6-1-terra", "gpt-6-1-sol")], "attack"))
        step("Guardrail story: guarded rerun", lab("injection", [{"model": "gpt-oss-120b", "guarded": True}], "guarded", lambda rows: rows[0].get("guardrail_fired") and rows[0]["pass"]))
        def pii():
            s, b = http("POST", api("/api/ug/try"), {"demo": "pii"})
            text = need(s, b, "pii").get("text") or ""
            if "[EMAIL_ADDRESS]" not in text and "[CREDIT_CARD]" not in text:
                raise RuntimeError(f"no masking in the answer: {text[:160]!r} (is the PII policy attached?)")
            return f"masked in {b.get('latency_ms', 0) / 1000:.1f} s"

        step("Guardrail: PII masking", pii)
        step("Routing demo policy (again)", split_reset)

    # ---------------------------------------------------------------- SQL-backed panels (warehouse and server caches)
    def panel(path, check=None):
        def go():
            s, b = http("GET", api(path), timeout=240)
            need(s, b, path)
            return check(b) if check else "ok"
        return go

    def rows_of(key):
        return lambda b: f"{len(b.get(key) or []) if isinstance(b.get(key), list) else b.get(key)} rows"

    panels = [
        ("Usage 24h", "/api/ug/usage?window=24h&refresh=1", rows_of("services")),
        ("Usage 1h", "/api/ug/usage?window=1h&refresh=1", rows_of("services")),
        ("Codex 7d", "/api/ug/codex?window=7d&refresh=1", rows_of("sessions")),
        ("Inference table (concierge)", "/api/ug/payloads?service=concierge", rows_of("rows")),
        ("Inference table (guarded)", "/api/ug/payloads?service=guarded", rows_of("rows")),
        ("Guardrail last denial", "/api/ug/guardrail", lambda b: (b.get("last_denial") or {}).get("event_time") or "none yet (ingestion can lag a few minutes)"),
        ("Model lab bench", "/api/ug/bench", lambda b: f"{len(b.get('models', []))} models"),
        ("Operations", "/api/operations", None),
        ("Lakehouse metrics", "/api/lakehouse?refresh=1", lambda b: f"{len(b.get('daily') or [])} city × channel rows, latest {max((r.get('latest_event_at') or '') for r in b.get('daily') or [{}])[:16]}"),
    ]
    with ThreadPoolExecutor(4) as pool:
        for name, path, check in panels:
            pool.submit(step, name, panel(path, check))

    ok = sum(r[0] for r in results)
    print(f"\n{ok}/{len(results)} checks passed in {time.time() - t0:.0f} s · {url}")
    for good, name, secs, detail in results:
        if not good:
            print(f"  ✗ {name}: {detail}")
    print("Presenter settings: Fallback mode off (live), anonymize on.")
    print("Usage and inference tables ingest with a few minutes of delay: run this 15 minutes before the talk.")
    sys.exit(0 if ok == len(results) else 1)


if __name__ == "__main__":
    main()
