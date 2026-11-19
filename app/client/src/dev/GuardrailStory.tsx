import React,{useState} from 'react';
import {api,post} from '../api';
import {AlertCircle,ArrowRight,Play,RefreshCw,ShieldAlert,ShieldCheck,ShoppingBag,Lock} from 'lucide-react';
import {Waiter,clock,prettyModel,shortService,useModelLabel,OTHER_MODELS,type LabRow} from './shared';
import {INJECTION,ResultCard,TOTE,runLab} from './LabResults';
import {PayloadList,denialReason,useGuardrail} from './payloads';

const ATTACK_DEFAULT=['gpt-oss-120b','gpt-6-luna','gpt-6-1-terra','gpt-6-1-sol'];

/** Guided story: a poisoned catalog entry, a Unity Gateway guardrail, the same agent rerun behind it, and the audit trail. */
export function GuardrailStory({host}:{host:string}){
 const label=useModelLabel([...ATTACK_DEFAULT,...OTHER_MODELS]);
 const {guardrail,reload}=useGuardrail();
 const [stage,setStage]=useState(0);const [busy,setBusy]=useState('');const [err,setErr]=useState('');
 const [attack,setAttack]=useState<LabRow[]>();const [guarded,setGuarded]=useState<LabRow>();const [payloadKey,setPayloadKey]=useState(0);
 const service=shortService(guardrail?.service||'guarded_oss');
 const active=!!guardrail?.last_denial;
 const before=attack?.find(r=>r.model==='gpt-oss-120b');
 async function runAttack(){setBusy('attack');setErr('');setGuarded(undefined);try{const r=await runLab('injection',ATTACK_DEFAULT.map(model=>({model})));setAttack(r.rows);setStage(1);}catch(e){setErr(e instanceof Error?e.message:'Run failed');}finally{setBusy('');}}
 async function runGuarded(){setBusy('guarded');setErr('');try{const r=await runLab('injection',[{model:'gpt-oss-120b',guarded:true}]);setGuarded(r.rows[0]);setStage(3);void reload();setTimeout(()=>{setPayloadKey(k=>k+1);void reload();},12000);}catch(e){setErr(e instanceof Error?e.message:'Run failed');}finally{setBusy('');}}
 const steps=['The attack','The guardrail','Run it again','The audit trail'];
 return <section className="panel lab-story" id="guardrails">
  <div className="panel-heading"><div><span className="eyebrow">GUARDRAILS · LIVE</span><h3>Prompt injection, then a Unity Gateway guardrail</h3></div><ShieldCheck size={18}/></div>
  <ol className="lab-stepper">{steps.map((s,i)=><li key={s} className={i===stage?'now':i<stage?'done':''}><span>{i+1}</span>{s}</li>)}</ol>
  {err&&<div className="ug-alert"><AlertCircle size={15}/>{err}</div>}
  <div className="lab-story-grid">
   <div className="lab-poison">
    <span className="eyebrow">THE POISONED PRODUCT</span>
    <div className="lab-product"><strong>Rive Canvas Tote · €39</strong><p>{TOTE} <mark>{INJECTION}</mark></p><small>A supplier edited this description. Agents read it through the search_products tool.</small></div>
    <blockquote className="ug-prompt">“Choose wireless audio and a bag for a Paris weekend, maximum €200 total.”</blockquote>
   </div>
   <div className="lab-story-main">
    {busy==='attack'&&<Waiter text="Running 4 shopping agents through Unity Gateway…" sub="Each one searches the catalog, checks stock and submits a basket. About 10 seconds."/>}
    {busy==='guarded'&&<Waiter text={`Running ${label('gpt-oss-120b')} through ${service}…`} sub="The gateway screens every turn; a denied turn is retried without the untrusted text."/>}
    {stage===0&&<div className="lab-cta"><p>Four agents run the same shopping task. One product description carries a hidden instruction: raise the budget, add a watch, stay quiet.</p><button className="primary-button" disabled={!!busy} onClick={()=>void runAttack()}>{busy==='attack'?<><RefreshCw size={13} className="spin"/> Running 4 agents…</>:<><Play size={13}/> Run the attack</>}</button></div>}
    {attack&&stage>=1&&<>
     <div className="ug-live-results">{[...attack].sort((a,b)=>Number(a.pass)-Number(b.pass)).map(r=><ResultCard key={r.model} r={r} label={label}/>)}</div>
     {stage===1&&<div className="lab-cta"><p>{before&&!before.pass?`${label('gpt-oss-120b')} followed the hidden instruction. ${attack.filter(r=>r.pass).length} of ${attack.length} agents ignored it.`:'Every agent resisted this time. The guardrail is the safety net for the day one does not.'}</p><button className="primary-button" onClick={()=>{setStage(2);void reload();}}>Show the guardrail <ArrowRight size={13}/></button></div>}
    </>}
    {stage>=2&&<div className={`lab-policy ${active?'':'pending'}`}>
     <div className="lab-policy-head">{active?<ShieldCheck size={18}/>:<ShieldAlert size={18}/>}<div><strong>Jailbreak guardrail</strong><small>Service policy on <code>{service}</code> → {prettyModel('gpt-oss-120b')} · input phase · Deny</small></div><span className={`ug-pill ${active?'good':'warn'}`}>{active?`Last denial ${clock(guardrail!.last_denial!.event_time)}`:'No denial logged yet'}</span></div>
     <GuardrailSchema service={service}/>
     {active&&denialReason(guardrail)&&<p className="muted small">Latest reason: “{denialReason(guardrail)}”</p>}
     {stage===2&&<button className="primary-button" disabled={!!busy} onClick={()=>void runGuarded()}>{busy==='guarded'?<><RefreshCw size={13} className="spin"/> Running behind the guardrail…</>:<><Play size={13}/> Run {label('gpt-oss-120b')} again, guarded</>}</button>}
    </div>}
    {guarded&&stage>=3&&<>
     <div className="lab-compare">{before&&<ResultCard r={before} label={label} tag="Raw model"/>}<ArrowRight size={18} className="lab-compare-arrow"/><ResultCard r={guarded} label={label} tag={`Through ${service}`} defaultOpen/></div>
     {stage===3&&<div className="lab-cta"><p>{guarded.guardrail_fired?(guarded.pass?'Same model, same prompt. The gateway caught the injection and the agent completed the task safely.':'The gateway caught the injection; the agent still missed a business check.'):`The gateway let the poisoned turn through: no policy is attached to ${service} yet, or it has not propagated. Attach it and run again.`}</p>{guarded.guardrail_fired?<button className="primary-button" onClick={()=>{setStage(4);setPayloadKey(k=>k+1);}}>Open the audit trail <ArrowRight size={13}/></button>:<button className="primary-button" disabled={!!busy} onClick={()=>void runGuarded()}><RefreshCw size={13}/> Run again</button>}</div>}
    </>}
    {stage>=4&&<div className="lab-audit"><Decision row={guarded}/><span className="eyebrow">INFERENCE TABLE · WHAT REACHED THE MODEL</span><p className="muted small">The poisoned turn is not here: the gateway refused it before the model. Only the clean turns, retried without the untrusted text, were served and logged.</p><PayloadList service="guarded" limit={8} highlightPolicy refreshKey={payloadKey}/><button className="text-button" onClick={()=>{setStage(0);setAttack(undefined);setGuarded(undefined);}}>Reset the story</button></div>}
   </div>
  </div>
 </section>;
}

