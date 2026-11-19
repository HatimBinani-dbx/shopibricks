import React,{useMemo,useState} from 'react';
import {AlertCircle,ArrowRight,BarChart3,CheckCircle2,ChevronDown,Code2,Database,ExternalLink,FileText,Gauge,KeyRound,Layers,Play,RefreshCw,Route,ShieldAlert,ShieldCheck,Sparkles,Terminal,Users,Wallet} from 'lucide-react';
import {OpenAIMark} from '../Brand';
import {PayloadList,useGuardrail} from './payloads';
import {GuardrailStory} from './GuardrailStory';
import {api,post} from '../api';
import {Empty,WindowPicker,clock,modelKey,compact,failed,modelOf,num,prettyModel,rows,secs,shortService,usd,usePresenter,type Overview,type Row,type Usage} from './shared';

type Probe={status:number;latency_ms:number;model?:string;text?:string;error?:string;error_code?:string;policy?:unknown};

// ---------------------------------------------------------------- map (static)
const CALLERS:[typeof Sparkles,string,string][]=[[Sparkles,'ShopiBricks agents','App service principal'],[Terminal,'Developers in Codex','Their own Databricks identity'],[Users,'Business users','ChatGPT × Genie, Databricks One'],[Layers,'Agent Bricks & apps','Governed agents']];
export function GatewayMap({overview}:{overview?:Overview}){
 const models=overview?.system_ai_models||[];
 const providers=useMemo(()=>{const groups:Record<string,number>={};for(const m of models){const k=modelKey(m.name);const p=/^gpt|^o\d/.test(k)?'OpenAI':/^claude/.test(k)?'Anthropic':/^gemini/.test(k)?'Google':/^(llama|meta)/.test(k)?'Meta':'Open & other';groups[p]=(groups[p]||0)+1;}return Object.entries(groups).sort((a,b)=>b[1]-a[1]);},[models]);
 const mcp=overview?.mcp_services||[];
 return <div className="ug-map panel" aria-label="Unity Gateway architecture">
  <div className="ug-map-col"><span className="eyebrow">WHO CALLS</span>{CALLERS.map(([Icon,t,sub])=><div className="ug-node" key={t}><Icon size={16}/><div><strong>{t}</strong><small>{sub}</small></div></div>)}</div>
  <ArrowRight className="ug-arrow" size={20}/>
  <div className="ug-core"><span className="eyebrow">ONE CONTROL PLANE</span><h3>Unity Gateway</h3><p>Governance built on Unity Catalog, for models, MCP tools and coding agents.</p><div className="ug-chips">{['Identity & grants','Routing & fallback','Rate limits','Budgets','Guardrails','Payload logging','Usage & cost'].map(c=><span key={c}>{c}</span>)}</div></div>
  <ArrowRight className="ug-arrow" size={20}/>
  <div className="ug-map-col"><span className="eyebrow">WHAT IT GOVERNS</span>
   <div className="ug-node"><OpenAIMark/><div><strong>{models.length?`${models.length} model services`:'Model services'}</strong><small>{providers.map(([p,n])=>`${p} ${n}`).join(' · ')||'system.ai'}</small></div></div>
   <div className="ug-node"><Code2 size={16}/><div><strong>{mcp.length?`${mcp.length} MCP services`:'MCP services'}</strong><small>{mcp.slice(0,4).map(m=>m.name.split('.').pop()).join(', ')||'Governed tools'}</small></div></div>
   <div className="ug-node"><Database size={16}/><div><strong>Unity Catalog data</strong><small>Same permissions, same lineage</small></div></div>
  </div>
 </div>;
}

