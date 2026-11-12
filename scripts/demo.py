"""Bounded presentation controls. Credentials stay inside CLI-managed OAuth."""
import argparse
import json
from platform import ROOT, cli

parser = argparse.ArgumentParser()
parser.add_argument("action", choices=["start", "status", "stop"])
parser.add_argument("--minutes", type=int, default=60)
args = parser.parse_args()
config = json.loads((ROOT / "docs/deployment.json").read_text())
job = str(config["stream_job_id"])

def active_runs():
    result = cli("jobs", "list-runs", "--job-id", job, "--active-only")
    return result if isinstance(result, list) else result.get("runs", [])

if args.action == "start":
    if not 1 <= args.minutes <= 70:
        parser.error("--minutes must be between 1 and 70")
    active = active_runs()
    if active:
        print(json.dumps({"already_running": [r["run_id"] for r in active]}, indent=2))
    else:
        print(json.dumps(cli("jobs", "run-now", "--no-wait", payload={"job_id": int(job), "job_parameters": {"minutes": str(args.minutes), "history_rows": "0"}}), indent=2))
elif args.action == "stop":
    stopped = []
    for run in active_runs():
        cli("jobs", "cancel-run", str(run["run_id"]), "--no-wait")
        stopped.append(run["run_id"])
    print(json.dumps({"cancel_requested": stopped, "note": "An already-triggered Lakeflow update can finish independently. Use status to check it."}, indent=2))
else:
    pipeline = cli("pipelines", "get", config["pipeline_id"])
    app = cli("apps", "get", config["app_name"])
    print(json.dumps({"active_stream_runs": [{"run_id": r["run_id"], "state": r.get("state")} for r in active_runs()], "pipeline": {"state": pipeline.get("state"), "latest_updates": pipeline.get("latest_updates", [])[:2]}, "app": {"url": app.get("url"), "compute": app.get("compute_status"), "status": app.get("app_status")}}, indent=2))
