import {useState} from 'react';
import {Database,RefreshCw,Search} from 'lucide-react';
import {api} from './api';
type Payload={event_time:string;request_id:string;status_code:string;latency_ms:string;destination_model:string;request:string;response:string};
export function InferenceExplorer({scope='concierge'}:{scope?:'concierge'|'lab'}){
 const [data,setData]=useState<{rows:Payload[];configured:boolean;errors?:{error:string}[];queried_at?:string}>();const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [selected,setSelected]=useState<Payload>();
 async function load(){setBusy(true);setError('');try{setData(await api(`/api/ug/inference?table=${scope}`));}catch(e){setError(String(e));}finally{setBusy(false);}}
 const pretty=(s:string)=>{try{return JSON.stringify(JSON.parse(s),null,2);}catch{return s;}};
 return <section className="panel inference-explorer"><div className="panel-heading"><div><span className="eyebrow">INFERENCE TABLES · UNITY CATALOG</span><h3>Open the evidence behind a model call.</h3></div><button className="text-button" onClick={()=>void load()} disabled={busy}><RefreshCw size={14}/>{busy?'Reading Delta…':data?'Refresh payloads':'Load real payloads'}</button></div><p className="muted">Gateway stores the request and response in Delta. Select a call to inspect the exact prompt, tool calls and output, then use that evidence for evaluation.</p>
 {error&&<p className="ug-alert" role="alert">{error}</p>}
 {!data&&!busy&&<div className="inference-intro"><Database size={26}/><span>Model call → Gateway logging → Delta table → evaluation dataset</span></div>}
 {data&&!data.rows.length&&<p className="empty-state">{data.configured?'No payloads available yet. Run a scenario, then refresh after Gateway logging has caught up.':'Inference logging is not configured on this deployment.'}{data.errors?.length?` ${data.errors.length} table(s) could not be read.`:''}</p>}
 {!!data?.rows.length&&<div className="inference-layout"><div className="payload-list">{data.rows.map((r,i)=><button key={r.request_id+i} className={selected===r?'active':''} onClick={()=>setSelected(r)}><span>{new Date(r.event_time).toLocaleTimeString('en-GB')} · {r.destination_model}</span><strong>{r.status_code} · {(Number(r.latency_ms)/1000).toFixed(2)} s</strong><small>{r.request_id}</small><Search size={13}/></button>)}</div><div className="payload-detail">{selected?<><span className="eyebrow">REQUEST</span><pre>{pretty(selected.request)}</pre><span className="eyebrow">RESPONSE</span><pre>{pretty(selected.response)}</pre></>:<p>Select a model call to inspect its payload.</p>}</div></div>}
 <div className="source-note">Real Gateway inference tables · payloads may take several minutes to arrive · previews limited to 16 KB per field.</div></section>;
}
