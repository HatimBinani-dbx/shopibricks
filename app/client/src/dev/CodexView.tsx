import React,{useEffect,useMemo,useState} from 'react';
import {AlertCircle,CheckCircle2,Copy,ExternalLink,RefreshCw,Terminal} from 'lucide-react';
import {api} from '../api';
import {OpenAIMark} from '../Brand';
import {Empty,OPENAI,OTHER,THIRD,Waiter,WindowPicker,clock,compact,failed,num,prettyModel,rows,secs,usd,usePresenter,isOpenAI,type Bench,type BenchModel,type Overview,type Row} from './shared';

type Codex={window:string;queried_at:string;sessions?:Row[]|{error:string};models?:Row[]|{error:string}};
type Req={event_time:string;destination_model:string;status_code:string;latency_ms:string;input_tokens:string;cached_tokens:string;output_tokens:string;reasoning_tokens:string;cost_usd:number|null};
const n=(v:unknown)=>Number(v||0);
const duration=(a:unknown,b:unknown)=>{const ms=new Date(String(b)).getTime()-new Date(String(a)).getTime();if(!(ms>0))return'—';const m=Math.round(ms/60000);return m<1?'<1 min':m<60?`${m} min`:`${Math.floor(m/60)} h ${m%60} min`;};

export function CodexView({overview,host}:{overview?:Overview;host:string}){
 const {settings}=usePresenter();
 const [win,setWin]=useState<'1h'|'24h'|'7d'>('7d');const [data,setData]=useState<Codex>();const [error,setError]=useState('');
 const load=(refresh=false)=>api<Codex>(`/api/ug/codex?window=${win}${refresh?'&refresh=1':''}`).then(d=>{setData(d);setError('');}).catch(e=>setError(e.message));
 useEffect(()=>{void load();const id=setInterval(()=>void load(),30000);return()=>clearInterval(id);},[win]);
 const sessions=rows(data?.sessions);const [selected,setSelected]=useState<string>();
 useEffect(()=>{if(!selected&&sessions.length)setSelected(String([...sessions].sort((a,b)=>n(b.requests)-n(a.requests))[0].session_id));},[sessions.length]);
 const t=useMemo(()=>{const s={requests:0,input:0,cached:0,output:0,cost:0,nocache:0};for(const r of sessions){s.requests+=n(r.requests);s.input+=n(r.input_tokens);s.cached+=n(r.cached_tokens);s.output+=n(r.output_tokens);s.cost+=n(r.cost_usd);s.nocache+=n(r.cost_without_cache_usd);}return s;},[sessions]);
 const devs=new Set(sessions.map(r=>String(r.requester))).size;const hit=t.input?t.cached/t.input:0;const saving=t.nocache>0?1-t.cost/t.nocache:0;
 return <>
  <div className="page-subhead"><div><span className="eyebrow">CODEX × UNITY GATEWAY</span><h2>Ship faster with Codex.<br/><em>Govern it like production.</em></h2><p className="muted">Real Codex sessions on this repository, on GPT models, through the workspace’s Unity Gateway. Codex keeps its sandbox and approvals; every model request carries the developer’s identity.</p></div><div className="ug-actions"><WindowPicker value={win} onChange={setWin}/><button className="icon-button" aria-label="Refresh Codex usage" onClick={()=>void load(true)}><RefreshCw size={16}/></button></div></div>
  <SetupLine host={host}/>
  {error&&<div className="ug-alert"><AlertCircle size={15}/>{error}</div>}
  {failed(data?.sessions)&&<div className="ug-alert"><AlertCircle size={15}/>{failed(data?.sessions)}</div>}
  <div className="metric-grid lab-kpis">
   <div className="metric hero"><span className="eyebrow">PROMPT CACHE HIT RATE</span><strong className="ug-hero">{t.input?`${Math.round(hit*100)}%`:'—'}</strong><span className="muted">of {compact(t.input)} input tokens served from the OpenAI prompt cache</span></div>
   {settings.showCosts&&<div className="metric"><span className="eyebrow">ESTIMATED SPEND</span><strong className="ug-hero">{usd(t.cost)}</strong><span className="muted">{t.nocache>0?`instead of ${usd(t.nocache)} without caching · ${Math.round(saving*100)}% saved`:'public list price'}</span></div>}
   <div className="metric"><span className="eyebrow">CODEX SESSIONS</span><strong className="ug-hero">{num(new Set(sessions.map(r=>String(r.session_id))).size)}</strong><span className="muted">{num(t.requests)} model requests · {devs} developer{devs===1?'':'s'} · last {win}</span></div>
   <div className="metric"><span className="eyebrow">MODELS</span><strong className="ug-hero lab-models">{rows(data?.models).map(m=>prettyModel(String(m.destination_model))).join(' · ')||'—'}</strong><span className="muted">{compact(t.output)} output tokens</span></div>
  </div>
  <div className="codex-explorer panel">
   <div className="panel-heading"><h3>Session explorer</h3><span className="eyebrow">CLICK A SESSION</span></div>
   {sessions.length?<div className="codex-grid">
    <div className="codex-sessions" role="listbox" aria-label="Codex sessions">{sessions.map(r=>{const id=String(r.session_id);const h=n(r.input_tokens)?n(r.cached_tokens)/n(r.input_tokens):0;return <button key={`${id}${r.destination_model}`} role="option" aria-selected={selected===id} className={selected===id?'active':''} onClick={()=>setSelected(id)}>
     <div className="codex-s-top"><strong>{prettyModel(String(r.destination_model))}</strong><span>{clock(r.started)} · {duration(r.started,r.last_event)}</span></div>
     <div className="codex-s-mid"><span>{num(r.requests)} requests</span><span>{compact(r.input_tokens)} in</span>{settings.showCosts&&<span>{usd(r.cost_usd as number)}</span>}</div>
     <span className="codex-cachebar" title={`${Math.round(h*100)}% cached`}><i style={{width:`${h*100}%`}}/></span>
     <small>{String(r.requester)} · Codex {String(r.version||'')}</small>
    </button>;})}</div>
    <SessionDetail id={selected} showCosts={settings.showCosts}/>
   </div>:<Empty loading={!data} text="No Codex sessions in this window. Start one with ug codex."/>}
   <div className="source-note">system.ai_gateway.usage · coding agent = Codex only · developer names masked{host&&<> · <a href={`${host}/ml/ai-gateway`} target="_blank" rel="noreferrer">Usage dashboard <ExternalLink size={11}/></a></>}</div>
  </div>
  <BetterTogether cacheHit={t.input?hit:undefined} saving={saving>0?saving:undefined}/>
 </>;
}