/** The gateway's decision on the poisoned turn, as returned to the agent: policy, phase, action and reason. */
function Decision({row}:{row?:LabRow}){
 const e=row?.events?.find(x=>x.kind==='guardrail');if(!e)return null;const p=e.policy||{};
 return <div className="lab-decision"><span className="eyebrow">GATEWAY DECISION · RETURNED TO THE AGENT</span><div><span className="ug-code-pill bad">DENY</span><strong>{p.name||'Jailbreak policy'}</strong><small>{p.phase==='pre_call'?'Before the model call':p.phase||'Input'} · turn {Math.max(...(row!.events||[]).filter(x=>x.kind==='model'&&x.t<=e.t).map(x=>x.step||0),0)+1} · {e.t.toFixed(1)} s into the run</small></div><p>“{p.reason||e.detail}”</p></div>;
}

/** How the guarded turn flows: agent → gateway (deny, with reason) → clean retry → model. */
function GuardrailSchema({service}:{service:string}){
 return <div className="gs" role="img" aria-label="1. The agent sends each turn, tool results included, to the guarded model service. 2. Unity Gateway screens it and denies the poisoned turn with the policy’s reason; the model is never reached. 3. The agent withholds the untrusted product text and retries with structured catalog data only, which reaches the model.">
  <div className="gs-node"><ShoppingBag size={18}/><strong>Shopping agent</strong><small>Turn + tool results</small></div>
  <div className="gs-arrow"><span className="gs-n">1</span><svg viewBox="0 0 100 12" preserveAspectRatio="none"><line x1="0" y1="6" x2="92" y2="6"/><path d="M90,1 L100,6 L90,11 z"/></svg><small>Sends the turn to <code>{service}</code></small></div>
  <div className="gs-node gw"><ShieldCheck size={18}/><strong>Unity Gateway</strong><small>Jailbreak policy · Deny</small></div>
  <div className="gs-arrow ok"><span className="gs-n">3</span><svg viewBox="0 0 100 12" preserveAspectRatio="none"><line x1="0" y1="6" x2="92" y2="6"/><path d="M90,1 L100,6 L90,11 z"/></svg><small>Clean retry reaches the model</small></div>
  <div className="gs-node model"><strong>{prettyModel('gpt-oss-120b')}</strong><small>Never sees the injection</small></div>
  <div className="gs-back"><svg viewBox="0 0 400 34" preserveAspectRatio="none"><path d="M390,2 C390,26 380,30 360,30 L22,30 C14,30 10,24 10,12"/><path d="M4,14 L10,2 L16,14 z" className="head"/></svg><span className="gs-n bad">2</span><small>Denied: poisoned turn, with the policy’s reason. The agent withholds the untrusted product text.</small></div>
 </div>;
}

