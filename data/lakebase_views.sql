CREATE OR REPLACE VIEW serverless_stable_vwywqi_catalog.shopibricks_laurent.current_orders
COMMENT 'Current sandbox ACP orders from native Lakebase CDC. No real payment has been charged.'
AS SELECT id,checkout_id,total_cents,status,items,created_at,_timestamp AS replicated_at
FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY id ORDER BY _sort_by DESC) AS rn
  FROM serverless_stable_vwywqi_catalog.shopibricks_laurent.lb_orders_history
  WHERE _pg_change_type IN ('insert','update_postimage','delete')
) WHERE rn=1 AND _pg_change_type <> 'delete';
