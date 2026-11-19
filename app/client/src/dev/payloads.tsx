import React,{useEffect,useState} from 'react';
import {ChevronDown,RefreshCw} from 'lucide-react';
import {api} from '../api';
import {Empty,Waiter,clock,prettyModel,secs,summarizePayload,type Row} from './shared';

export type Guardrail={service:string|null;last_denial:{event_time:string;response:string}|null;queried_at?:string};
/** Service policies have no public read API: status comes from the last denial logged in the guarded service's inference table. */
export function useGuardrail(){const [g,setG]=useState<Guardrail>();const load=()=>api<Guardrail>('/api/ug/guardrail').then(setG).catch(()=>setG({service:null,last_denial:null}));useEffect(()=>{void load();},[]);return{guardrail:g,reload:load};}
export const denialReason=(g?:Guardrail)=>{if(!g?.last_denial)return'';try{const p=JSON.parse(g.last_denial.response).databricks_service_policy;return String(p?.reason||JSON.stringify(p)).slice(0,160);}catch{return'';}};

export function PayloadList({service,limit=6,highlightPolicy=false,refreshKey=0}:{service:'concierge'|'guarded';limit?:number;highlightPolicy?:boolean;refreshKey?:number}){
 const [data,setData]=useState<{table:string|null;rows:Row[];queried_at?:string}>();const [open,setOpen]=useState<number>();const [busy,setBusy]=useState(false);
 const load=()=>{setBusy(true);api<{table:string|null;rows:Row[]}>(`/api/ug/payloads?service=${service}&limit=${limit}`).then(setData).catch(()=>setData({table:null,rows:[]})).finally(()=>setBusy(false));};
 useEffect(()=>{load();},[service,refreshKey]);
 return <div className="ug-payloads">
  <div className="ug-payload-head"><code>{data?.table?.split('.').pop()||'inference table'}</code><button className="icon-button" aria-label="Refresh inference table" onClick={load}><RefreshCw size={14} className={busy?'spin':''}/></button></div>
  {busy&&!data&&<Waiter text="Reading the inference table…" sub="Latest requests and responses, from Delta."/>}
  {data&&!data.table&&<Empty text="No inference table on this service."/>}
  {data?.rows.length===0&&data.table&&<Empty text="No rows yet. Payloads usually land within a minute."/>}
  {data?.rows.map((r,i)=>{const s=summarizePayload(String(r.request||''),String(r.response||''));const denied=!!s.policy;return <div key={i} className={`ug-payload ${denied&&highlightPolicy?'denied':''} ${open===i?'open':''}`}>
   <button className="ug-payload-row" onClick={()=>setOpen(o=>o===i?undefined:i)} aria-expanded={open===i}><span className={`ug-code-pill ${Number(r.status_code)>=400||denied?'bad':''}`}>{denied?'DENY':String(r.status_code)}</span><span className="ug-payload-time">{clock(r.event_time,true)}</span><span className="ug-payload-model">{s.agent||prettyModel(String(r.destination_model||''))}</span><span className="ug-payload-text">{denied?s.policy:s.output||s.input}</span><ChevronDown size={14}/></button>
   {open===i&&<div className="ug-payload-body"><div><span className="eyebrow">REQUEST · LAST INPUT</span><pre>{s.input||'—'}</pre>{s.tools>0&&<small className="muted">{s.tools} tool results in the request</small>}</div><div><span className="eyebrow">{denied?'POLICY DECISION':'RESPONSE'}</span><pre>{denied?s.policy:s.output||'—'}</pre></div><small className="muted">{prettyModel(String(r.destination_model||''))} · {secs(r.latency_ms)} · {String(r.requester||'')}</small></div>}
  </div>;})}
 </div>;
}
