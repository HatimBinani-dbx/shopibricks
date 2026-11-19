import React,{useMemo,useState} from 'react';
import {ArrowUpRight,X} from 'lucide-react';

type NodeId='shopper'|'chatgpt'|'merchant'|'developer'|'agui'|'concierge'|'catalog'|'inventory'|'checkout'|'analyst'|'mcp'|'acp'|'skills'|'gateway'|'luna'|'sol'|'catalogai'|'lakebase'|'vector'|'genie'|'lakeflow'|'uc'|'mlflow'|'inference'|'usage'|'app';
type N={id:NodeId;x:number;y:number;w:number;h:number;title:string;sub?:string;kind:'channel'|'agent'|'protocol'|'gateway'|'model'|'data'|'obs'|'group'};
type E={id:string;from:NodeId;to:NodeId;dashed?:boolean;curve?:'right'|'bus'|'side'|'under';lane?:number;y?:number;label?:string};
type Detail={what:string;here:string[];where?:string;tag?:string};

const NODES:N[]=[
 {id:'app',x:226,y:26,w:306,h:292,title:'ShopiBricks · Databricks App',kind:'group'},
 {id:'shopper',x:20,y:56,w:170,h:52,title:'Storefront',sub:'React · AG-UI events',kind:'channel'},
 {id:'merchant',x:20,y:166,w:170,h:52,title:'Merchant studio',sub:'Growth & operations',kind:'channel'},
 {id:'chatgpt',x:20,y:336,w:170,h:52,title:'ChatGPT',sub:'Agentic checkout (sandbox)',kind:'channel'},
 {id:'developer',x:20,y:426,w:170,h:52,title:'Developers',sub:'Codex in the terminal',kind:'channel'},
 {id:'agui',x:246,y:58,w:266,h:44,title:'AG-UI stream',sub:'SSE · typed UI events',kind:'protocol'},
 {id:'concierge',x:246,y:124,w:266,h:50,title:'Concierge supervisor',sub:'OpenAI Responses API · delegates to specialists',kind:'agent'},
 {id:'catalog',x:246,y:196,w:128,h:42,title:'Catalog agent',kind:'agent'},
 {id:'inventory',x:384,y:196,w:128,h:42,title:'Inventory agent',kind:'agent'},
 {id:'checkout',x:246,y:248,w:128,h:42,title:'Checkout agent',kind:'agent'},
 {id:'analyst',x:384,y:248,w:128,h:42,title:'Merchant analyst',kind:'agent'},
  {id:'gateway',x:578,y:96,w:168,h:300,title:'Unity Gateway',sub:'One control plane',kind:'gateway'},
 {id:'luna',x:792,y:100,w:168,h:44,title:'GPT-6 Luna',sub:'Concierge · primary',kind:'model'},
 {id:'sol',x:792,y:152,w:168,h:44,title:'GPT-6.1 Sol',sub:'Fallback · Codex',kind:'model'},
 {id:'catalogai',x:792,y:204,w:168,h:44,title:'system.ai',sub:'58 governed model services',kind:'model'},
 {id:'mcp',x:792,y:256,w:168,h:44,title:'MCP services',sub:'Commerce tools · /mcp',kind:'protocol'},
 {id:'acp',x:792,y:308,w:168,h:44,title:'ACP merchant API',sub:'/checkout_sessions',kind:'protocol'},
 {id:'skills',x:792,y:360,w:168,h:44,title:'Skills',sub:'Shared in Unity Catalog · Beta',kind:'protocol'},
 {id:'lakebase',x:1008,y:40,w:172,h:50,title:'Lakebase',sub:'Products · carts · orders',kind:'data'},
 {id:'vector',x:1008,y:114,w:172,h:50,title:'Vector Search',sub:'Semantic catalog',kind:'data'},
 {id:'genie',x:1008,y:188,w:172,h:50,title:'Genie',sub:'Governed business Q&A',kind:'data'},
 {id:'lakeflow',x:1008,y:262,w:172,h:50,title:'Lakeflow + Delta',sub:'Streaming gold tables',kind:'data'},
 {id:'uc',x:1008,y:350,w:172,h:50,title:'Unity Catalog',sub:'One governance layer',kind:'data'},
 {id:'mlflow',x:246,y:520,w:266,h:46,title:'MLflow traces',sub:'Every agent step',kind:'obs'},
 {id:'inference',x:578,y:520,w:168,h:46,title:'Inference tables',sub:'Request + response in Delta',kind:'obs'},
 {id:'usage',x:792,y:520,w:168,h:46,title:'system.ai_gateway.usage',sub:'Tokens · cost · identity',kind:'obs'},
];
const EDGES:E[]=[
 {id:'shop-agui',from:'shopper',to:'agui'},{id:'agui-con',from:'agui',to:'concierge'},
 {id:'con-gw',from:'concierge',to:'gateway',label:'model calls'},{id:'gw-luna',from:'gateway',to:'luna'},{id:'gw-sol',from:'gateway',to:'sol',dashed:true},{id:'gw-cat',from:'gateway',to:'catalogai',dashed:true},
 {id:'con-catalog',from:'concierge',to:'catalog'},{id:'con-inv',from:'concierge',to:'inventory'},{id:'con-checkout',from:'concierge',to:'checkout'},{id:'con-analyst',from:'concierge',to:'analyst'},
 {id:'tools-gw',from:'app',to:'gateway',curve:'side',y:244,label:'tool calls'},{id:'gw-mcp',from:'gateway',to:'mcp'},
 {id:'mcp-lakebase',from:'mcp',to:'lakebase'},{id:'mcp-vector',from:'mcp',to:'vector'},
 {id:'analyst-genie',from:'analyst',to:'genie',curve:'bus',lane:5},{id:'gw-acp',from:'gateway',to:'acp'},{id:'gw-skills',from:'gateway',to:'skills',dashed:true},{id:'acp-lakebase',from:'acp',to:'lakebase'},
 {id:'chatgpt-gw',from:'chatgpt',to:'gateway',curve:'under',y:362,dashed:true},{id:'merchant-con',from:'merchant',to:'concierge'},{id:'dev-gw',from:'developer',to:'gateway',curve:'under',y:384},
 {id:'gw-inference',from:'gateway',to:'inference'},{id:'gw-usage',from:'gateway',to:'usage'},{id:'app-mlflow',from:'app',to:'mlflow'},
 {id:'lakebase-lakeflow',from:'lakebase',to:'lakeflow',curve:'right'},{id:'lakeflow-genie',from:'lakeflow',to:'genie'},
];

