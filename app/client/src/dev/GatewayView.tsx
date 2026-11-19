import React,{useMemo,useState} from 'react';
import {AlertCircle,ArrowRight,BarChart3,CheckCircle2,ChevronDown,Code2,Database,ExternalLink,FileText,Gauge,KeyRound,Layers,Play,RefreshCw,Route,ShieldAlert,ShieldCheck,Sparkles,Terminal,Users,Wallet,Maximize2,X} from 'lucide-react';
import {OpenAIMark} from '../Brand';
import {PayloadList,useGuardrail} from './payloads';
import {GuardrailStory} from './GuardrailStory';
import {api,post} from '../api';
import {Empty,Waiter,WindowPicker,clock,modelKey,compact,failed,num,prettyModel,rows,secs,shortService,usd,usePresenter,useModelLabel,serviceLabel,OTHER_MODELS,type Overview,type Row,type Usage} from './shared';

type Probe={status:number;latency_ms:number;model?:string;text?:string;error?:string;error_code?:string;policy?:unknown};

// ---------------------------------------------------------------- map (static)
const CALLERS:[typeof Sparkles,string,string][]=[[Sparkles,'ShopiBricks agents','App service principal'],[Terminal,'Developers in Codex','Their own Databricks identity'],[Users,'Business users','ChatGPT × Genie, Databricks One'],[Layers,'Agent Bricks & apps','Governed agents']];
export function GatewayMap({overview}:{overview?:Overview}){
 const models=overview?.system_ai_models||[];
 const providers=useMemo(()=>{const groups:Record<string,number>={};for(const m of models){const k=modelKey(m.name);const p=/^gpt|^o\d/.test(k)?'OpenAI':/^claude/.test(k)?'Anthropic':/^gemini/.test(k)?'Google':/^(llama|meta)/.test(k)?'Meta':'Open & other';groups[p]=(groups[p]||0)+1;}return Object.entries(groups).sort((a,b)=>b[1]-a[1]);},[models]);
 const mcp=overview?.mcp_services||[];
 const {settings}=usePresenter();
 const shown=settings.anonymize?[...providers.filter(([p])=>p==='OpenAI'),...(()=>{const o=providers.filter(([p])=>p!=='OpenAI').reduce((t,[,n])=>t+n,0);return o?[['other providers',o] as [string,number]]:[];})()]:providers;
 return <div className="ug-map panel" aria-label="Unity Gateway architecture">
  <div className="ug-map-col"><span className="eyebrow">WHO CALLS</span>{CALLERS.map(([Icon,t,sub])=><div className="ug-node" key={t}><Icon size={16}/><div><strong>{t}</strong><small>{sub}</small></div></div>)}</div>
  <ArrowRight className="ug-arrow" size={20}/>
  <div className="ug-core"><span className="eyebrow">ONE CONTROL PLANE</span><h3>Unity Gateway</h3><p>Governance built on Unity Catalog, for models, MCP tools and coding agents.</p><div className="ug-chips">{['Identity & grants','Routing & fallback','Rate limits','Budgets','Guardrails','Payload logging','Usage & cost'].map(c=><span key={c}>{c}</span>)}</div></div>
  <ArrowRight className="ug-arrow" size={20}/>
  <div className="ug-map-col"><span className="eyebrow">WHAT IT GOVERNS</span>
   <div className="ug-node"><OpenAIMark/><div><strong>{models.length?`${models.length} model services`:'Model services'}</strong><small>{shown.map(([p,n])=>`${p} ${n}`).join(' · ')||'system.ai'}</small></div></div>
   <div className="ug-node"><Code2 size={16}/><div><strong>{mcp.length?`${mcp.length} MCP services`:'MCP services'}</strong><small>{mcp.slice(0,4).map(m=>m.name.split('.').pop()).join(', ')||'Governed tools'}</small></div></div>
   <div className="ug-node"><Database size={16}/><div><strong>Unity Catalog data</strong><small>Same permissions, same lineage</small></div></div>
  </div>
 </div>;
}

