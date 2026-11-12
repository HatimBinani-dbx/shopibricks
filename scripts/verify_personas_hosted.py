"""Verify the selected FEVM deployment with native SDK OAuth. No tokens are handled."""
import hashlib
import json
from pathlib import Path
import re
from datetime import datetime, timezone
from databricks.sdk import WorkspaceClient
from databricks.sdk.core import Config

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "tests/artifacts/atlas"
OUT.mkdir(parents=True, exist_ok=True)
APP = "https://shopibricks-paris-7474645565734606.aws.databricksapps.com"
client = WorkspaceClient(config=Config(profile="fevm", http_timeout_seconds=120, retry_timeout_seconds=15))
result = {"url": APP, "checked_at": datetime.now(timezone.utc).isoformat(), "checks": []}

def check(value, description):
    if not value:
        raise AssertionError(description)
    result["checks"].append(description)

def get(path):
    return client.api_client.do("GET", url=APP + path)

def raw(method, path, body=None):
    stream = client.api_client.do(method, url=APP + path, body=body, raw=True)["contents"]
    try:
        return stream.read()
    finally:
        stream.close()

try:
    health = get("/api/health")
    check(health["database"] == "connected", "Hosted Lakebase is connected")
    html = raw("GET", "/").decode()
    (OUT / "hosted-index.html").write_text(html)
    assets = re.findall(r'(?:src|href)="(/assets/[^\"]+)"', html)
    check(bool(assets), "Hosted page includes production assets")
    for asset in assets:
        data = raw("GET", asset)
        local = ROOT / "app/dist" / asset.lstrip("/")
        check(local.exists() and hashlib.sha256(data).digest() == hashlib.sha256(local.read_bytes()).digest(), f"Hosted asset matches validated build: {asset}")
    readiness = get("/api/catalog/readiness")
    check(readiness["total"] > 0 and readiness["ready"] == readiness["total"], "Hosted catalog completeness checks pass")
    result["readiness"] = {key: value for key, value in readiness.items() if key != "items"}
    feed = get("/api/catalog/feed")
    check(feed["sandbox"] and len(feed["products"]) == readiness["total"], "Hosted internal feed exports live catalog facts")
    atlas = get("/api/intelligence?source=examples")
    check(atlas["source"] == "examples" and atlas["summary"]["queries"] == 72, "Hosted atlas exposes 72 explicitly fictional example questions")
    check(sum(c["count"] for c in atlas["clusters"]) == 72 and len(atlas["clusters"]) == 6, "Hosted clustering assigns every query exactly once")
    check(all(m["id"] in {p["id"] for p in feed["products"]} for q in atlas["queries"] for m in q["matches"]), "Every hosted match resolves to a current catalog product")
    check(any(q["status"] == "uncovered" and "shoes" in q["text"] for q in atlas["queries"]), "Hosted atlas explains unsupported assortment demand")
    detailed = get("/api/intelligence?source=examples&clusters=4&profile=noor&channel=travel")
    check(detailed["summary"]["queries"] == 12 and all(q["profile"] == "noor" and q["channel"] == "travel" for q in detailed["queries"]), "Profile and experience filters apply server-side")
    check(len(detailed["clusters"]) <= 4, "Cluster detail control changes the server grouping")
    result["atlas_examples"] = atlas
    before = get("/api/insights?profile=noor&channel=travel")
    print("Hosted assets and endpoints verified; running Noor's creative recommendation…", flush=True)
    body = {"message": "Curate a city photography kit with a compact camera and something for capturing ideas. Use my profile budget, check current stock and render the complete kit. Do not prepare checkout.", "experience": {"persona": "shopper", "profile": "noor", "channel": "travel", "voice": "playful"}}
    stream = raw("POST", "/api/agent/run", body).decode()
    events = [json.loads(line[6:]) for line in stream.splitlines() if line.startswith("data: ")]
    result["events"] = events
    failures = [e for e in events if e["type"] == "RUN_ERROR"]
    check(not failures, f"Hosted agent completed without errors: {[e.get('message') for e in failures]}")
    cards = [e["value"] for e in events if e.get("name") == "shopibricks.ui" and e.get("value", {}).get("kind") == "products"]
    check(bool(cards) and any(e["type"] == "RUN_FINISHED" for e in events), "Hosted recommendation produced product cards and a finished run")
    check(all(card.get("total_cents", 999999) <= 30000 for card in cards), "Noor's default €300 budget is enforced on hosted recommendations")
    check(any(e.get("toolCallName") == "get_inventory" for e in events), "Hosted recommendation uses live inventory checks")
    check(any(e.get("name") == "shopibricks.context" and e["value"]["experience"] == body["experience"] and e["value"]["budget_cents"] == 30000 for e in events), "Hosted agent uses the selected profile, specialist experience, brand voice and budget")
    insights = get("/api/insights?profile=noor&channel=travel")
    check(insights["requests"] == before["requests"] + 1 and insights["recommended"] == before["recommended"] + 1, "Hosted intent insights include the actual new recommendation")
    recorded = get("/api/intelligence?source=activity&profile=noor&channel=travel")
    run_id = next(e["runId"] for e in events if e["type"] == "RUN_STARTED")
    captured = next((q for q in recorded["queries"] if q["id"] == run_id), None)
    check(recorded["source"] == "activity" and captured is not None, "Hosted live activity contains the actual new run")
    check(captured["text"] == body["message"] and captured["observed"]["recommended"], "Live atlas retains the exact question and observed recommendation outcome")
    check(all(not q["id"].startswith("example-") for q in recorded["queries"]), "Fictional examples never enter recorded activity")
    result["atlas_activity"] = recorded
    result["insights"] = insights
    result["selection"] = {"profile": "noor", "total_cents": cards[-1]["total_cents"], "products": [p["name"] for p in cards[-1]["products"]]}
    result["passed"] = True
except Exception as error:
    result["passed"] = False
    result["error"] = str(error)
    raise
finally:
    (OUT / "hosted-results.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"passed": result["passed"], "checks": len(result["checks"]), "selection": result.get("selection"), "error": result.get("error")}), flush=True)
