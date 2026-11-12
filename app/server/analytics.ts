import { gateway } from './gateway.js';
let cached:{value:unknown;at:number}|undefined;
function table(name:string){const catalog=process.env.SHOPIBRICKS_CATALOG||'';const schema=process.env.SHOPIBRICKS_SCHEMA||'';if(!/^[\w-]+$/.test(catalog)||!/^[\w-]+$/.test(schema))throw new Error('Unity Catalog analytics is not configured.');return `\`${catalog}\`.\`${schema}\`.\`${name}\``;}
export async function lakehouseMetrics(force=false){
 if(cached&&!force&&Date.now()-cached.at<30000)return cached.value;
 const sql=`SELECT city,channel,MIN(event_date) AS period_start,MAX(event_date) AS period_end,SUM(events) AS events,SUM(views) AS views,SUM(add_to_carts) AS add_to_carts,SUM(purchases) AS purchases,SUM(stockouts) AS stockouts,SUM(revenue_cents) AS revenue_cents,MAX(latest_event_at) AS latest_event_at FROM ${table('gold_commerce_daily')} GROUP BY city,channel ORDER BY events DESC`;
 const demandSql=`SELECT product_id,name,category,SUM(events) AS events,SUM(purchases) AS purchases,SUM(stockouts) AS stockouts,SUM(revenue_cents) AS revenue_cents,SUM(revenue_at_risk_cents) AS revenue_at_risk_cents,MAX(latest_event_at) AS latest_event_at FROM ${table('gold_product_demand')} GROUP BY product_id,name,category ORDER BY revenue_at_risk_cents DESC,events DESC`;
 const [daily,demand]=await Promise.all([gateway({action:'sql',statement:sql}),gateway({action:'sql',statement:demandSql})]);
 const value={daily:daily.rows,demand:demand.rows,sql,source:`${process.env.SHOPIBRICKS_CATALOG}.${process.env.SHOPIBRICKS_SCHEMA}.gold_commerce_daily`,queried_at:new Date().toISOString(),statement_id:daily.statement_id};
 cached={value,at:Date.now()};return value;
}
