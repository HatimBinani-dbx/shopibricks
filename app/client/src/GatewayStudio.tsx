import React,{useEffect,useMemo,useState} from 'react';
import {Activity,AlertCircle,ArrowRight,BarChart3,CheckCircle2,Code2,Copy,Database,ExternalLink,FileText,Gauge,KeyRound,Layers,Play,RefreshCw,Route,ShieldCheck,Sparkles,Terminal,Users,Wallet} from 'lucide-react';
import {api,post} from './api';
import {OpenAIMark} from './Brand';
import './gateway.css';
import './developer-experience.css';
import {LabExperience} from './LabExperience';
import {CodexExperience} from './CodexExperience';
import {InferenceExplorer} from './InferenceExplorer';
import {GatewayFeatureDemos} from './GatewayFeatureDemos';

export type DeveloperView='protocols'|'gateway'|'lab'|'codex';
type Row=Record<string,unknown>;
type Destination={name:string;traffic_percentage?:number;pay_per_token_config?:{model?:string}};
type Overview={service:string;identity?:string;workspace_id?:string;config?:{routing?:{destinations?:Destination[];fallback?:{destinations?:Destination[]}};rate_limits?:{key:string;renewal_period:string;requests?:number;tokens?:number;principal?:string}[];inference_table?:{table?:string}};grants?:{privilege_assignments?:{principal:string;privileges:string[]}[]};system_ai_models?:{name:string;api_types:string[]}[];mcp_services?:{name:string;comment:string}[];routable:string[];routing_enabled:boolean;queried_at:string;model_service?:{error?:string}};
type Usage={window:string;queried_at:string;service:string;services?:Row[]|{error:string};consumers?:Row[]|{error:string};concierge?:Row[]|{error:string};coding?:Row[]|{error:string};sql:Record<string,string>};
type BenchModel={model:string;provider:string;runs:number;passed:number;success_rate:number;median_latency_s:number|null;p90_latency_s:number|null;avg_cost_usd:number;cost_per_success_usd:number|null;avg_tokens:number;errors:number;by_scenario:Record<string,number>};
type Bench={generated_at:string;repeats:number;openai_reasoning_effort:string;scenarios:{id:string;title:string;prompt:string}[];pricing_note:string;models:BenchModel[]};
type LabRow={model:string;provider:string;scenario:string;pass:boolean;reasons:string[];latency_s:number;tool_calls:number;usage:{input:number;output:number};cost_usd:number;answer?:{items?:{id:string;quantity:number}[];total_cents?:number;note?:string}|null;error?:string|null};