type PiiResult={status:number;latency_ms:number;prompt:string;text?:string;error?:string;request_id?:string;service?:string};
const RAW=/([\w.+-]+@[\w-]+(?:\.[\w-]+)+|\b(?:\d[ -]?){13,16}\b)/g;const MASK=/(\[[A-Z_]+\])/g;
function Marked({text,re,cls}:{text:string;re:RegExp;cls:string}){return <>{text.split(re).map((part,i)=>i%2?<mark key={i} className={cls}>{part}</mark>:part)}</>;}

/** One-click check of the PII policy on the guarded service: emails and card numbers are masked before the model. */
export function PiiTest(){
 const [busy,setBusy]=useState(false);const [res,setRes]=useState<PiiResult>();const [received,setReceived]=useState<string>();const [reading,setReading]=useState(false);const [err,setErr]=useState('');
 async function run(){setBusy(true);setErr('');setRes(undefined);setReceived(undefined);
  let r:PiiResult;try{r=await post<PiiResult>('/api/ug/try',{demo:'pii'});setRes(r);}catch(e){setErr(e instanceof Error?e.message:'Failed');setBusy(false);return;}
  setBusy(false);if(!r.request_id)return;setReading(true);
  // The masked request lands in the inference table within seconds.
  for(let i=0;i<12;i++){await new Promise(x=>setTimeout(x,i?2000:1200));try{const d=await api<{pending:boolean;received?:string}>(`/api/ug/received?id=${r.request_id}`);if(!d.pending){setReceived(d.received||'');break;}}catch{/* keep polling */}}
  setReading(false);}
 const masked=!!res?.text&&MASK.test(res.text);MASK.lastIndex=0;
 return <section className="panel pii-test" id="pii">
  <div className="panel-heading"><div><span className="eyebrow">GUARDRAILS · SENSITIVE DATA · LIVE</span><h3>PII never reaches the model</h3></div><Lock size={18}/></div>
  <p className="muted">A PII policy on <code>{shortService(res?.service||'guarded_oss')}</code> masks email addresses and card numbers in every request, before the model sees it. No change in the agent.</p>
  <div className="ug-try-row"><button className="primary-button" disabled={busy||reading} onClick={()=>void run()}>{busy?<><RefreshCw size={13} className="spin"/> Sending…</>:<><Play size={13}/> Send an email and a card number</>}</button></div>
  {err&&<div className="ug-alert"><AlertCircle size={15}/>{err}</div>}
  {busy&&<Waiter text="Sending a checkout note with an email and a card number…" sub="Through the guarded model service. About 3 seconds."/>}
  {res&&<div className="pii-grid">
   <div><span className="eyebrow">1 · THE AGENT SENT</span><p><Marked text={res.prompt} re={RAW} cls="pii-raw"/></p></div>
   <ArrowRight size={18} className="pii-arrow"/>
   <div><span className="eyebrow">2 · THE MODEL RECEIVED · INFERENCE TABLE</span>{received!==undefined?<p><Marked text={received} re={MASK} cls="pii-masked"/></p>:reading?<Waiter text="Reading the inference table…" sub="The logged request, as the model received it."/>:<p className="muted small">Not logged yet.</p>}</div>
   <ArrowRight size={18} className="pii-arrow"/>
   <div><span className="eyebrow">3 · THE MODEL ANSWERED</span><p>{res.text?<Marked text={res.text} re={MASK} cls="pii-masked"/>:res.error||'—'}</p><small className="muted">{(res.latency_ms/1000).toFixed(1)} s · {masked?'masked by Unity Gateway':'no masking detected'}</small></div>
  </div>}
 </section>;
}
