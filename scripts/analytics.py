"""Build and verify the governed demo analytics. Uses CLI-managed OAuth."""
import json
from pathlib import Path
from platform import ROOT, CATALOG, SCHEMA, WAREHOUSE, cli, sql

NS = f"{CATALOG}.{SCHEMA}"
SOURCES = {
    "daily": "SELECT event_date, SUM(revenue_cents)/100.0 AS revenue_eur, SUM(purchases) AS purchases, SUM(stockouts) AS stockouts FROM gold_commerce_daily GROUP BY event_date ORDER BY event_date",
    "channels": "SELECT channel, SUM(revenue_cents)/100.0 AS revenue_eur, SUM(purchases) AS purchases FROM gold_commerce_daily GROUP BY channel ORDER BY revenue_eur DESC",
    "demand": "SELECT name, category, SUM(purchases) AS purchases, SUM(stockouts) AS stockouts, SUM(revenue_at_risk_cents)/100.0 AS revenue_at_risk_eur FROM gold_product_demand GROUP BY name,category ORDER BY revenue_at_risk_eur DESC",
}

def widget(name, kind, dataset, fields, encodings, x, y, width=6, height=5, title=None, aggregate=False):
    return {"widget": {"name": name, "queries": [{"name": "main_query", "query": {
        "datasetName": dataset, "fields": [{"name": n, "expression": e} for n,e in fields], "disaggregated": not aggregate}}],
        "spec": {"version": 2 if kind in ("counter","table") else 3, "widgetType": kind,
                 "encodings": encodings, "frame": {"showTitle": True, "title": title or name}}},
        "position": {"x": x, "y": y, "width": width, "height": height}}

def dashboard():
    layout = [{"widget": {"name": "title", "multilineTextboxSpec": {"lines": ["# ShopiBricks · Commerce intelligence"]}}, "position": {"x":0,"y":0,"width":12,"height":1}},
              {"widget": {"name": "subtitle", "multilineTextboxSpec": {"lines": ["Synthetic traffic · EUR including VAT · Auto Loader → Lakeflow → Unity Catalog. Stockout exposure is a scenario estimate, not lost booked revenue."]}}, "position": {"x":0,"y":1,"width":12,"height":2}}]
    for i,(field,title) in enumerate([("revenue_eur","Synthetic revenue · EUR"),("purchases","Synthetic purchase events"),("stockouts","Stockout events")]):
        key=f"sum({field})"
        value={"fieldName":key,"displayName":title,"format":{"type":"number-currency" if i==0 else "number","abbreviation":"compact","decimalPlaces":{"type":"max","places":1}}}
        if i==0: value["format"]["currencyCode"]="EUR"
        layout.append(widget(f"kpi-{field}","counter","daily",[(key,f"SUM(`{field}`)"),("day",'DATE_TRUNC("DAY", `event_date`)')],{"value":value,"period":{"fieldName":"day"}},i*4,3,4,3,title,True))
    layout.append(widget("revenue-trend","line","daily",[("event_date","`event_date`"),("revenue_eur","`revenue_eur`")],{"x":{"fieldName":"event_date","scale":{"type":"temporal"}},"y":{"fieldName":"revenue_eur","scale":{"type":"quantitative"},"displayName":"EUR"}},0,6,title="Synthetic daily revenue"))
    layout.append(widget("stockout-trend","line","daily",[("event_date","`event_date`"),("stockouts","`stockouts`")],{"x":{"fieldName":"event_date","scale":{"type":"temporal"}},"y":{"fieldName":"stockouts","scale":{"type":"quantitative"}}},6,6,title="The campaign creates a stockout spike"))
    fields=[("name","Product"),("category","Category"),("purchases","Purchases"),("stockouts","Stockouts"),("revenue_at_risk_eur","Exposure EUR")]
    layout.append(widget("product-demand","table","demand",[(n,f"`{n}`") for n,_ in fields],{"columns":[{"fieldName":n,"displayName":d} for n,d in fields]},0,11,12,6,"Product availability exposure"))
    return {"datasets":[{"name":n,"displayName":n.title(),"queryLines":[q]} for n,q in SOURCES.items()],"pages":[{"name":"commerce","displayName":"Commerce","pageType":"PAGE_TYPE_CANVAS","layoutVersion":"GRID_V1","layout":layout}]}

