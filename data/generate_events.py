# Databricks notebook source
"""Bounded synthetic event emitter. Raw microbatches feed Auto Loader."""
import time
import uuid
from pyspark.sql import functions as F
from databricks.sdk import WorkspaceClient

dbutils.widgets.text("catalog", "serverless_stable_vwywqi_catalog")
dbutils.widgets.text("schema", "shopibricks_laurent")
dbutils.widgets.text("minutes", "3")
dbutils.widgets.text("history_rows", "0")
dbutils.widgets.text("pipeline_id", "")
catalog = dbutils.widgets.get("catalog")
schema = dbutils.widgets.get("schema")
minutes = max(1, min(70, int(dbutils.widgets.get("minutes"))))
history_rows = max(0, min(500000, int(dbutils.widgets.get("history_rows"))))
pipeline_id = dbutils.widgets.get("pipeline_id")
workspace = WorkspaceClient() if pipeline_id else None
last_update = None

def refresh(wait=False, start=True):
    global last_update
    if not workspace:
        return
    if last_update:
        state = workspace.pipelines.get_update(pipeline_id, last_update).update.state.value
        deadline = time.monotonic() + 420
        while wait and state not in ("COMPLETED", "FAILED", "CANCELED"):
            if time.monotonic() > deadline:
                raise TimeoutError("Lakeflow update exceeded 7 minutes")
            time.sleep(10)
            state = workspace.pipelines.get_update(pipeline_id, last_update).update.state.value
        if state in ("FAILED", "CANCELED"):
            raise RuntimeError(f"Lakeflow update {last_update} ended {state}")
        if state != "COMPLETED":
            return
    if start:
        last_update = workspace.pipelines.start_update(pipeline_id).update_id
        print(f"Incremental streaming refresh {last_update}")
run_id = str(uuid.uuid4())
root = f"/Volumes/{catalog}/{schema}/streaming/events"
products = spark.table(f"{catalog}.{schema}.products").select("id", "price_cents")
skus = ["sb-headphones", "sb-speaker", "sb-camera", "sb-tote", "sb-bottle", "sb-notebook", "sb-charger", "sb-watch", "sb-backpack", "sb-sunglasses", "sb-scarf", "sb-earbuds"]

def batch(rows, sequence, historical=False):
    base = spark.range(rows).withColumn("r", F.pmod(F.xxhash64("id", F.lit(sequence)), F.lit(1000)))
    # Non-uniform product demand: headphones and totes account for 55%.
    base = base.withColumn("product_id", F.when(F.col("r") < 350, "sb-headphones").when(F.col("r") < 550, "sb-tote").otherwise(F.element_at(F.array(*[F.lit(x) for x in skus]), (F.col("id") % 12 + 1).cast("int"))))
    if historical:
        base = base.withColumn("event_time", F.expr("current_timestamp() - make_interval(0, 0, 0, 0, 0, 0, cast(pmod(id * 17, 2592000) as decimal(18,6)))"))
    else:
        base = base.withColumn("event_time", F.current_timestamp())
    # A recent campaign produces extra stockout events on the hero product.
    surge = (F.col("product_id") == "sb-headphones") & (F.col("event_time") > F.current_timestamp() - F.expr("INTERVAL 2 DAY"))
    events = base.withColumn("event_type", F.when(surge & (F.col("r") % 10 < 3), "stockout").when(F.col("r") % 100 < 6, "purchase").when(F.col("r") % 100 < 27, "add_to_cart").otherwise("product_view"))
    events = events.join(products, events.product_id == products.id, "left").select(
        F.concat_ws("-", F.lit(run_id), F.lit(sequence), base.id.cast("string")).alias("event_id"),
        "event_time", "product_id", "event_type",
        F.concat(F.lit("customer-"), (base.id % 2500).cast("string")).alias("customer_id"),
        F.when(base.id % 10 < 6, "Paris").when(base.id % 10 < 8, "Lyon").otherwise("Bordeaux").alias("city"),
        F.when(base.id % 10 < 4, "agent").otherwise("web").alias("channel"),
        F.when(base.id % 97 == 0, -1).otherwise(1).cast("int").alias("quantity"),
        F.when(F.col("event_type") == "purchase", F.col("price_cents")).otherwise(0).cast("long").alias("revenue_cents"),
        F.lit(True).alias("is_synthetic"), F.lit(run_id).alias("run_id"),
        F.when(surge, "paris_weekend_campaign").otherwise("baseline").alias("scenario"))
    events.coalesce(2).write.mode("append").json(root)
    print(f"Emitted {rows} synthetic events: batch={sequence}, run={run_id}")

if history_rows:
    batch(history_rows, -1, historical=True)
    refresh()
deadline = time.monotonic() + minutes * 60
sequence = 0
while time.monotonic() < deadline:
    batch(240, sequence)
    refresh()
    sequence += 1
    time.sleep(15)
refresh(wait=True)
refresh(wait=True, start=False)
print(f"Bounded emitter finished. run={run_id}, live_batches={sequence}")