// ---------------------------------------------------------------- page
export function GatewayView({overview,usage,windowSize,onWindow,onRefresh,onRouted,host}:{overview?:Overview;usage?:Usage;windowSize:'1h'|'24h'|'7d';onWindow:(v:'1h'|'24h'|'7d')=>void;onRefresh:()=>void;onRouted:()=>void;host:string}){
 const {settings}=usePresenter();const bump=()=>undefined;
 const cfg=overview?.config;
 return <>
  <div className="page-subhead"><div><span className="eyebrow">UNITY GATEWAY</span><h2>Every model call, <em>governed.</em></h2><p className="muted">One control plane between every caller and every model, tool and dataset. Each card below runs a real request through the gateway.</p></div><div className="ug-actions"><span className="ug-pill" title={overview?.service}>Service · {shortService(overview?.service)||'…'}</span><WindowPicker value={windowSize} onChange={onWindow}/><button className="icon-button" aria-label="Refresh Unity Gateway data" onClick={onRefresh}><RefreshCw size={16}/></button></div></div>
  {overview?.model_service?.error&&<div className="ug-alert"><AlertCircle size={15}/>{overview.model_service.error}</div>}
  <GatewayMap overview={overview}/>
  <div className="ug-controls">
   <IdentityCard overview={overview} onRun={bump}/>
   <RoutingCard overview={overview} onRouted={onRouted} onRun={bump}/>
   <RateLimitCard limits={cfg?.rate_limits} onRun={bump}/>
   {settings.showCosts&&<CostCard usage={usage} windowSize={windowSize}/>}
   <GuardrailCard onRun={bump}/>
   <PayloadCard table={cfg?.inference_table?.table}/>
  </div>
  <GuardrailStory host={host}/>
  <TrafficPanel usage={usage} windowSize={windowSize} host={host}/>
 </>;
}

function Card({icon:Icon,title,status,statusText,children}:{icon:typeof ShieldCheck;title:string;status:'good'|'info'|'bad';statusText:string;children:React.ReactNode}){
 return <div className="ug-control"><div className="ug-control-head"><span className="protocol-icon"><Icon size={17}/></span><h3>{title}</h3></div>{children}<span className={`status-text ${status==='good'?'good':status==='bad'?'bad':''}`}>{status==='good'?<CheckCircle2 size={11}/>:status==='bad'?<AlertCircle size={11}/>:<span className="tiny-dot"/>}{statusText}</span></div>;
}
const TryButton=({busy,disabled=false,onClick,children}:{busy:boolean;disabled?:boolean;onClick:()=>void;children:React.ReactNode})=><button className="ug-try" disabled={busy||disabled} onClick={onClick}>{busy?<RefreshCw size={13} className="spin"/>:<Play size={13}/>}{busy?'Running…':children}</button>;
const statusClass=(s:number)=>s>=200&&s<300?'good':'bad';

type Identity={caller:string;caller_is_app:boolean;app_principal:string|null;rows:(Probe&{label:string;service:string;app_privileges:string[]|null})[]};
function IdentityCard({overview,onRun}:{overview?:Overview;onRun:()=>void}){
 const [busy,setBusy]=useState(false);const [result,setResult]=useState<Identity>();const [err,setErr]=useState('');
 const grants=overview?.grants?.privilege_assignments||[];
 async function run(){setBusy(true);setErr('');onRun();try{setResult(await post('/api/ug/try',{demo:'identity'}));}catch(e){setErr(e instanceof Error?e.message:'Failed');}finally{setBusy(false);}}
 const canRun=(p:string[]|null)=>!!p&&(p.includes('EXECUTE')||p.includes('ALL_PRIVILEGES'));
 return <Card icon={KeyRound} title="Identity & access" status={result?'good':'info'} statusText={result?'Checked as the ShopiBricks app’s service principal':`${grants.length} explicit grants on the concierge`}>
  <p>Every caller presents its own Databricks identity. Access is an <code>EXECUTE</code> grant on a Unity Catalog securable, never a shared API key.</p>
  <TryButton busy={busy} onClick={()=>void run()}>Call a granted and a restricted service</TryButton>
  {err&&<p className="ug-reasons">{err}</p>}
  {result&&<div className="ug-results">{result.rows.map(r=>{const allowed=result.caller_is_app?r.status<300:canRun(r.app_privileges);return <div key={r.service} className={`ug-result-line ${allowed?'good':'bad'}`}><span className="ug-code-pill">{result.caller_is_app?r.status:allowed?'ALLOWED':'DENIED'}</span><div><strong>{shortService(r.service)}</strong>
   <small>{allowed?(result.caller_is_app?`Answered in ${secs(r.latency_ms)}`:'EXECUTE granted to the ShopiBricks app'):(result.caller_is_app&&r.error_code?`${r.error_code} · no EXECUTE grant for the ShopiBricks app`:'No EXECUTE grant for the ShopiBricks app')}</small></div></div>;})}</div>}
 </Card>;
}

