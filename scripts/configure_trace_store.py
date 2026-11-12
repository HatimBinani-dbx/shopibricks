"""Run with app/.venv/bin/python -P scripts/configure_trace_store.py."""
import json
import os
import subprocess
from pathlib import Path

os.environ["DATABRICKS_CONFIG_PROFILE"] = "fevm"
os.environ["MLFLOW_TRACING_SQL_WAREHOUSE_ID"] = "05f329bec7bdb08b"

import mlflow
from mlflow.entities import UnityCatalog

mlflow.set_tracking_uri("databricks")
experiment = mlflow.set_experiment(
    experiment_name="/Shared/ShopiBricks-Paris-UC-Traces",
    trace_location=UnityCatalog(
        catalog_name="serverless_stable_vwywqi_catalog",
        schema_name="shopibricks_laurent",
        table_prefix="agent_traces",
    ),
)
result = {
    "experiment_id": experiment.experiment_id,
    "name": experiment.name,
    "trace_location": experiment.trace_location.to_dict(),
}
# Existing experiment metadata omits the annotations name in MLflow 3.18;
# retain the exact table name returned by initial provisioning.
result["trace_location"].setdefault(
    "annotations_table_name",
    "serverless_stable_vwywqi_catalog.shopibricks_laurent.agent_traces_otel_annotations",
)
for key in ("otel_spans_table_name", "otel_logs_table_name", "annotations_table_name"):
    table = result["trace_location"][key]
    subprocess.run([
        "databricks", "grants", "update", "table", table, "--profile", "fevm",
        "--json", json.dumps({"changes": [{
            "principal": "9c5e32a5-bf3f-4ec5-9544-7cbc2212ab5a",
            "add": ["MODIFY", "SELECT"],
        }]}),
    ], check=True, capture_output=True, text=True)
(Path(__file__).resolve().parents[1] / "docs/trace-store.json").write_text(
    json.dumps(result, indent=2) + "\n"
)
print(json.dumps(result, indent=2))