function SessionDetail({id,showCosts}:{id?:string;showCosts:boolean}){
 const [data,setData]=useState<{requests:Req[]}>();const [busy,setBusy]=useState(false);const [hover,setHover]=useState<number>();
 useEffect(()=>{if(!id)return;setBusy(true);setData(undefined);api<{requests:Req[]}>(`/api/ug/codex/session?id=${encodeURIComponent(id)}`).then(setData).catch(()=>setData({requests:[]})).finally(()=>setBusy(false));},[id]);
 const reqs=data?.requests||[];
 const max=Math.max(...reqs.map(r=>n(r.input_tokens)+n(r.output_tokens)),1);
 const tot=reqs.reduce((s,r)=>({inp:s.inp+n(r.input_tokens),cached:s.cached+n(r.cached_tokens),out:s.out+n(r.output_tokens),cost:s.cost+n(r.cost_usd)}),{inp:0,cached:0,out:0,cost:0});
 const h=hover!==undefined?reqs[hover]:undefined;
 if(!id)return <div className="codex-detail"><Empty text="Select a session."/></div>;
 return <div className="codex-detail">
  {busy&&<Waiter text="Loading this session’s requests…" sub="From system.ai_gateway.usage, request by request."/>}
  {!busy&&reqs.length>0&&<>
   <div className="codex-d-kpis"><div><span>Requests</span><b>{num(reqs.length)}</b></div><div><span>Duration</span><b>{duration(reqs[0].event_time,reqs[reqs.length-1].event_time)}</b></div><div><span>Context served from cache</span><b>{tot.inp?Math.round(tot.cached/tot.inp*100):0}%</b></div>{showCosts&&<div><span>Session cost</span><b>{usd(tot.cost)}</b></div>}</div>
   <div className="codex-chart" onMouseLeave={()=>setHover(undefined)}>
    <div className="codex-bars" role="img" aria-label={`Tokens per request for ${reqs.length} requests: cached input, fresh input and output`}>{reqs.map((r,i)=>{const c=n(r.cached_tokens),f=Math.max(n(r.input_tokens)-c,0),o=n(r.output_tokens);return <span key={i} className={`codex-bar ${hover===i?'hot':''}`} onMouseEnter={()=>setHover(i)} style={{height:`${(c+f+o)/max*100}%`}}>
     <i style={{background:THIRD,flexGrow:o||0.0001}}/><i style={{background:OPENAI,flexGrow:f||0.0001}}/><i style={{background:OTHER,flexGrow:c||0.0001}}/></span>;})}</div>
    <div className="codex-axis"><span>{clock(reqs[0].event_time)}</span><span>Context grows with every turn; the cache keeps it cheap</span><span>{clock(reqs[reqs.length-1].event_time)}</span></div>
    {h&&<div className="codex-tip"><strong>Request {hover!+1} · {clock(h.event_time,true)}</strong><span><i style={{background:OTHER}}/>Cached input {num(h.cached_tokens)}</span><span><i style={{background:OPENAI}}/>Fresh input {num(n(h.input_tokens)-n(h.cached_tokens))}</span><span><i style={{background:THIRD}}/>Output {num(h.output_tokens)}{n(h.reasoning_tokens)?` (${num(h.reasoning_tokens)} reasoning)`:''}</span><span>{secs(h.latency_ms)}{showCosts?` · ${usd(h.cost_usd)}`:''}</span></div>}
   </div>
   <div className="ug-legend codex-legend"><i style={{background:OTHER}}/>Cached input<i style={{background:OPENAI}}/>Fresh input<i style={{background:THIRD}}/>Output</div>
  </>}
  {!busy&&data&&reqs.length===0&&<Empty text="No requests found for this session."/>}
 </div>;
}