type Served={destination_model?:string;destination_name?:string;latency_ms?:string;table?:string;request_id?:string;pending?:boolean}|null;
function RoutingCard({overview,onRouted,onRun}:{overview?:Overview;onRouted:()=>void;onRun:()=>void}){
 const primary=overview?.config?.routing?.destinations||[];const fallback=overview?.config?.routing?.fallback?.destinations||[];
 const [routing,setRouting]=useState('');const [msg,setMsg]=useState('');const [busy,setBusy]=useState(false);const [probe,setProbe]=useState<Probe&{served?:Served;request_id?:string}>();
 async function route(m:string){setRouting(m);setMsg('');try{await post('/api/ug/route',{primary:m});setMsg(`Primary is now ${prettyModel(m)}. No code change, no redeploy.`);onRouted();}catch(e){setMsg(e instanceof Error?e.message:'Routing update failed');}finally{setRouting('');}}
 const [finding,setFinding]=useState(false);
 async function send(){setBusy(true);setProbe(undefined);onRun();let p:Probe&{served?:Served;request_id?:string};try{p=await post('/api/ug/try',{demo:'probe'});setProbe(p);}catch(e){setProbe({status:500,latency_ms:0,error:e instanceof Error?e.message:'Failed'});setBusy(false);return;}setBusy(false);
  if(p.status===200&&p.request_id){setFinding(true);try{const served=await api<Served>(`/api/ug/served?request_id=${p.request_id}`);setProbe(x=>x&&{...x,served});}catch{/* keep the answer */}finally{setFinding(false);}}}
 const dest=probe?.served?.destination_model||'';const role=/^fallback-/.test(dest)?'fallback':/^primary-/.test(dest)?'primary':'';
 return <Card icon={Route} title="Routing & fallback" status={primary.length?'good':'info'} statusText={fallback.length?'Automatic failover on 429 / 5xx':'Single destination'}>
  <ul className="ug-list">{primary.map(d=><li key={d.name}><span>Primary</span><b>{prettyModel(modelOf(d))} · {d.traffic_percentage??100}%</b></li>)}{fallback.map((d,i)=><li key={d.name}><span>Fallback {i+1}</span><b>{prettyModel(modelOf(d))}</b></li>)}</ul>
  {overview?.routing_enabled&&<div className="ug-route"><span>Promote to primary</span><div>{overview.routable.map(m=><button key={m} disabled={!!routing||modelOf(primary[0])===m} className={modelOf(primary[0])===m?'active':''} onClick={()=>void route(m)}>{routing===m?'Updating…':prettyModel(m)}</button>)}</div>{msg&&<small>{msg}</small>}</div>}
  <TryButton busy={busy||finding} onClick={()=>void send()}>Send a request to the concierge</TryButton>
  {probe&&<div className={`ug-result-line ${statusClass(probe.status)}`}><span className="ug-code-pill">{probe.status}</span><div>
   <strong>{probe.status>=300?'Error':dest?`Served by ${prettyModel(dest)}${role?` · ${role}`:''}`:finding?`Answered in ${secs(probe.latency_ms)}`:'Answered · destination not logged yet'}</strong>
   <small>{probe.status>=300?String(probe.error||'').slice(0,120):dest?`${secs(probe.latency_ms)} · read from ${String(probe.served?.table||'').split('.').pop()} by request id ${String(probe.served?.request_id||'').slice(0,8)}`:finding?'Reading the served destination from the inference table…':'The inference table usually logs the destination within a minute.'}</small></div></div>}
 </Card>;
}