const OPENAI='#ff3621',OTHER='#2a78c4'; // validated categorical pair (dataviz validate_palette.js, light surface)
const isOpenAI=(provider:string)=>provider.startsWith('OpenAI');
const NAMES:Record<string,string>={'gpt-6-luna':'GPT-6 Luna','gpt-6-astra':'GPT-6 Astra','gpt-6-sol':'GPT-6 Sol','gpt-6-1-sol':'GPT-6.1 Sol','gpt-6-1-terra':'GPT-6.1 Terra','gpt-oss-120b':'gpt-oss-120b','claude-opus-5-5':'Claude Opus 5.5','claude-sonnet-5-5':'Claude Sonnet 5.5','gemini-3-8-flash':'Gemini 3.8 Flash','glm-5-3':'GLM-5.3'};
const prettyModel=(m:string)=>{const k=String(m||'').replace(/^models\//,'').replace(/^system\.ai\./,'').replace(/^databricks-/,'').replace(/\./g,'-');return NAMES[k]||k;};
const usd=(v:number|null|undefined)=>v==null?'—':v<0.01?`$${v.toFixed(4)}`:`$${v.toFixed(3)}`;
const ms=(v:unknown)=>v==null?'—':`${(Number(v)/1000).toFixed(1)} s`;
const num=(v:unknown)=>new Intl.NumberFormat('en-GB').format(Number(v||0));
const clock=(v:unknown)=>v?new Date(String(v)).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):'—';
const rows=(v:Row[]|{error:string}|undefined)=>Array.isArray(v)?v:[];
const failed=(v:Row[]|{error:string}|undefined)=>v&&!Array.isArray(v)?v.error:undefined;
const modelOf=(d?:Destination)=>(d?.pay_per_token_config?.model||d?.name||'').replace('models/system.ai.databricks-','');

export function DeveloperTabs({view,onView}:{view:DeveloperView;onView:(v:DeveloperView)=>void}){
 return <nav className="studio-tabs" aria-label="Developer studio">{([{id:'protocols',label:'Protocols',icon:Layers},{id:'gateway',label:'Unity Gateway',icon:ShieldCheck},{id:'lab',label:'Model lab',icon:Gauge},{id:'codex',label:'Codex',icon:Terminal}] as const).map(({id,label,icon:Icon})=><button key={id} aria-current={view===id?'page':undefined} onClick={()=>onView(id)}><Icon size={16}/>{label}{id!=='protocols'&&<span className="new-pill">NEW</span>}</button>)}</nav>;
}

export function GatewayStudio({view,workspace}:{view:Exclude<DeveloperView,'protocols'>;workspace?:string}){
 const [overview,setOverview]=useState<Overview>();const [usage,setUsage]=useState<Usage>();const [windowSize,setWindow]=useState<'1h'|'24h'|'7d'>('7d');const [error,setError]=useState('');
 const loadOverview=(refresh=false)=>api<Overview>(`/api/ug/overview${refresh?'?refresh=1':''}`).then(setOverview).catch(e=>setError(e.message));
 const loadUsage=(refresh=false)=>api<Usage>(`/api/ug/usage?window=${windowSize}${refresh?'&refresh=1':''}`).then(setUsage).catch(e=>setError(e.message));
 useEffect(()=>{void loadOverview();},[]);
 useEffect(()=>{if(view==='lab')return;void loadUsage();const id=setInterval(()=>void loadUsage(),30000);return()=>clearInterval(id);},[view,windowSize]);
 const host=workspace?(/^https?:\/\//.test(workspace)?workspace:`https://${workspace}`):'';
 return <div className="gateway-studio">
  {error&&<div className="ug-alert" role="alert"><AlertCircle size={15}/>{error}<button className="text-button" onClick={()=>{setError('');void loadOverview(true);void loadUsage(true);}}>Retry</button></div>}
  {view==='gateway'&&<GatewayView overview={overview} usage={usage} windowSize={windowSize} onWindow={setWindow} onRefresh={()=>{void loadOverview(true);void loadUsage(true);}} onRouted={()=>void loadOverview(true)} host={host}/>}
  {view==='lab'&&<LabExperience/>}
  {view==='codex'&&<><WindowPicker value={windowSize} onChange={setWindow}/><CodexExperience sessions={rows(usage?.coding)} loading={!usage} error={failed(usage?.coding)} host={host} onRefresh={()=>void loadUsage(true)}/></>}
 </div>;
}

function WindowPicker({value,onChange}:{value:string;onChange:(v:'1h'|'24h'|'7d')=>void}){return <div className="ug-window" role="group" aria-label="Time window">{(['1h','24h','7d'] as const).map(w=><button key={w} className={value===w?'active':''} onClick={()=>onChange(w)}>{w}</button>)}</div>;}

function GatewayView({overview,usage,windowSize,onWindow,onRefresh,onRouted,host}:{overview?:Overview;usage?:Usage;windowSize:string;onWindow:(v:'1h'|'24h'|'7d')=>void;onRefresh:()=>void;onRouted:()=>void;host:string}){
 const cfg=overview?.config;const primary=cfg?.routing?.destinations||[];const fallback=cfg?.routing?.fallback?.destinations||[];
 const models=overview?.system_ai_models||[];const providers=useMemo(()=>{const groups:Record<string,number>={};for(const m of models){const p=/^gpt|^o\d/.test(m.name)?'OpenAI':/^claude/.test(m.name)?'Anthropic':/^gemini/.test(m.name)?'Google':/^(llama|meta)/.test(m.name)?'Meta':'Open & other';groups[p]=(groups[p]||0)+1;}return Object.entries(groups).sort((a,b)=>b[1]-a[1]);},[models]);
 const services=rows(usage?.services);const consumers=rows(usage?.consumers);const recent=rows(usage?.concierge);
 const spend=services.reduce((s,r)=>s+Number(r.cost_usd||0),0);const totalRequests=services.reduce((s,r)=>s+Number(r.requests||0),0);
 const [routing,setRouting]=useState('');const [routeMsg,setRouteMsg]=useState('');
 async function route(primaryModel:string){setRouting(primaryModel);setRouteMsg('');try{await post('/api/ug/route',{primary:primaryModel});setRouteMsg(`Primary route is now ${prettyModel(primaryModel)}. No code change, no redeploy.`);onRouted();}catch(e){setRouteMsg(e instanceof Error?e.message:'Routing update failed');}finally{setRouting('');}}
 const grants=overview?.grants?.privilege_assignments||[];
 return <>
  <div className="ug-map panel ug-map-animated" aria-label="Unity Gateway architecture">
   <div className="ug-map-col"><span className="eyebrow">WHO CALLS</span>{[[Sparkles,'ShopiBricks agents','App service principal'],[Terminal,'Developers in Codex','Their own Databricks identity'],[Users,'Business users','ChatGPT × Genie, Databricks One'],[Layers,'Agent Bricks & apps','Governed agents']].map(([Icon,t,s])=>{const I=Icon as typeof Sparkles;return <div className="ug-node" key={String(t)}><I size={16}/><div><strong>{String(t)}</strong><small>{String(s)}</small></div></div>;})}</div>
   <ArrowRight className="ug-arrow" size={20}/>
   <div className="ug-core"><span className="eyebrow">ONE CONTROL PLANE</span><h3>Unity Gateway</h3><p>Governance built on Unity Catalog, for models, MCP tools and coding agents.</p><div className="ug-chips">{['Identity & grants','Routing & fallback','Rate limits','Budgets','Guardrails','Payload logging','Usage & cost'].map(c=><span key={c}>{c}</span>)}</div></div>
   <ArrowRight className="ug-arrow" size={20}/>
   <div className="ug-map-col"><span className="eyebrow">WHAT IT GOVERNS</span><div className="ug-node"><OpenAIMark/><div><strong>{models.length?`${models.length} model services`:'Model services'}</strong><small>{providers.map(([p,n])=>`${p} ${n}`).join(' · ')||'system.ai'}</small></div></div><div className="ug-node"><Code2 size={16}/><div><strong>{overview?.mcp_services?`${overview.mcp_services.length} MCP services`:'MCP services'}</strong><small>{(overview?.mcp_services||[]).slice(0,4).map(m=>m.name.split('.').pop()).join(', ')||'Governed tools'}</small></div></div><div className="ug-node"><Database size={16}/><div><strong>Unity Catalog data</strong><small>Same permissions, same lineage</small></div></div></div>
  </div>

  <div className="page-subhead"><div><span className="eyebrow">THE SERVICE THIS APP CALLS</span><h2>The shop’s governed AI service</h2></div><div className="ug-actions"><WindowPicker value={windowSize} onChange={onWindow}/><button className="icon-button" aria-label="Refresh Unity Gateway data" onClick={onRefresh}><RefreshCw size={16}/></button></div></div>
  {overview?.model_service?.error&&<div className="ug-alert"><AlertCircle size={15}/>{overview.model_service.error}</div>}
  <div className="ug-controls">
   <Control icon={KeyRound} title="Identity & access" status={grants.length?'good':'info'} statusText={grants.length?`${grants.length} explicit grants`:'Inherited Unity Catalog permissions'}>
    <p>Every caller presents its own Databricks identity. Access is an <code>EXECUTE</code> grant on a Unity Catalog securable, not a shared API key.</p>
    <ul className="ug-list">{grants.slice(0,4).map(g=><li key={g.principal}><span>{g.principal.includes('@')?`${g.principal[0]}•••@${g.principal.split('@')[1]}`:g.principal}</span><b>{g.privileges.join(', ')}</b></li>)}{overview?.identity&&<li><span>This app runs as</span><b>{/^[0-9a-f-]{36}$/i.test(overview.identity)?`SP ${overview.identity.slice(0,8)}`:overview.identity.includes('@')?'presenter (local)':overview.identity}</b></li>}</ul>
   </Control>
   <Control icon={Route} title="Routing & fallback" status={primary.length?'good':'info'} statusText={fallback.length?'Automatic failover on 429 / 5xx':'Single destination'}>
    <ul className="ug-list">{primary.map(d=><li key={d.name}><span>Primary</span><b>{prettyModel(modelOf(d))} · {d.traffic_percentage??100}%</b></li>)}{fallback.map((d,i)=><li key={d.name}><span>Fallback {i+1}</span><b>{prettyModel(modelOf(d))}</b></li>)}</ul>
    {overview?.routing_enabled&&<div className="ug-route"><span>Promote a model to primary:</span><div>{overview.routable.map(m=><button key={m} disabled={!!routing||modelOf(primary[0])===m} className={modelOf(primary[0])===m?'active':''} onClick={()=>void route(m)}>{routing===m?'Updating…':prettyModel(m)}</button>)}</div>{routeMsg&&<small>{routeMsg}</small>}</div>}
   </Control>
   <Control icon={Gauge} title="Rate limits" status={cfg?.rate_limits?.length?'good':'info'} statusText={cfg?.rate_limits?.length?'Enforced at the gateway · HTTP 429':'Not configured'}>
    <ul className="ug-list">{(cfg?.rate_limits||[]).map((l,i)=><li key={i}><span>{l.key.replace('RATE_LIMIT_KEY_','').replace('USER_DEFAULT','Each user').replace('SERVICE_PRINCIPAL','Service principal').replace('USER_GROUP','Group').replace('SERVICE','Whole service').toLowerCase().replace(/^\w/,c=>c.toUpperCase())}</span><b>{[l.requests&&`${num(l.requests)} req`,l.tokens&&`${num(l.tokens)} tokens`].filter(Boolean).join(' · ')} / {l.renewal_period.endsWith('HOUR')?'hour':'min'}</b></li>)}</ul>
    <p className="muted">Per user, group or service principal. A runaway agent can't starve the others.</p>
   </Control>
   <Control icon={Wallet} title="Budgets & cost attribution" status="info" statusText={`${usd(spend)} estimated · last ${windowSize}`}>
    <p>Spend is attributed by service, model, principal and tags. Budgets alert or block per user or per tag.</p>
    <ul className="ug-list"><li><span>Requests · last {windowSize}</span><b>{num(totalRequests)}</b></li><li><span>Estimated spend · list price</span><b>{usd(spend)}</b></li></ul>
   </Control>
   <Control icon={ShieldCheck} title="Guardrails" status="info" statusText="Service policies · Beta">
    <p>Built-in, custom and partner policies inspect requests and responses: PII, prompt injection, unsafe content. They are applied per caller identity.</p>
    <p className="muted">Try the GPT catalog guard in Model lab. It evaluates untrusted tool content at the application boundary; native service-policy attachment is a separate setup.</p>
   </Control>
   <Control icon={FileText} title="Audit & payload logging" status={cfg?.inference_table?.table?'good':'info'} statusText={cfg?.inference_table?.table?'Inference table enabled':'Not configured'}>
    <p>Requests and responses land in a Delta table in Unity Catalog, ready for evaluation, audit and fine-tuning datasets.</p>
    {cfg?.inference_table?.table&&<ul className="ug-list"><li><span>Table</span><b><code>{cfg.inference_table.table.replace('tables/','')}</code></b></li></ul>}
   </Control>
  </div>

  <GatewayFeatureDemos/>
  <InferenceExplorer/>
  <div className="ug-grid-2">
   <div className="panel"><div className="panel-heading"><h3>Who is calling · last {windowSize}</h3><Users size={18}/></div>
    {failed(usage?.consumers)?<UsageError message={failed(usage?.consumers)!}/>:consumers.length?<div className="ug-table"><div className="ug-th"><span>Consumer</span><span>Requests</span><span>Principals</span><span>Tokens</span></div>{consumers.map(r=><div className="ug-tr" key={String(r.consumer)}><span>{String(r.consumer)}</span><span>{num(r.requests)}</span><span>{num(r.principals)}</span><span>{num(r.tokens)}</span></div>)}</div>:<Empty loading={!usage}/>}
    <div className="source-note">system.ai_gateway.usage · this workspace · as of {clock(usage?.queried_at)}</div></div>
   <div className="panel"><div className="panel-heading"><h3>Concierge requests · live</h3><Activity size={18}/></div>
    {failed(usage?.concierge)?<UsageError message={failed(usage?.concierge)!}/>:recent.length?<div className="ug-table ug-table-5"><div className="ug-th"><span>Time</span><span>Served by</span><span>Status</span><span>Latency</span><span>Attempts</span></div>{recent.map((r,i)=><div className="ug-tr" key={i}><span>{clock(r.event_time)}</span><span>{prettyModel(String(r.destination_model||'').replace(/^databricks-/,''))}</span><span className={Number(r.status_code)>=400?'bad':'good'}>{String(r.status_code)}</span><span>{ms(r.latency_ms)}</span><span>{Number(r.attempts)>1?`${r.attempts} · rerouted`:'1'}</span></div>)}</div>:<Empty loading={!usage} text="Ask the concierge something: each call appears here within minutes."/>}
    <div className="source-note">Usage records land asynchronously, usually within a few minutes.</div></div>
  </div>

  <div className="panel"><div className="panel-heading"><h3>Every model service · last {windowSize}</h3><BarChart3 size={18}/></div>
   {failed(usage?.services)?<UsageError message={failed(usage?.services)!}/>:services.length?<div className="ug-table ug-table-8"><div className="ug-th"><span>Service</span><span>Model</span><span>Requests</span><span>p50</span><span>p95</span><span>Errors · 429</span><span>Rerouted</span><span>Est. cost</span></div>{services.map((r,i)=><div className="ug-tr" key={i}><span><code>{String(r.service_name||'').replace('system.ai.','')}</code></span><span>{prettyModel(String(r.destination_model||'').replace(/^databricks-/,''))}</span><span>{num(r.requests)}</span><span>{ms(r.p50_ms)}</span><span>{ms(r.p95_ms)}</span><span>{num(r.errors)} · {num(r.throttled)}</span><span>{num(r.rerouted)}</span><span>{usd(r.cost_usd as number|null)}</span></div>)}</div>:<Empty loading={!usage}/>}
   <div className="source-note">Cost is estimated from tokens at public Databricks pay-per-token list prices; billing system tables are the source of truth.{host&&<> · <a href={`${host}/ml/ai-gateway`} target="_blank" rel="noreferrer">Open Unity Gateway <ExternalLink size={11}/></a></>}</div></div>
 </>;
}

function Control({icon:Icon,title,status,statusText,children}:{icon:typeof ShieldCheck;title:string;status:'good'|'info';statusText:string;children:React.ReactNode}){
 return <div className="ug-control"><div className="ug-control-head"><span className="protocol-icon"><Icon size={17}/></span><h3>{title}</h3></div>{children}<span className={`status-text ${status==='good'?'good':''}`}>{status==='good'?<CheckCircle2 size={11}/>:<span className="tiny-dot"/>}{statusText}</span></div>;
}
function Empty({loading,text='No traffic in this window yet.'}:{loading?:boolean;text?:string}){return <div className="empty-state ug-empty">{loading?'Reading system.ai_gateway.usage…':text}</div>;}
function UsageError({message}:{message:string}){return <div className="ug-alert"><AlertCircle size={15}/><div><strong>Usage table unavailable.</strong> {message.slice(0,220)}<br/><small>The app service principal needs SELECT on system.ai_gateway.usage.</small></div></div>;}