def main():
    sql((ROOT/"data/commerce_metrics.sql").read_text())
    proof={}
    for name,query in SOURCES.items():
        qualified=query.replace("FROM gold_",f"FROM {NS}.gold_")
        result=sql(qualified)
        proof[name]={"status":result["status"]["state"],"rows":result.get("manifest",{}).get("total_row_count"),"preview":result.get("result",{}).get("data_array",[])[:3]}
    metric_query=f"SELECT City, MEASURE(`Revenue EUR`) AS revenue_eur, MEASURE(Stockouts) AS stockouts FROM {NS}.commerce_metrics GROUP BY City ORDER BY revenue_eur DESC"
    proof["metrics"]=sql(metric_query).get("result",{})
    (ROOT/"docs/analytics-validation.json").write_text(json.dumps(proof,indent=2))
    (ROOT/"resources/commerce.lvdash.json").write_text(json.dumps(dashboard(),indent=2))
    namespace=f"{CATALOG}.{SCHEMA}"
    space={"version":2,"data_sources":{"metric_views":[{"identifier":namespace+".commerce_metrics","column_configs":[
        {"column_name":"Channel","enable_format_assistance":True,"enable_entity_matching":True},
        {"column_name":"City","enable_format_assistance":True,"enable_entity_matching":True}]}],
        "tables":[{"identifier":namespace+".gold_product_demand","column_configs":[
            {"column_name":"name","description":["Fictional retail product name. Table grain is product × city × channel. Aggregate SUM across city/channel for product-level answers."],"enable_entity_matching":True},
            {"column_name":"revenue_at_risk_cents","description":["Scenario stockout count times product price in cents. Opportunity exposure, not booked revenue loss."]}]}]},
        "config":{"sample_questions":[{"id":f"{i:032x}","question":[q]} for i,q in enumerate(["Which products have the highest stockout exposure?","Compare synthetic revenue by city.","How does agent traffic compare to web traffic?"],1)]},
        "instructions":{"text_instructions":[{"id":"30000000000000000000000000000001","content":["All traffic and customer data in this demo are synthetic. Explain that scope. Do not infer causality from aggregate correlations. Distinguish simulated purchase events from sandbox ACP orders. Always state monetary units, period and freshness. gold_product_demand has multiple rows per product: one per city and channel. For highest product stockout exposure, GROUP BY product_id,name and SUM(revenue_at_risk_cents) before ranking. Never rank individual city/channel rows as total product exposure."]}],
        "example_question_sqls":[{"id":"20000000000000000000000000000001","question":["Compare revenue and stockouts by city"],"sql":[metric_query]},
            {"id":"20000000000000000000000000000002","question":["Which product has the highest stockout exposure?"],"sql":[f"SELECT product_id, name, SUM(revenue_at_risk_cents)/100.0 AS synthetic_exposure_eur, SUM(stockouts) AS stockout_events, MAX(latest_event_at) AS freshness FROM {namespace}.gold_product_demand GROUP BY product_id,name ORDER BY synthetic_exposure_eur DESC LIMIT 1"]}]}}
    payload={"title":"ShopiBricks · Merchant Intelligence","description":"Analyze the synthetic Paris commerce funnel, agent versus web channels, and product stockout exposure using governed metrics. This agent does not place orders or claim real revenue.","warehouse_id":WAREHOUSE,"parent_path":"/Workspace/Users/laurent.fabre@databricks.com","serialized_space":json.dumps(space)}
    (ROOT/"resources/genie.json").write_text(json.dumps(payload,indent=2))
    inventory=json.loads((ROOT/"docs/deployment.json").read_text())
    if inventory.get("genie_space_id"):
        genie=cli("genie","update-space",inventory["genie_space_id"],payload=payload)
    else:
        genie=cli("genie","create-space",payload=payload)
        inventory["genie_space_id"]=genie.get("space_id") or genie.get("id")
    (ROOT/"docs/deployment.json").write_text(json.dumps(inventory,indent=2))
    print(json.dumps({"queries":proof,"genie_space_id":inventory["genie_space_id"]},indent=2))

if __name__=="__main__": main()
