from pyspark import pipelines as dp
from pyspark.sql import functions as F

CATALOG = spark.conf.get("shopibricks.catalog")
SCHEMA = spark.conf.get("shopibricks.schema")
EVENT_SCHEMA = "event_id STRING,event_time TIMESTAMP,product_id STRING,event_type STRING,customer_id STRING,city STRING,channel STRING,quantity INT,revenue_cents BIGINT,is_synthetic BOOLEAN,run_id STRING,scenario STRING"
VALID = "event_id IS NOT NULL AND product_id IS NOT NULL AND quantity > 0 AND revenue_cents >= 0 AND event_type IN ('product_view','add_to_cart','purchase','stockout')"

@dp.table(comment="Synthetic commerce event stream, ingested with Auto Loader from a UC volume")
def bronze_events():
    return spark.readStream.format("cloudFiles").option("cloudFiles.format", "json").schema(EVENT_SCHEMA).load(f"/Volumes/{CATALOG}/{SCHEMA}/streaming/events").withColumn("ingested_at", F.current_timestamp())

@dp.table(comment="Validated commerce events with event-time deduplication")
@dp.expect_or_drop("valid_commerce_event", VALID)
def silver_events():
    return spark.readStream.table("bronze_events").withWatermark("event_time", "35 days").dropDuplicatesWithinWatermark(["event_id"])

@dp.table(comment="Quarantined synthetic events, retained for quality review")
def quarantine_events():
    return spark.readStream.table("bronze_events").filter(f"NOT ({VALID})").withColumn("quality_reason", F.lit("Invalid quantity, identifiers or event type"))

@dp.materialized_view(comment="Daily commerce funnel by city and channel. Revenue is synthetic, VAT-inclusive EUR cents.")
def gold_commerce_daily():
    return spark.read.table("silver_events").groupBy(F.to_date("event_time").alias("event_date"), "city", "channel").agg(
        F.count("*").alias("events"), F.count_if(F.col("event_type") == 'product_view').alias("views"),
        F.count_if(F.col("event_type") == 'add_to_cart').alias("add_to_carts"), F.count_if(F.col("event_type") == 'purchase').alias("purchases"),
        F.count_if(F.col("event_type") == 'stockout').alias("stockouts"), F.sum("revenue_cents").alias("revenue_cents"), F.max("event_time").alias("latest_event_at"))

@dp.materialized_view(comment="Product-level demand and revenue at risk. Snapshot stock lives in products; transaction stock is authoritative in Lakebase.")
def gold_product_demand():
    events = spark.read.table("silver_events")
    demand = events.groupBy("product_id", "city", "channel").agg(F.count("*").alias("events"),
        F.count_if(F.col("event_type") == 'purchase').alias("purchases"), F.count_if(F.col("event_type") == 'stockout').alias("stockouts"),
        F.sum("revenue_cents").alias("revenue_cents"), F.max("event_time").alias("latest_event_at"))
    products = spark.read.table(f"{CATALOG}.{SCHEMA}.products").select(F.col("id").alias("product_id"), "name", "category", "price_cents")
    return demand.join(products, "product_id").withColumn("revenue_at_risk_cents", F.col("stockouts") * F.col("price_cents"))