// ---------------------------------------------------------------- page
export function GatewayView({overview,usage,windowSize,onWindow,onRefresh,onRouted,host}:{overview?:Overview;usage?:Usage;windowSize:'1h'|'24h'|'7d';onWindow:(v:'1h'|'24h'|'7d')=>void;onRefresh:()=>void;onRouted:()=>void;host:string}){
 const {settings}=usePresenter();const bump=()=>undefined;
 const [focused,setFocused]=useState<string>();
 React.useEffect(()=>{if(!focused)return;const h=(e:KeyboardEvent)=>{if(e.key==='Escape')setFocused(undefined);};addEventListener('keydown',h);document.querySelector('.ug-control.focus')?.scrollIntoView({behavior:'smooth',block:'start'});return()=>removeEventListener('keydown',h);},[focused]);
 const cfg=overview?.config;
 return <>
  <div className="page-subhead"><div><span className="eyebrow">UNITY GATEWAY</span><h2>Every model call, <em>governed.</em></h2><p className="muted">One control plane between every caller and every model, tool and dataset. Each card below runs a real request through the gateway.</p></div><div className="ug-actions"><span className="ug-pill" title={overview?.service}>Service · {shortService(overview?.service)||'…'}</span><WindowPicker value={windowSize} onChange={onWindow}/><button className="icon-button" aria-label="Refresh Unity Gateway data" onClick={onRefresh}><RefreshCw size={16}/></button></div></div>
  {overview?.model_service?.error&&<div className="ug-alert"><AlertCircle size={15}/>{overview.model_service.error}</div>}
  <GatewayMap overview={overview}/>
  <FocusCtx.Provider value={{focused,setFocused}}>
  <div className={`ug-controls ${focused?'has-focus':''}`}>
   <IdentityCard overview={overview} onRun={bump}/>
   <RoutingCard overview={overview} onRouted={onRouted} onRun={bump}/>
   <RateLimitCard limits={cfg?.rate_limits} onRun={bump}/>
   {settings.showCosts&&<CostCard usage={usage} windowSize={windowSize}/>}
   <GuardrailCard onRun={bump}/>
   <PayloadCard table={cfg?.inference_table?.table}/>
  </div>
  </FocusCtx.Provider>
  <GuardrailStory host={host}/>
  <TrafficPanel usage={usage} windowSize={windowSize} host={host}/>
 </>;
}

// Focus mode: one card at a time can be maximised over the page. The card stays mounted, so its state survives.
const FocusCtx=React.createContext<{focused?:string;setFocused:(t?:string)=>void}>({setFocused:()=>undefined});
function Card({icon:Icon,title,status,statusText,children}:{icon:typeof ShieldCheck;title:string;status:'good'|'info'|'bad';statusText:string;children:React.ReactNode}){
 const {focused,setFocused}=React.useContext(FocusCtx);const isFocus=focused===title;
 return <div className={`ug-control ${isFocus?'focus':''}`} role={isFocus?'dialog':undefined} aria-label={isFocus?title:undefined}><div className="ug-control-head"><span className="protocol-icon"><Icon size={17}/></span><h3>{title}</h3><button className="icon-button ug-focus-btn" aria-label={isFocus?`Close ${title}`:`Focus on ${title}`} title={isFocus?'Close (Esc)':'Focus'} onClick={()=>setFocused(isFocus?undefined:title)}>{isFocus?<X size={16}/>:<Maximize2 size={15}/>}</button></div>{children}<span className={`status-text ${status==='good'?'good':status==='bad'?'bad':''}`}>{status==='good'?<CheckCircle2 size={11}/>:status==='bad'?<AlertCircle size={11}/>:<span className="tiny-dot"/>}{statusText}</span></div>;
}
const TryButton=({busy,disabled=false,onClick,children}:{busy:boolean;disabled?:boolean;onClick:()=>void;children:React.ReactNode})=><button className="ug-try" disabled={busy||disabled} onClick={onClick}>{busy?<RefreshCw size={13} className="spin"/>:<Play size={13}/>}{busy?'Running…':children}</button>;