type Limit={key:string;renewal_period:string;requests?:number|string;tokens?:number|string};
const SPIKE=5,HISTORY=4;
function RateLimitCard({limits,onRun}:{limits?:Limit[];onRun:()=>void}){
 // Each spike is kept, newest first: the limit can take a few spikes to kick in, and the audience sees it happen.
 const [spikes,setSpikes]=useState<{n:number;tiles:(number|null)[]}[]>([]);const [busy,setBusy]=useState(false);const [err,setErr]=useState('');const [demoLimits,setDemoLimits]=useState<Limit[]>();const [count,setCount]=useState(0);
 async function spike(){const n=count+1;setCount(n);setBusy(true);setErr('');onRun();setSpikes(sp=>[{n,tiles:Array(SPIKE).fill(null)},...sp].slice(0,HISTORY));
  for(let i=0;i<SPIKE;i++){try{const r=await post<Probe&{limits?:Limit[]}>('/api/ug/try',{demo:'limit'});if(r.limits)setDemoLimits(r.limits);setSpikes(sp=>sp.map(x=>x.n===n?{...x,tiles:x.tiles.map((v,k)=>k===i?r.status:v)}:x));}catch(e){setErr(e instanceof Error?e.message:'Failed');break;}}
  setBusy(false);}
 const label=(k:string)=>k.replace('RATE_LIMIT_KEY_','').replace('USER_DEFAULT','Each user').replace('SERVICE_PRINCIPAL','Service principal').replace('USER_GROUP','Group').replace('SERVICE','Whole service').toLowerCase().replace(/^\w/,c=>c.toUpperCase());
 const all=spikes.flatMap(x=>x.tiles).filter(v=>v!==null) as number[];const ok=all.filter(v=>v<300).length;const throttled=all.filter(v=>v===429).length;
 const perMinute=demoLimits?.find(l=>l.key==='RATE_LIMIT_KEY_SERVICE')?.requests;
 return <Card icon={Gauge} title="Rate limits" status={throttled?'good':'info'} statusText={all.length?`${ok} served · ${throttled} throttled with HTTP 429`:'Per service, user, group or service principal'}>
  <ul className="ug-list">{(limits||[]).map((l,i)=><li key={i}><span>{label(l.key)}</span><b>{[l.requests&&`${num(l.requests)} req`,l.tokens&&`${compact(l.tokens)} tokens`].filter(Boolean).join(' · ')} / {l.renewal_period.endsWith('HOUR')?'hour':'min'}</b></li>)}</ul>
  <TryButton busy={busy} onClick={()=>void spike()}>{spikes.length?`Send another spike of ${SPIKE}`:`Send a spike of ${SPIKE} requests`}</TryButton>
  {err&&<p className="ug-reasons">{err}</p>}
  {spikes.length>0&&<div className="ug-spikes" aria-live="polite">{spikes.map(x=><div key={x.n} className="ug-spike-row"><span className="ug-spike-n">#{x.n}</span><div className="ug-burst spike">{x.tiles.map((v,i)=><span key={i} className={`ug-tile ${v===null?'wait':v<300?'ok':'no'}`} title={v===null?'…':String(v)}>{v===null?'':v}</span>)}</div></div>)}</div>}
  {spikes.length>0&&<p className="muted small">Demo service limited to {perMinute?`${perMinute} request`:'1 request'} per minute. Over the limit, the gateway answers HTTP 429 before reaching the model.</p>}
 </Card>;
}

function CostCard({usage,windowSize}:{usage?:Usage;windowSize:string}){
 const [by,setBy]=useState<'consumer'|'model'|'service'>('model');
 const data=useMemo(()=>{const src=by==='service'?rows(usage?.services):rows(usage?.attribution);const acc=new Map<string,{cost:number;requests:number}>();for(const r of src){const k=by==='consumer'?String(r.consumer):by==='model'?prettyModel(String(r.destination_model||'')):shortService(String(r.service_name||''));const v=acc.get(k)||{cost:0,requests:0};v.cost+=Number(r.cost_usd||0);v.requests+=Number(r.requests||0);acc.set(k,v);}return[...acc.entries()].filter(([k])=>k).sort((a,b)=>b[1].cost-a[1].cost).slice(0,6);},[usage,by]);
 const total=data.reduce((s,[,v])=>s+v.cost,0);const max=Math.max(...data.map(([,v])=>v.cost),1e-9);
 return <Card icon={Wallet} title="Cost attribution" status="info" statusText={`${usd(total)} estimated · last ${windowSize}`}>
  <div className="ug-seg" role="group" aria-label="Attribute spend by">{(['model','consumer','service'] as const).map(k=><button key={k} className={by===k?'active':''} onClick={()=>setBy(k)}>{k[0].toUpperCase()+k.slice(1)}</button>)}</div>
  {failed(usage?.attribution)?<p className="ug-reasons">{failed(usage?.attribution)}</p>:data.length?<div className="ug-bars">{data.map(([k,v])=><div key={k} className="ug-bar-row" title={`${k}: ${usd(v.cost)} · ${num(v.requests)} requests`}><span className="ug-bar-label">{k}</span><span className="ug-bar-track"><span className="ug-bar" style={{width:`${Math.max(2,v.cost/max*100)}%`}}/></span><b>{usd(v.cost)}</b></div>)}</div>:<Empty loading={!usage}/>}
  <p className="muted small">Spend by model, consumer and service from system tables. Budgets alert or block per user or tag.</p>
 </Card>;
}

function GuardrailCard({onRun}:{onRun:()=>void}){
 const {guardrail}=useGuardrail();const [busy,setBusy]=useState<string>();const [res,setRes]=useState<Probe&{variant:string;prompt:string}>();
 async function send(variant:'attack'|'normal'){setBusy(variant);onRun();try{setRes(await post('/api/ug/try',{demo:'guardrail',variant}));}catch(e){setRes({status:500,latency_ms:0,variant,prompt:'',error:e instanceof Error?e.message:'Failed'});}finally{setBusy(undefined);}}
 const active=!!guardrail?.last_denial;const blocked=!!res?.policy;
 return <Card icon={ShieldCheck} title="Guardrails" status={active?'good':'info'} statusText={active?`Denial logged at ${clock(guardrail!.last_denial!.event_time)} on ${shortService(guardrail!.service||'')}`:'Service policies · Beta'}>
  <p>Built-in and custom policies screen requests and responses: jailbreak and prompt injection, unsafe content, sensitive data.</p>
  <div className="ug-try-row"><TryButton busy={busy==='attack'} onClick={()=>void send('attack')}>Send a jailbreak</TryButton><TryButton busy={busy==='normal'} onClick={()=>void send('normal')}>Normal question</TryButton></div>
  {res&&<div className={`ug-result-line ${blocked?'bad':res.status<300?'good':'bad'}`}>{blocked?<ShieldAlert size={18}/>:<span className="ug-code-pill">{res.status}</span>}<div><strong>{blocked?'Blocked by Unity Gateway':res.status<300?'Answered by the model':'Error'}</strong><small>{blocked?String((res.policy as Row)?.reason||JSON.stringify(res.policy)).slice(0,140):String(res.text||res.error||'').slice(0,140)}</small></div></div>}
  {res&&!blocked&&res.variant==='attack'&&<p className="muted small">No policy denied it: only the model’s own judgement applied. Attach the Jailbreak policy to <code>{shortService(guardrail?.service||'guarded_oss')}</code>.</p>}
  <a className="text-button" href="#guardrails" onClick={e=>{e.preventDefault();document.getElementById('guardrails')?.scrollIntoView({behavior:'smooth'});}}>See it stop a real prompt injection <ArrowRight size={13}/></a>
 </Card>;
}

function PayloadCard({table}:{table?:string}){
 return <Card icon={FileText} title="Inference tables" status={table?'good':'info'} statusText={table?'Every request and response in Delta':'Not configured'}>
  <p>Payload logging writes each request and response to a Unity Catalog table: audit, evaluation and fine-tuning datasets, with SQL.</p>
  <PayloadList service="concierge" limit={5}/>
 </Card>;
}

function TrafficPanel({usage,windowSize,host}:{usage?:Usage;windowSize:string;host:string}){
 const services=rows(usage?.services);const total=services.reduce((s,r)=>s+Number(r.requests||0),0);
 const [open,setOpen]=useState(false);
 return <div className="panel"><button className="ug-collapse" onClick={()=>setOpen(o=>!o)} aria-expanded={open}><span><BarChart3 size={16}/> Live traffic · {num(total)} requests across {services.length} model services · last {windowSize}</span><ChevronDown size={16}/></button>
  {open&&(failed(usage?.services)?<p className="ug-reasons">{failed(usage?.services)}</p>:services.length?<div className="ug-table ug-table-8"><div className="ug-th"><span>Service</span><span>Model</span><span>Requests</span><span>p50</span><span>p95</span><span>Errors · 429</span><span>Rerouted</span><span>Est. cost</span></div>{services.map((r,i)=><div className="ug-tr" key={i}><span><code>{String(r.service_name||'').replace('system.ai.','')}</code></span><span>{prettyModel(String(r.destination_model||''))}</span><span>{num(r.requests)}</span><span>{secs(r.p50_ms)}</span><span>{secs(r.p95_ms)}</span><span>{num(r.errors)} · {num(r.throttled)}</span><span>{num(r.rerouted)}</span><span>{usd(r.cost_usd as number|null)}</span></div>)}</div>:<Empty loading={!usage}/>)}
  <div className="source-note">system.ai_gateway.usage · this workspace · as of {clock(usage?.queried_at)} · cost estimated at public list price{host&&<> · <a href={`${host}/ml/ai-gateway`} target="_blank" rel="noreferrer">Open Unity Gateway <ExternalLink size={11}/></a></>}</div>
 </div>;
}
