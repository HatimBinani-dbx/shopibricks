CREATE OR REPLACE VIEW serverless_stable_vwywqi_catalog.shopibricks_laurent.commerce_metrics
WITH METRICS LANGUAGE YAML AS $$
version: 1.1
source: serverless_stable_vwywqi_catalog.shopibricks_laurent.gold_commerce_daily
comment: "Synthetic commerce funnel. Revenue includes VAT; purchases count event records, not unique checkout orders."
dimensions:
  - name: Event Date
    expr: event_date
    display_name: Event Date
    comment: UTC date of the synthetic commerce event.
  - name: City
    expr: city
    display_name: City
    comment: Synthetic customer city in France.
    synonyms: [location]
  - name: Channel
    expr: channel
    display_name: Channel
    comment: Agent-assisted or conventional web traffic in the synthetic generator.
measures:
  - name: Revenue EUR
    expr: SUM(revenue_cents) / 100.0
    display_name: Revenue EUR
    comment: Synthetic VAT-inclusive purchase-event revenue in euros.
    synonyms: [sales, revenue]
  - name: Purchases
    expr: SUM(purchases)
    display_name: Purchases
    comment: Number of validated synthetic purchase events; separate from Lakebase sandbox orders.
  - name: Product Views
    expr: SUM(views)
    display_name: Product Views
    comment: Number of product-view events.
  - name: Stockouts
    expr: SUM(stockouts)
    display_name: Stockouts
    comment: Number of simulated failed product availability checks.
  - name: Purchase to View Ratio
    expr: SUM(purchases) / NULLIF(SUM(views), 0)
    display_name: Purchase to View Ratio
    comment: Purchase-event count divided by view-event count; not session conversion.
$$