type Identity={caller:string;caller_is_app:boolean;app_principal:string|null;rows:(Probe&{label:string;service:string;app_privileges:string[]|null})[]};
function IdentityCard({overview,onRun}:{overview?:Overview;onRun:()=>void}){
 const [busy,setBusy]=useState(false);const [result,setResult]=useState<Identity>();const [err,setErr]=useState('');
 const grants=overview?.grants?.privilege_assignments||[];
 async function run(){setBusy(true);setErr('');onRun();try{setResult(await post('/api/ug/try',{demo:'identity'}));}catch(e){setErr(e instanceof Error?e.message:'Failed');}finally{setBusy(false);}}
 const canRun=(p:string[]|null)=>!!p&&(p.includes('EXECUTE')||p.includes('ALL_PRIVILEGES'));
 return <Card icon={KeyRound} title="Identity & access" status={result?'good':'info'} statusText={result?'Checked as the ShopiBricks app’s service principal':`${grants.length} explicit grants on the concierge`}>
  <p>Every caller presents its own Databricks identity. Access is an <code>EXECUTE</code> grant on a Unity Catalog securable, never a shared API key.</p>
  <TryButton busy={busy} onClick={()=>void run()}>Call a granted and a restricted service</TryButton>
  {busy&&<Waiter text="Calling both services as the ShopiBricks app…" sub="Unity Gateway checks the EXECUTE grant before any model is reached."/>}
  {err&&<p className="ug-reasons">{err}</p>}
  {result&&<div className="ug-results">{result.rows.map(r=>{const allowed=result.caller_is_app?r.status<300:canRun(r.app_privileges);return <div key={r.service} className={`ug-result-line ${allowed?'good':'bad'}`}><span className="ug-code-pill">{result.caller_is_app?r.status:allowed?'ALLOWED':'DENIED'}</span><div><strong>{shortService(r.service)}</strong>
   <small>{allowed?(result.caller_is_app?`Answered in ${secs(r.latency_ms)}`:'EXECUTE granted to the ShopiBricks app'):(result.caller_is_app&&r.error_code?`${r.error_code} · no EXECUTE grant for the ShopiBricks app`:'No EXECUTE grant for the ShopiBricks app')}</small></div></div>;})}</div>}
 </Card>;
}

const SPLIT_COLORS:Record<string,string>={'gpt-6-luna':'#ff3621','gpt-6-1-terra':'#2a78c4','gpt-6-1-sol':'#d99a00','gpt-6-astra':'#1f9e6e'};
type Policy={service:string|null;models?:string[];destinations:{model:string;pct:number}[];fallback:string[]};
type Sent={destination:string|null;status:number;request_id?:string|null}[];
const color=(m:string)=>m==='pending'?'#dfe6e2':SPLIT_COLORS[m]||'#9aa7ab';
function PolicyBar({parts,label}:{parts:{model:string;value:number;tag?:string}[];label:string}){
 const total=parts.reduce((t,p)=>t+p.value,0)||1;
 return <div className="ug-split-bar" aria-label={label}>{parts.filter(p=>p.value>0).map(p=><span key={p.model+(p.tag||'')} className={p.tag?'rerouted':''} style={{width:`${p.value/total*100}%`,background:color(p.model)}} title={`${p.model==='pending'?'Not traced yet':prettyModel(p.model)}${p.tag?` · ${p.tag}`:''}: ${p.value}`}>{p.model==='pending'?'':p.value}</span>)}</div>;
}