const DETAILS:Record<Exclude<NodeId,'app'>,Detail>={
 shopper:{what:'The shopper experience: chat, product cards and a cart, rendered from typed AG-UI events.',here:['Server-side product cards, never invented by the model','Human confirmation before any order'],where:'client/src/main.tsx',tag:'Channel'},
 chatgpt:{what:'An agentic channel that calls the same merchant API, through the same gateway.',here:['ACP checkout endpoints are implemented in sandbox','Merchant onboarding is a separate step'],where:'server/index.ts · /checkout_sessions',tag:'Channel · sandbox'},
 merchant:{what:'Merchant workspace: intent atlas, catalog lab, operations.',here:['Asks business questions through the merchant analyst','Reads governed Lakehouse aggregates'],where:'client/src/GrowthStudio.tsx',tag:'Channel'},
 developer:{what:'Developers build this app with Codex. Their model calls go through the same Unity Gateway.',here:['ug codex: Databricks identity, no shared key','Sessions and cache hits attributed per developer'],where:'scripts/codex-showcase.sh',tag:'Codex'},
 agui:{what:'Agent–User Interaction protocol: the run streams as typed events (run, step, tool call, text, custom).',here:['Server-Sent Events from /api/agent/run','Every event is also persisted for the protocol timeline'],where:'server/agents.ts · emit()',tag:'Protocol'},
 concierge:{what:'Supervisor agent on the OpenAI Responses API. It plans and delegates to four specialists as tools.',here:['Structured tool calls with strict JSON schemas','Budget and context injected from the shopper profile'],where:'server/agents.ts · runAgent()',tag:'Agent · OpenAI'},
 catalog:{what:'Finds complementary products within budget and renders the shortlist.',here:['search_products, semantic_search, render_products','Over-budget selections are rejected server-side'],where:'server/agents.ts',tag:'Specialist'},
 inventory:{what:'Checks live stock before anything is recommended.',here:['get_inventory over MCP'],where:'server/agents.ts',tag:'Specialist'},
 checkout:{what:'Prepares a draft checkout. It never purchases.',here:['quote_cart and prepare_checkout','Totals are computed by the server, not the model'],where:'server/agents.ts · server/pricing.ts',tag:'Specialist'},
 analyst:{what:'Answers merchant questions from operational and Lakehouse data.',here:['get_merchant_metrics or ask_genie','Always states period, source and units'],where:'server/agents.ts',tag:'Specialist'},
 mcp:{what:'The commerce tools as an MCP server. Unity Gateway governs MCP services like model services: grants, rate limits, guardrails on tool calls and results, usage.',here:['search_products · semantic_search · get_inventory · quote_cart · get_merchant_metrics','Streamable HTTP at /mcp, registrable as a Unity Catalog MCP service'],where:'server/mcp.ts',tag:'MCP · governed'},
 acp:{what:'Agentic Commerce Protocol merchant endpoints: create, update, complete, cancel. Exposed through Unity Gateway like the MCP tools: identity, limits and audit on every checkout call.',here:['Idempotency keys and authoritative totals','Transactional stock checks in Lakebase'],where:'server/index.ts · server/pricing.ts',tag:'ACP · governed · sandbox'},
 gateway:{what:'Governance for every model call, MCP tool call and merchant API call, and for the skills agents load: identity and grants, routing and fallback, rate limits, guardrails, payload logging and usage.',here:['The concierge calls a governed model service, not a raw endpoint','Switch models without a code change'],where:'server/gateway_worker.py · server/unity-gateway.ts',tag:'Unity Gateway'},
 skills:{what:'Unity Gateway Skills: a shared skill registry in Unity Catalog. Coding agents discover and load only the skills the signed-in user may read, through the databricks-skill-registry MCP server.',here:['Published to a Unity Catalog schema, shared with grants (READ VOLUME)','ug codex connects Codex to the registry; admins choose which shared skills are provided'],tag:'Skills · Beta'},
 luna:{what:'GPT-6 Luna serves the concierge: the lowest cost per successful task in our model lab.',here:['Primary destination of the concierge service'],tag:'OpenAI'},
 sol:{what:'GPT-6.1 Sol takes over automatically on 429 or 5xx, and powers Codex sessions.',here:['Fallback destination · same governance'],tag:'OpenAI'},
 catalogai:{what:'Every foundation model in system.ai is a Unity Catalog securable with the same controls.',here:['OpenAI, open-weights and other providers'],tag:'Model services'},
 lakebase:{what:'Managed Postgres for transactional state: products, carts, orders, events.',here:['Checkout reserves stock in one transaction'],where:'server/db.ts',tag:'Data · OLTP'},
 vector:{what:'Semantic product search over the governed catalog.',here:['Hybrid query from semantic_search'],tag:'Data'},
 genie:{what:'Natural-language analytics with governed SQL, under the user’s permissions.',here:['Called by the merchant analyst when asked'],tag:'Data · AI/BI'},
 lakeflow:{what:'Streaming pipeline that turns commerce events into gold Delta tables.',here:['gold_commerce_daily · gold_product_demand'],where:'resources/commerce.pipeline.yml',tag:'Data · Lakehouse'},
 uc:{what:'Unity Catalog governs data, models, MCP tools, skills and agents with one permission model and lineage.',here:['Tables, volumes, model services, MCP services, skills and agents','Lineage and audit across all of them'],tag:'Governance'},
 mlflow:{what:'MLflow traces for every agent run, stored in Unity Catalog.',here:['Spans for model calls and tools'],where:'server/trace_config.py',tag:'Observability'},
 inference:{what:'Inference tables log each request and response of a model service to Delta.',here:['Audit, evaluation and fine-tuning datasets'],tag:'Observability'},
 usage:{what:'System table with every gateway request: who, which model, tokens, latency, routing and coding-agent session.',here:['Feeds the Unity Gateway and Codex pages'],tag:'Observability'},
};