/** The whole setup, in one line: ug signs the developer in with Databricks OAuth and points Codex at Unity Gateway. */
function SetupLine({host}:{host:string}){
 const [copied,setCopied]=useState(false);
 const command=`ug codex --workspace ${host||'https://<workspace>'}`;
 return <div className="codex-setup"><Terminal size={16}/><span className="codex-setup-label">Setup, in one line</span><code>{command}</code><span className="codex-setup-note">Databricks sign-in · no API key</span><button className="icon-button" aria-label="Copy command" onClick={()=>{void navigator.clipboard.writeText(command);setCopied(true);setTimeout(()=>setCopied(false),1500);}}>{copied?<CheckCircle2 size={14}/>:<Copy size={14}/>}</button></div>;
}

/** Closing visual: what each partner brings, and what the combination delivers. Figures are read live from the app. */
function BetterTogether({cacheHit,saving}:{cacheHit?:number;saving?:number}){
 const [bench,setBench]=useState<Bench>();useEffect(()=>{api<Bench>('/api/ug/bench').then(setBench).catch(()=>undefined);},[]);
 const facts=useMemo(()=>{if(!bench)return undefined;const pts=bench.models.filter(m=>m.cost_per_success_usd!=null).sort((a,b)=>a.cost_per_success_usd!-b.cost_per_success_usd!);const front:BenchModel[]=[];let best=-1;for(const m of pts)if(m.success_rate>best){front.push(m);best=m.success_rate;}
  const perfect=pts.filter(m=>m.success_rate===1);const o=perfect.find(m=>isOpenAI(m.provider)),x=perfect.find(m=>!isOpenAI(m.provider));
  return{allOpenAI:front.length>0&&front.every(m=>isOpenAI(m.provider)),ratio:o&&x?x.cost_per_success_usd!/o.cost_per_success_usd!:0};},[bench]);
 const openai:[string,string,string][]=[
  [facts?.allOpenAI?'100%':'Frontier','of the price-performance frontier','GPT models win the cost per successful task on our agent task'],
  [cacheHit!=null?`${Math.round(cacheHit*100)}%`:'Cache','of Codex context from the prompt cache',saving!=null?`Long coding sessions cost ${Math.round(1/(1-saving))}× less`:'Long coding sessions stay affordable'],
  ['1 API','for agents and developers','Responses API in the app, the same models in Codex'],
 ];
 const databricks:[string,string,string][]=[
  ['1 gateway','for every model call','Identity, routing, limits, guardrails and audit, without touching agent code'],
  ['Your data','governed in Unity Catalog','Lakebase, Delta, Vector Search and Genie under the user’s permissions'],
  ['Every call','logged in Delta','Inference tables and usage system tables, queryable in SQL'],
 ];
 const together:[string,string][]=[
  ['Agents in production','Frontier intelligence on governed data, not a demo on a laptop.'],
  [facts?.ratio&&facts.ratio>1.5?`${Math.round(facts.ratio)}× cheaper at 100%`:'Best cost per task','Pick the model on cost per successful task, switch it without a redeploy.'],
  ['Developers, governed','Codex with their Databricks identity, the same rules as production.'],
 ];
 const Col=({items,kind}:{items:[string,string,string][];kind:string})=><ul className={`bt-list ${kind}`}>{items.map(([big,line,sub])=><li key={line}><b>{big}</b><div><strong>{line}</strong><span>{sub}</span></div></li>)}</ul>;
 return <section className="bt" aria-label="OpenAI and Databricks, better together">
  <div className="bt-head"><div className="bt-logos"><img src="/brand/openai-wordmark.svg" alt="OpenAI"/><span aria-hidden="true">×</span><img src="/brand/databricks.svg" alt="Databricks"/></div></div>
  <div className="bt-grid">
   <div className="bt-card openai"><div className="bt-card-head"><OpenAIMark/><div><span className="eyebrow">OPENAI BRINGS</span><h3>The intelligence</h3></div></div><Col items={openai} kind="openai"/></div>
   <div className="bt-x" aria-hidden="true">×</div>
   <div className="bt-card dbx"><div className="bt-card-head"><img src="/brand/databricks.svg" alt="" className="bt-dbx-logo"/><div><span className="eyebrow">DATABRICKS BRINGS</span><h3>The governance and your data</h3></div></div><Col items={databricks} kind="dbx"/></div>
  </div>
  <div className="bt-equals" aria-hidden="true">=</div>
  <div className="bt-together">{together.map(([t,d])=><div key={t}><strong>{t}</strong><span>{d}</span></div>)}</div>
 </section>;
}