/** One routing policy on one demo service: weighted primary destinations, a fallback, real traffic, and a simulated outage drill. */
/** The split the talk starts from: two OpenAI models share the traffic, a third is the fallback. */
const DEFAULT_SPLIT={weights:[{model:'gpt-6-luna',pct:50},{model:'gpt-6-1-terra',pct:50}],fallback:['gpt-6-1-sol']};
function RoutingCard({onRun}:{overview?:Overview;onRouted?:()=>void;onRun:()=>void}){
 const [policy,setPolicy]=useState<Policy>();const [draft,setDraft]=useState<Record<string,number>>({});const [fallback,setFallback]=useState('');
 const [saving,setSaving]=useState(false);const [sending,setSending]=useState(false);const [msg,setMsg]=useState('');const [sent,setSent]=useState<Sent>();const [down,setDown]=useState<string>();
 const sync=(x:Policy)=>{setPolicy(x);setDraft(Object.fromEntries((x.models||[]).map(m=>[m,x.destinations.find(d=>d.model===m)?.pct||0])));setFallback(x.fallback[0]||'');};
 React.useEffect(()=>{api<Policy>('/api/ug/split').then(sync).catch(()=>setPolicy({service:null,destinations:[],fallback:[]}));},[]);
 const models=policy?.models||[];const total=models.reduce((t,m)=>t+(draft[m]||0),0);const primaries=models.filter(m=>(draft[m]||0)>0);
 const dirty=!!policy&&(models.some(m=>(draft[m]||0)!==(policy.destinations.find(d=>d.model===m)?.pct||0))||fallback!==(policy.fallback[0]||''));
 const invalid=total!==100||!fallback||primaries.includes(fallback);
 const isDefault=!!policy&&policy.fallback[0]===DEFAULT_SPLIT.fallback[0]&&policy.destinations.length===DEFAULT_SPLIT.weights.length&&DEFAULT_SPLIT.weights.every(w=>policy.destinations.find(d=>d.model===w.model)?.pct===w.pct);
 async function apply(weights=primaries.map(m=>({model:m,pct:draft[m]})),fb=[fallback]){setSaving(true);setMsg('');try{const r=await post<Policy>('/api/ug/split',{weights,fallback:fb});sync({...r,models});setSent(undefined);setDown(undefined);setMsg('Policy applied on the model service. No code change, no redeploy.');}catch(e){setMsg(e instanceof Error?e.message:'Update failed');}finally{setSaving(false);}}
 const [tracing,setTracing]=useState(false);
 async function send(){setSending(true);setMsg('');setDown(undefined);onRun();let rows:Sent;
  try{rows=(await post<{rows:Sent}>('/api/ug/split/send',{})).rows;setSent(rows);}catch(e){setMsg(e instanceof Error?e.message:'Failed');setSending(false);return;}
  setSending(false);setTracing(true);
  // Destinations land in the inference table within seconds: fill the bar as they arrive.
  const ids=rows.map(r=>r.request_id).filter(Boolean) as string[];let found:Record<string,string>={};
  for(let i=0;i<15&&Object.keys(found).length<ids.length;i++){await new Promise(r=>setTimeout(r,i?1200:600));try{found=(await api<{served:Record<string,string>}>(`/api/ug/split/served?ids=${ids.join(',')}`)).served;setSent(rows.map(r=>({...r,destination:r.request_id?found[r.request_id]||null:null})));}catch{/* keep polling */}}
  setTracing(false);}
 if(!policy)return <Card icon={Route} title="Routing & fallback" status="info" statusText="Loading…"><Empty loading/></Card>;
 if(!policy.service)return <Card icon={Route} title="Routing & fallback" status="info" statusText="Not configured"><p>No routing demo service is configured.</p></Card>;
 const applied=policy.destinations;const fb=policy.fallback[0];
 const served=models.map(m=>({model:m,value:(sent||[]).filter(r=>r.destination===m).length}));const traced=(sent||[]).filter(r=>r.destination).length;
 // Drill: the down model's share is retried on the fallback. Simulated on top of the last real run, or the targets.
 const base=sent?served:applied.map(d=>({model:d.model,value:d.pct}));
 const drill=down&&fb?[...base.filter(p=>p.model!==down&&p.model!==fb),{model:fb,value:(base.find(p=>p.model===fb)?.value||0)},{model:fb,value:base.find(p=>p.model===down)?.value||0,tag:`rerouted from ${prettyModel(down)}`}]:undefined;
 return <Card icon={Route} title="Routing & fallback" status={applied.length?'good':'info'} statusText={`Policy on ${shortService(policy.service)} · fallback on 429 / 5xx`}>
  <div className="ug-policy">
   <span className="eyebrow">1 · PRIMARY DESTINATIONS · TRAFFIC SPLIT</span>
   {models.map(m=>{const isFb=m===fallback;return <label key={m} className={`ug-split-row ${isFb?'off':''}`}><i style={{background:color(m)}}/><span>{prettyModel(m)}</span><input type="range" min={0} max={100} step={5} disabled={isFb} value={isFb?0:draft[m]||0} onChange={e=>setDraft(d=>({...d,[m]:Number(e.target.value)}))} aria-label={`${prettyModel(m)} traffic percentage`}/><b>{isFb?'fallback':`${draft[m]||0}%`}</b></label>;})}
   <span className="eyebrow">2 · FALLBACK</span>
   <div className="ug-fallback"><select value={fallback} onChange={e=>{const v=e.target.value;setFallback(v);setDraft(d=>({...d,[v]:0}));}} aria-label="Fallback destination">{models.map(m=><option key={m} value={m}>{prettyModel(m)}</option>)}</select><small>Retried on this model when a primary returns 429 or 5xx</small></div>
   <div className="ug-policy-preview"><PolicyBar label="Configured split" parts={primaries.map(m=>({model:m,value:draft[m]||0}))}/><span className="ug-policy-arrow">→</span><span className="ug-fb-chip" style={{borderColor:color(fallback)}}><i style={{background:color(fallback)}}/>{prettyModel(fallback)}</span></div>
   <div className="ug-try-row"><TryButton busy={saving} disabled={invalid||!dirty} onClick={()=>void apply()}>{total!==100?`Total ${total}% · must be 100%`:dirty?'Apply policy':'Policy applied'}</TryButton><TryButton busy={sending} disabled={dirty} onClick={()=>void send()}>3 · Send 12 requests</TryButton>{!isDefault&&!saving&&<button className="text-button ug-reset" onClick={()=>void apply(DEFAULT_SPLIT.weights,DEFAULT_SPLIT.fallback)}>Reset demo policy</button>}</div>
   {saving&&<Waiter text="Writing the routing policy to the model service…" sub="Primary split and fallback, stored in Unity Catalog."/>}
   {sending&&<Waiter text="Sending 12 requests through Unity Gateway…" sub="Each request is routed by the traffic split."/>}
   {tracing&&<Waiter text="Tracing where each request went…" sub="Reading the served destinations from the inference table as they land."/>}
   {msg&&<small className="ug-split-msg">{msg}</small>}
   {sent&&<div className="ug-split-result"><span className="eyebrow">SERVED · FROM THE INFERENCE TABLE</span><PolicyBar label="Served destinations" parts={[...served,{model:'pending',value:sent.length-traced}]}/><small>{tracing?`Answered: ${sent.filter(r=>r.status<300).length} of ${sent.length} · tracing destinations ${traced}/${sent.length}… · `:`${traced} of ${sent.length} traced · `}{applied.map(d=>`${prettyModel(d.model)} ${served.find(p=>p.model===d.model)?.value||0} (target ${d.pct}%)`).join(' · ')}{fb&&(served.find(p=>p.model===fb)?.value||0)>0?` · ${prettyModel(fb)} ${served.find(p=>p.model===fb)?.value} via fallback`:''}</small></div>}
   {fb&&<div className="ug-drill"><span className="eyebrow">4 · OUTAGE DRILL · SIMULATED</span><div className="ug-try-row">{applied.map(d=><button key={d.model} className={`ug-drill-btn ${down===d.model?'active':''}`} onClick={()=>setDown(x=>x===d.model?undefined:d.model)}>{down===d.model?'Restore':'Take down'} {prettyModel(d.model)}</button>)}</div>
    {drill&&<><PolicyBar label="Traffic during the simulated outage" parts={drill}/><small>If {prettyModel(down!)} returns 429 or 5xx, the gateway retries those requests on {prettyModel(fb)}. Simulation: no model is taken down.</small></>}</div>}
  </div>
 </Card>;
}