type Step={edges:string[];caption:string};
const SCENARIOS:{id:string;title:string;steps:Step[]}[]=[
 {id:'kit',title:'Shopper asks for a kit',steps:[
  {edges:['shop-agui'],caption:'The shopper asks for a Paris weekend kit under €250.'},
  {edges:['agui-con'],caption:'AG-UI streams the run and hands the message to the concierge.'},
  {edges:['con-gw','gw-luna'],caption:'The concierge calls GPT-6 Luna through Unity Gateway: identity checked, limits applied.'},
  {edges:['con-catalog'],caption:'It delegates product discovery to the catalog agent.'},
  {edges:['tools-gw','gw-mcp','mcp-lakebase','mcp-vector'],caption:'Tool calls go through Unity Gateway to the MCP services: live prices in Lakebase, semantic matches in Vector Search.'},
  {edges:['con-inv','tools-gw','gw-mcp','mcp-lakebase'],caption:'The inventory agent checks real stock, through the same governed MCP path.'},
  {edges:['gw-inference','gw-usage','app-mlflow'],caption:'Every call is logged: inference table, usage system table, MLflow trace.'},
  {edges:['agui-con','shop-agui'],caption:'Typed product cards stream back to the storefront.'},
 ]},
 {id:'checkout',title:'Checkout',steps:[
  {edges:['shop-agui','agui-con'],caption:'The shopper confirms the basket.'},
  {edges:['con-checkout'],caption:'The concierge delegates to the checkout agent.'},
  {edges:['tools-gw','gw-acp'],caption:'The checkout agent calls the ACP merchant API through Unity Gateway, with an idempotency key.'},
  {edges:['acp-lakebase'],caption:'Lakebase reserves stock and computes the authoritative total in one transaction.'},
  {edges:['lakebase-lakeflow'],caption:'The order event streams into Lakeflow and the Delta gold tables.'},
  {edges:['chatgpt-gw','gw-acp'],caption:'An agentic channel such as ChatGPT reaches the same API through the same gateway (sandbox here).'},
 ]},
 {id:'merchant',title:'Merchant question',steps:[
  {edges:['merchant-con'],caption:'A merchant asks: which products risk a stock-out this weekend?'},
  {edges:['con-gw','gw-luna'],caption:'Same governed model service, same identity checks.'},
  {edges:['con-analyst'],caption:'The question goes to the merchant analyst.'},
  {edges:['analyst-genie'],caption:'The analyst asks Genie, which writes governed SQL.'},
  {edges:['lakeflow-genie'],caption:'Genie answers from the Lakeflow gold tables, under the user’s permissions.'},
 ]},
 {id:'codex',title:'Developer with Codex',steps:[
  {edges:['dev-gw'],caption:'A developer runs Codex on this repository with ug codex.'},
  {edges:['gw-skills'],caption:'Codex loads the team’s shared skills from Unity Catalog, only those the developer is allowed to read.'},
  {edges:['gw-sol'],caption:'Requests reach GPT-6.1 Sol through the same Unity Gateway, under the developer’s identity.'},
  {edges:['gw-usage'],caption:'Sessions, tokens and prompt-cache hits are attributed in system.ai_gateway.usage.'},
 ]},
];