type Limit={key:string;renewal_period:string;requests?:number|string;tokens?:number|string};
const SINGLE_HISTORY=10;
function RateLimitCard({limits,onRun}:{limits?:Limit[];onRun:()=>void}){
 const [spiking,setSpiking]=useState(false);const [spiked,setSpiked]=useState<{sent:number;seconds:number;at:string}>();
 const [single,setSingle]=useState(false);const [calls,setCalls]=useState<{n:number;status:number;at:string;latency:number}[]>([]);const [err,setErr]=useState('');
 async function spike(){setSpiking(true);setErr('');onRun();try{const r=await post<{sent:number;seconds:number}>('/api/ug/try',{demo:'spike'});setSpiked({...r,at:new Date().toISOString()});}catch(e){setErr(e instanceof Error?e.message:'Failed');}finally{setSpiking(false);}}
 async function one(){setSingle(true);setErr('');onRun();try{const r=await post<Probe>('/api/ug/try',{demo:'limit'});setCalls(c=>[{n:(c[0]?.n||0)+1,status:r.status,at:new Date().toISOString(),latency:r.latency_ms},...c].slice(0,SINGLE_HISTORY));}catch(e){setErr(e instanceof Error?e.message:'Failed');}finally{setSingle(false);}}
 const label=(k:string)=>k.replace('RATE_LIMIT_KEY_','').replace('USER_DEFAULT','Each user').replace('SERVICE_PRINCIPAL','Service principal').replace('USER_GROUP','Group').replace('SERVICE','Whole service').toLowerCase().replace(/^\w/,c=>c.toUpperCase());
 const last=calls[0];
 return <Card icon={Gauge} title="Rate limits" status={last?.status===429?'good':'info'} statusText={last?(last.status===429?'Throttled by the gateway · HTTP 429':`Served · HTTP ${last.status}`):'Per service, user, group or service principal'}>
  <ul className="ug-list">{(limits||[]).map((l,i)=><li key={i}><span>{label(l.key)}</span><b>{[l.requests&&`${num(l.requests)} req`,l.tokens&&`${compact(l.tokens)} tokens`].filter(Boolean).join(' · ')} / {l.renewal_period.endsWith('HOUR')?'hour':'min'}</b></li>)}</ul>
  <p className="muted small">Demo service: 1 request per minute.</p>
  <div className="ug-try-row"><TryButton busy={spiking} onClick={()=>void spike()}>Spike above the limit</TryButton><TryButton busy={single} onClick={()=>void one()}>Send 1 request</TryButton></div>
  {spiking&&<Waiter text="Spiking 8 requests at the 1-per-minute service…" sub="Back to back, like an agent stuck in a loop."/>}
  {single&&<Waiter text="Calling the rate-limited service…"/>}
  {err&&<p className="ug-reasons">{err}</p>}
  {spiked&&<div className="ug-result-line bad"><Gauge size={18}/><div><strong>Spiked above the limit</strong><small>{spiked.sent} requests in {spiked.seconds.toFixed(1)} s against 1 allowed per minute · {clock(spiked.at,true)}</small></div></div>}
  {calls.length>0&&<div className="ug-singles" aria-live="polite">{calls.map(c=><div key={c.n} className={`ug-single ${c.status<300?'ok':'no'}`}><span className="ug-code-pill">{c.status}</span><span>{c.status<300?'Served':c.status===429?'Too many requests':'Error'}</span><time>{clock(c.at,true)}</time></div>)}</div>}
 </Card>;
}

function CostCard({usage,windowSize}:{usage?:Usage;windowSize:string}){
 const label=useModelLabel(OTHER_MODELS);
 const [by,setBy]=useState<'consumer'|'model'|'service'>('model');
 const data=useMemo(()=>{const src=by==='service'?rows(usage?.services):rows(usage?.attribution);const acc=new Map<string,{cost:number;requests:number}>();for(const r of src){const k=by==='consumer'?String(r.consumer):by==='model'?label(String(r.destination_model||'')):serviceLabel(String(r.service_name||''),label);const v=acc.get(k)||{cost:0,requests:0};v.cost+=Number(r.cost_usd||0);v.requests+=Number(r.requests||0);acc.set(k,v);}return[...acc.entries()].filter(([k])=>k).sort((a,b)=>b[1].cost-a[1].cost).slice(0,6);},[usage,by,label]);
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
 return <Card icon={ShieldCheck} title="Guardrails" status={active?'good':'info'} statusText={active?`Last denial ${clock(guardrail!.last_denial!.event_time)} on ${shortService(guardrail!.service||'')}`:'Service policies · Beta'}>
  <p>Built-in and custom policies screen requests and responses: jailbreak and prompt injection, unsafe content, sensitive data.</p>
  <div className="ug-try-row"><TryButton busy={busy==='attack'} onClick={()=>void send('attack')}>Send a jailbreak</TryButton><TryButton busy={busy==='normal'} onClick={()=>void send('normal')}>Normal question</TryButton></div>
  {busy&&<Waiter text={busy==='attack'?'Sending a jailbreak through the guarded service…':'Sending a normal question through the guarded service…'} sub="The Jailbreak policy screens the request before the model."/>}
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
 const label=useModelLabel(OTHER_MODELS);
 const services=rows(usage?.services);const total=services.reduce((s,r)=>s+Number(r.requests||0),0);
 const [open,setOpen]=useState(false);
 return <div className="panel"><button className="ug-collapse" onClick={()=>setOpen(o=>!o)} aria-expanded={open}><span><BarChart3 size={16}/> Live traffic · {num(total)} requests across {services.length} model services · last {windowSize}</span><ChevronDown size={16}/></button>
  {open&&(failed(usage?.services)?<p className="ug-reasons">{failed(usage?.services)}</p>:services.length?<div className="ug-table ug-table-8"><div className="ug-th"><span>Service</span><span>Model</span><span>Requests</span><span>p50</span><span>p95</span><span>Errors · 429</span><span>Rerouted</span><span>Est. cost</span></div>{services.map((r,i)=><div className="ug-tr" key={i}><span><code>{serviceLabel(String(r.service_name||''),label)}</code></span><span>{r.destination_model?label(String(r.destination_model)):'—'}</span><span>{num(r.requests)}</span><span>{secs(r.p50_ms)}</span><span>{secs(r.p95_ms)}</span><span>{num(r.errors)} · {num(r.throttled)}</span><span>{num(r.rerouted)}</span><span>{usd(r.cost_usd as number|null)}</span></div>)}</div>:<Empty loading={!usage}/>)}
  <div className="source-note">system.ai_gateway.usage · this workspace · as of {clock(usage?.queried_at)} · cost estimated at public list price{host&&<> · <a href={`${host}/ml/ai-gateway`} target="_blank" rel="noreferrer">Open Unity Gateway <ExternalLink size={11}/></a></>}</div>
 </div>;
}