const byId=Object.fromEntries(NODES.map(n=>[n.id,n])) as Record<NodeId,N>;
function edgePath(e:E){
 const a=byId[e.from],b=byId[e.to];
 if(e.curve==='under'){const y1=a.y+a.h/2,gy=e.y||b.y+b.h-12;if(Math.abs(y1-gy)<2)return `M${a.x+a.w},${y1} L${b.x},${gy}`;return `M${a.x+a.w},${y1} L${b.x-26},${y1} Q${b.x-14},${y1} ${b.x-14},${y1-12} L${b.x-14},${gy+12} Q${b.x-14},${gy} ${b.x},${gy}`;}
 if(e.curve==='side'){const y=e.y||a.y+a.h/2;return `M${a.x+a.w},${y} L${b.x},${y}`;}
 if(e.curve==='bus'){
  // Data traffic runs in a corridor under the gateway, then rises along the data column.
  const lane=e.lane||0;const x1=a.x+a.w,y1=a.y+a.h/2,corridor=430+lane*9,riser=976+lane*7,x2=b.x,y2=b.y+b.h/2,r=8;
  return `M${x1},${y1} L${x1+14-r},${y1} Q${x1+14},${y1} ${x1+14},${y1+(corridor>y1?r:-r)} L${x1+14},${corridor-(corridor>y1?r:-r)} Q${x1+14},${corridor} ${x1+14+r},${corridor} L${riser-r},${corridor} Q${riser},${corridor} ${riser},${corridor-r} L${riser},${y2+r} Q${riser},${y2} ${riser+r},${y2} L${x2},${y2}`;
 }
 if(e.curve==='right'){const x1=a.x+a.w,y1=a.y+a.h/2,x2=b.x+b.w,y2=b.y+b.h/2;const bulge=Math.max(x1,x2)+12;return `M${x1},${y1} C${bulge},${y1} ${bulge},${y2} ${x2},${y2}`;}
 const acx=a.x+a.w/2,acy=a.y+a.h/2,bcx=b.x+b.w/2,bcy=b.y+b.h/2;
 const horizontal=b.x>=a.x+a.w-4||b.x+b.w<=a.x+4;
 if(e.from==='app'){return `M${acx},${a.y+a.h} L${bcx},${b.y}`;}
 if(horizontal){const right=bcx>acx;const x1=right?a.x+a.w:a.x,x2=right?b.x:b.x+b.w;const y1=Math.min(Math.max(bcy,a.y+10),a.y+a.h-10),y2=Math.min(Math.max(acy,b.y+10),b.y+b.h-10);const mx=(x1+x2)/2;return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;}
 const down=bcy>acy;const y1=down?a.y+a.h:a.y,y2=down?b.y:b.y+b.h;const x1=Math.min(Math.max(bcx,a.x+12),a.x+a.w-12),x2=Math.min(Math.max(acx,b.x+12),b.x+b.w-12);const my=(y1+y2)/2;return `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
}

export function AppArchitecture({health,onProbeMcp}:{health?:{database?:string;model?:string;last_gateway_success?:string|null};onProbeMcp:()=>void}){
 const [selected,setSelected]=useState<NodeId>();const [scenario,setScenario]=useState<string>();const [stepFocus,setStepFocus]=useState<number>();
 const sc=SCENARIOS.find(x=>x.id===scenario);
 // A scenario highlights every edge it uses; hovering a step narrows it to that step. Nothing is ever greyed out.
 const active=useMemo(()=>new Set(sc?(stepFocus!==undefined?sc.steps[stepFocus].edges:sc.steps.flatMap(x=>x.edges)):[]),[sc,stepFocus]);
 const litNodes=useMemo(()=>{const out=new Set<NodeId>();for(const e of EDGES)if(active.has(e.id)){out.add(e.from);out.add(e.to);}out.delete('app');return out;},[active]);
 const d=selected&&selected!=='app'?DETAILS[selected]:undefined;
 return <div className="arch still">
  <div className="arch-toolbar">
   <div className="arch-scenarios" role="group" aria-label="Show a flow">{SCENARIOS.map(x=><button key={x.id} aria-pressed={scenario===x.id} className={scenario===x.id?'active':''} onClick={()=>{setStepFocus(undefined);setScenario(v=>v===x.id?undefined:x.id);}}>{x.title}</button>)}</div>
   {scenario&&<button className="text-button" onClick={()=>{setScenario(undefined);setStepFocus(undefined);}}><X size={13}/> Show everything</button>}
  </div>
  <div className="arch-stage">
   <svg viewBox="0 0 1200 590" role="img" aria-label="Architecture of ShopiBricks: channels, agents and protocols, Unity Gateway, OpenAI models and MCP tools, data and observability">
    <defs><marker id="arch-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="currentColor"/></marker></defs>
    {[['CHANNELS',20],['APP · AGENTS · PROTOCOLS',246],['GOVERNANCE',578],['MODELS · TOOLS · SKILLS',792],['DATA',1008]].map(([t,x])=><text key={String(t)} x={Number(x)} y={16} className="arch-col">{t}</text>)}
    <text x={246} y={510} className="arch-col">OBSERVABILITY</text>
    {NODES.filter(n=>n.kind==='group').map(n=><g key={n.id}><rect x={n.x} y={n.y} width={n.w} height={n.h} rx={16} className="arch-group"/><text x={n.x+14} y={n.y+n.h-10} className="arch-group-label">{n.title}</text></g>)}
    {EDGES.map(e=>{const on=active.has(e.id);const path=edgePath(e);return <g key={e.id} className={`arch-edge ${on?'on':''} ${e.dashed?'dashed':''}`}>
     <path d={path} className="arch-edge-base" markerEnd="url(#arch-arrow)"/>
     {on&&<path d={path} className="arch-edge-hot"/>}
     {e.label&&<text x={(byId[e.from].x+byId[e.from].w+byId[e.to].x)/2} y={e.curve==='side'?(e.y||0)-6:byId[e.from].y+14} textAnchor="middle" className="arch-edge-label">{e.label}</text>}
    </g>;})}
    {NODES.filter(n=>n.kind!=='group').map(n=>{const lit=litNodes.has(n.id);return <g key={n.id} className={`arch-node k-${n.kind} ${lit?'lit':''} ${selected===n.id?'selected':''}`} tabIndex={0} role="button" aria-label={`${n.title}: ${DETAILS[n.id as Exclude<NodeId,'app'>]?.what||''}`} onClick={()=>setSelected(v=>v===n.id?undefined:n.id)} onKeyDown={ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();setSelected(v=>v===n.id?undefined:n.id);}}}>
     <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={n.kind==='gateway'?16:10}/>
     {n.kind==='gateway'?<>
      <text x={n.x+n.w/2} y={n.y+34} textAnchor="middle" className="arch-gw-title">{n.title}</text>
      <text x={n.x+n.w/2} y={n.y+52} textAnchor="middle" className="arch-sub light">{n.sub}</text>
      {['Identity & grants','Routing & fallback','Rate limits','Guardrails','Payload logging','Usage & cost'].map((c,k)=><g key={c} className="arch-chip"><rect x={n.x+16} y={n.y+72+k*36} width={n.w-32} height={26} rx={13}/><text x={n.x+n.w/2} y={n.y+89+k*36} textAnchor="middle">{c}</text></g>)}
     </>:<>
      <text x={n.x+12} y={n.y+(n.sub?20:n.h/2+4)} className="arch-title">{n.title}</text>
      {n.sub&&<text x={n.x+12} y={n.y+36} className="arch-sub">{n.sub}</text>}
     </>}
    </g>;})}
   </svg>
  </div>
  {sc&&<ol className="arch-flow" aria-label={`${sc.title}, step by step`}>{sc.steps.map((st,k)=><li key={k} className={stepFocus===k?'focus':''} onMouseEnter={()=>setStepFocus(k)} onMouseLeave={()=>setStepFocus(undefined)} onFocus={()=>setStepFocus(k)} onBlur={()=>setStepFocus(undefined)} tabIndex={0}><span className="arch-flow-n">{k+1}</span><span>{st.caption}</span></li>)}</ol>}
  {d&&selected&&<div className="arch-detail panel" aria-live="polite">
   <div className="panel-heading"><div><span className="eyebrow">{(d.tag||'').toUpperCase()}</span><h3>{byId[selected].title}</h3></div><button className="icon-button" aria-label="Close details" onClick={()=>setSelected(undefined)}><X size={16}/></button></div>
   <p>{d.what}</p>
   <ul className="ug-checks compact">{d.here.map(h=><li key={h}><span className="tiny-dot"/><span>{h}</span></li>)}</ul>
   {selected==='lakebase'&&health?.database&&<p className="muted">Live: database {health.database}.</p>}
   {(selected==='gateway'||selected==='luna')&&health?.model&&<p className="muted">Live: the concierge calls <code>{health.model.split('.').pop()}</code>{health.last_gateway_success?`, last success ${new Date(health.last_gateway_success).toLocaleTimeString('en-GB')}`:''}.</p>}
   {d.where&&<p className="arch-where"><code>{d.where}</code></p>}
   {selected==='mcp'&&<button className="text-button" onClick={onProbeMcp}>Discover live MCP tools <ArrowUpRight size={14}/></button>}
  </div>}
  {!sc&&!d&&<p className="arch-hint muted">Pick a flow to highlight the components it uses, or click any component for details.</p>}
 </div>;
}
