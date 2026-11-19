import React,{useEffect,useMemo,useState} from 'react';
import {AlertCircle,ExternalLink,Sparkles} from 'lucide-react';
import {api} from '../api';
import {OPENAI,OTHER,isOpenAI,num,providerOf,usd,useModelLabel,usePresenter,type Bench,type BenchModel,type LabRow} from './shared';
import {ResultCard,runLab} from './LabResults';

/** Models on the cost/quality frontier: each is strictly better than every cheaper model. */
function frontier(models:BenchModel[]){const pts=models.filter(m=>m.cost_per_success_usd!=null).sort((a,b)=>a.cost_per_success_usd!-b.cost_per_success_usd!);const out:BenchModel[]=[];let best=-1;for(const m of pts)if(m.success_rate>best){out.push(m);best=m.success_rate;}return out;}

export function ModelLab(){
 const [bench,setBench]=useState<Bench>();const [error,setError]=useState('');
 useEffect(()=>{api<Bench>('/api/ug/bench').then(setBench).catch(e=>setError(e.message));},[]);
 const label=useModelLabel((bench?.models||[]).map(m=>m.model).concat(['gpt-oss-120b','claude-sonnet-5-5','claude-opus-5-5','gemini-3-8-flash','glm-5-3']));
 const {settings}=usePresenter();
 const pitch=useMemo(()=>{if(!bench)return undefined;const ms=bench.models;const f=frontier(ms);
  const perfect=ms.filter(m=>m.success_rate===1&&m.cost_per_success_usd!=null).sort((a,b)=>a.cost_per_success_usd!-b.cost_per_success_usd!);
  const bestOpenAI=perfect.find(m=>isOpenAI(m.provider));const bestOther=perfect.find(m=>!isOpenAI(m.provider));
  const prop=ms.filter(m=>m.provider==='OpenAI');const others=ms.filter(m=>!isOpenAI(m.provider));const avg=(xs:BenchModel[])=>xs.reduce((s,m)=>s+m.avg_tokens,0)/Math.max(xs.length,1);
  const best=[...ms].filter(m=>m.cost_per_success_usd!=null).sort((a,b)=>b.success_rate-a.success_rate||a.cost_per_success_usd!-b.cost_per_success_usd!)[0];const costs=[...ms].filter(m=>m.cost_per_success_usd!=null).sort((a,b)=>a.cost_per_success_usd!-b.cost_per_success_usd!);const cheapest=costs[0];const spread=costs.length>1?costs[costs.length-1].cost_per_success_usd!/costs[0].cost_per_success_usd!:0;
  return{f,allOpenAI:f.length>0&&f.every(m=>isOpenAI(m.provider)),bestOpenAI,bestOther,ratio:bestOpenAI&&bestOther?bestOther.cost_per_success_usd!/bestOpenAI.cost_per_success_usd!:0,tokenRatio:avg(others)/Math.max(avg(prop),1),cheapest,spread,best,runs:ms.reduce((s,m)=>s+m.runs,0)};},[bench]);
 return <>
  <div className="page-subhead"><div><span className="eyebrow">THE METRIC THAT MATTERS</span><h2>Cost per <em>successful</em> task.<br/>Not price per token.</h2><p className="muted">The same ShopiBricks agent task on every model, through the same Unity Gateway: search, stock check, budgeted basket, exact total. Every run is graded by code, not by a judge.</p></div></div>
  {error&&<div className="ug-alert"><AlertCircle size={15}/>{error}</div>}
  {bench&&pitch&&<>
   <div className="metric-grid lab-kpis five">
    <div className="metric hero"><span className="eyebrow">LOWEST COST PER SUCCESS</span><strong className="ug-hero">{label(pitch.cheapest?.model||'')}</strong><span className="muted">{usd(pitch.cheapest?.cost_per_success_usd)} per successful task · {Math.round((pitch.cheapest?.success_rate||0)*100)}% success</span></div>
    {pitch.best&&<div className="metric"><span className="eyebrow">HIGHEST SUCCESS RATE</span><strong className="ug-hero">{label(pitch.best.model)}</strong><span className="muted">{Math.round(pitch.best.success_rate*100)}% · {usd(pitch.best.cost_per_success_usd)} per success{pitch.ratio>1.5?`, ${Math.round(pitch.ratio)}× less than the cheapest other provider at 100%`:''}</span></div>}
    {pitch.tokenRatio>1.2&&<div className="metric"><span className="eyebrow">TOKEN EFFICIENCY</span><strong className="ug-hero">{pitch.tokenRatio.toFixed(1)}× fewer</strong><span className="muted">tokens per task for GPT models than for other providers, same tools, same prompt</span></div>}
    <div className="metric"><span className="eyebrow">SPREAD, SAME TASK</span><strong className="ug-hero">{pitch.spread>1?`${Math.round(pitch.spread)}×`:'—'}</strong><span className="muted">between the cheapest ({label(pitch.cheapest?.model||'')}) and the most expensive cost per success</span></div>
    <div className="metric"><span className="eyebrow">RUNS GRADED</span><strong className="ug-hero">{num(pitch.runs)}</strong><span className="muted">{bench.scenarios.length} scenarios × {bench.repeats} repeats × {bench.models.length} models</span></div>
   </div>
   <div className="ug-grid-2 ug-grid-lab">
    <div className="panel"><div className="panel-heading"><h3>Success vs cost per successful task</h3><span className="ug-legend"><i style={{background:OPENAI}}/>OpenAI<i className="diamond" style={{background:OTHER}}/>Other providers<i className="line"/>Frontier</span></div><Scatter models={bench.models} label={label} front={pitch.f}/></div>
    <div className="panel"><div className="panel-heading"><h3>Ranking</h3><span className="eyebrow">CHEAPEST SUCCESS FIRST</span></div>
     <div className="ug-table ug-table-5"><div className="ug-th"><span>Model</span><span>Success</span><span>Cost / success</span><span>Median</span><span>Tokens</span></div>{[...bench.models].filter(m=>m.cost_per_success_usd!=null).sort((a,b)=>a.cost_per_success_usd!-b.cost_per_success_usd!).map(m=><div className={`ug-tr ${pitch.f.includes(m)?'frontier':''}`} key={m.model}><span><i className={`ug-dot ${isOpenAI(m.provider)?'':'diamond'}`} style={{background:isOpenAI(m.provider)?OPENAI:OTHER}}/>{label(m.model)}</span><span>{Math.round(m.success_rate*100)}%</span><span>{usd(m.cost_per_success_usd)}</span><span>{m.median_latency_s?.toFixed(1)} s</span><span>{num(Math.round(m.avg_tokens))}</span></div>)}</div></div>
   </div>
   <FreeRun scenarios={bench.scenarios} models={bench.models} label={label}/>
   <div className="data-provenance"><span>Run {bench.generated_at.replace(/T(\d\d)(\d\d).*/,' $1:$2 UTC').replace(/^(\d{4})(\d\d)(\d\d)/,'$1-$2-$3')} · {bench.scenarios.length} scenarios × {bench.repeats} repeats · OpenAI reasoning effort “{bench.openai_reasoning_effort}” as in production · OpenAI via Responses API, others via Chat Completions, all through Unity Gateway.</span>{settings.showCosts&&<span>{bench.pricing_note}</span>}</div>
  </>}
 </>;
}

function Scatter({models,label,front}:{models:BenchModel[];label:(m:string)=>string;front:BenchModel[]}){
 const pts=models.filter(m=>m.cost_per_success_usd);const [hover,setHover]=useState<string>();
 const W=560,H=360,L=46,R=16,T=40,B=40;const xs=pts.map(m=>Math.log10(m.cost_per_success_usd!));const x0=Math.floor(Math.min(...xs)),x1=Math.ceil(Math.max(...xs));
 const yMin=Math.max(0,Math.floor(Math.min(...pts.map(m=>m.success_rate))*10)/10-0.1);
 const sx=(v:number)=>L+(Math.log10(v)-x0)/(x1-x0||1)*(W-L-R);const sy=(v:number)=>T+(1-(v-yMin)/(1-yMin))*(H-T-B);
 const ticks=Array.from({length:x1-x0+1},(_,i)=>10**(x0+i));const yt=Array.from({length:Math.round((1-yMin)/0.1)+1},(_,i)=>yMin+i*0.1);
 const h=pts.find(p=>p.model===hover);
 const placed:{x:number;y:number;w:number}[]=[];const pos=new Map<string,{dx:number;dy:number;anchor:'start'|'end'}>();
 for(const m of [...pts].sort((a,b)=>a.cost_per_success_usd!-b.cost_per_success_usd!)){const x=sx(m.cost_per_success_usd!),y=sy(m.success_rate),w=label(m.model).length*6.6+8;const options=[{dx:9,dy:-9,anchor:'start' as const},{dx:9,dy:16,anchor:'start' as const},{dx:-9,dy:-9,anchor:'end' as const},{dx:-9,dy:16,anchor:'end' as const},{dx:9,dy:-22,anchor:'start' as const},{dx:9,dy:29,anchor:'start' as const},{dx:-9,dy:-22,anchor:'end' as const},{dx:-9,dy:29,anchor:'end' as const}];const pick=options.find(o=>{const lx=o.anchor==='start'?x+o.dx:x+o.dx-w,ly=y+o.dy;return lx>=L&&lx+w<=W-R&&ly>=12&&!pts.some(q=>q.model!==m.model&&Math.abs(sy(q.success_rate)-(ly-4))<9&&Math.abs(sx(q.cost_per_success_usd!)-(lx+w/2))<w/2+6)&&!placed.some(p=>Math.abs(p.y-ly)<13&&lx<p.x+p.w&&lx+w>p.x);})||options[0];const lx=pick.anchor==='start'?x+pick.dx:x+pick.dx-w;placed.push({x:lx,y:y+pick.dy,w});pos.set(m.model,pick);}
 const fpath=front.map((m,i)=>{const x=sx(m.cost_per_success_usd!),y=sy(m.success_rate);const prev=front[i-1];return i===0?`M${L},${y} L${x},${y}`:`L${x},${sy(prev.success_rate)} L${x},${y}`;}).join(' ')+(front.length?` L${W-R},${sy(front[front.length-1].success_rate)}`:'');
 return <div className="ug-scatter"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Success rate against cost per successful task, log scale, with the price-performance frontier">
  {yt.map(v=><g key={v}><line x1={L} x2={W-R} y1={sy(v)} y2={sy(v)} className="grid"/><text x={L-8} y={sy(v)+3} textAnchor="end" className="axis">{Math.round(v*100)}%</text></g>)}
  {ticks.map(v=><text key={v} x={sx(v)} y={H-B+16} textAnchor="middle" className="axis">{v>=1?`$${v}`:`$${v.toFixed(Math.max(0,-Math.log10(v)))}`}</text>)}
  <text x={(L+W-R)/2} y={H-6} textAnchor="middle" className="axis-title">Cost per successful task (log scale) · lower is better →</text>
  {front.length>0&&<path d={fpath} className="frontier"/>}
  {pts.map(m=>{const x=sx(m.cost_per_success_usd!),y=sy(m.success_rate),oa=isOpenAI(m.provider),o=pos.get(m.model)!;return <g key={m.model} onMouseEnter={()=>setHover(m.model)} onMouseLeave={()=>setHover(undefined)} tabIndex={0} onFocus={()=>setHover(m.model)} onBlur={()=>setHover(undefined)}>
   <circle cx={x} cy={y} r={14} fill="transparent"/>
   {oa?<circle cx={x} cy={y} r={front.includes(m)?7.5:6} fill={OPENAI} stroke="#fff" strokeWidth={2}/>:<rect x={x-5.5} y={y-5.5} width={11} height={11} transform={`rotate(45 ${x} ${y})`} fill={OTHER} stroke="#fff" strokeWidth={2}/>}
   <text x={x+o.dx} y={y+o.dy} textAnchor={o.anchor} className={`pt-label ${front.includes(m)?'strong':''}`}>{label(m.model)}</text></g>;})}
 </svg>{h&&<div className="ug-tip" style={{left:`${sx(h.cost_per_success_usd!)/W*100}%`,top:`${sy(h.success_rate)/H*100}%`}}><strong>{label(h.model)}</strong><span>{Math.round(h.success_rate*100)}% success · {h.passed}/{h.runs}</span><span>{usd(h.cost_per_success_usd)} per success</span><span>median {h.median_latency_s?.toFixed(1)} s · {num(Math.round(h.avg_tokens))} tokens</span></div>}</div>;
}

// ---------------------------------------------------------------- free run
function FreeRun({scenarios,models,label}:{scenarios:Bench['scenarios'];models:BenchModel[];label:(m:string)=>string}){
 const [scenario,setScenario]=useState('tight_three');const [picked,setPicked]=useState<string[]>(['gpt-6-luna','gpt-6-1-terra','gpt-6-1-sol']);const [running,setRunning]=useState(false);const [result,setResult]=useState<LabRow[]>();const [error,setError]=useState('');
 async function run(){setRunning(true);setError('');setResult(undefined);try{setResult((await runLab(scenario,picked.map(model=>({model})))).rows);}catch(e){setError(e instanceof Error?e.message:'Run failed');}finally{setRunning(false);}}
 const s=scenarios.find(x=>x.id===scenario);
 return <div className="panel ug-live"><div className="panel-heading"><div><span className="eyebrow">LIVE · ANY SCENARIO</span><h3>Run a scenario now</h3></div><Sparkles size={18}/></div>
  <div className="ug-live-form"><label><span className="eyebrow">SCENARIO</span><select value={scenario} onChange={e=>setScenario(e.target.value)}>{scenarios.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
   <div><span className="eyebrow">MODELS · UP TO 4</span><div className="ug-chip-picker">{models.map(m=><button key={m.model} aria-pressed={picked.includes(m.model)} className={picked.includes(m.model)?'active':''} onClick={()=>setPicked(p=>p.includes(m.model)?p.filter(x=>x!==m.model):p.length<4?[...p,m.model]:p)}><i className={`ug-dot ${isOpenAI(m.provider)?'':'diamond'}`} style={{background:isOpenAI(m.provider)?OPENAI:OTHER}}/>{label(m.model)}</button>)}</div></div>
   <button className="primary-button" disabled={running||!picked.length} onClick={()=>void run()}>{running?'Running…':'Run'}</button></div>
  {s&&<blockquote className="ug-prompt">“{s.prompt}”</blockquote>}
  {error&&<div className="ug-alert"><AlertCircle size={15}/>{error}</div>}
  {result&&<div className="ug-live-results">{[...result].sort((a,b)=>Number(b.pass)-Number(a.pass)||a.cost_usd-b.cost_usd).map(r=><ResultCard key={r.model} r={r} label={label}/>)}</div>}
  <div className="source-note">Every call is logged in system.ai_gateway.usage · providers: {[...new Set(picked.map(providerOf))].join(', ')}<a className="lab-src" href="https://docs.databricks.com/aws/en/ai-gateway/" target="_blank" rel="noreferrer">Unity Gateway docs <ExternalLink size={11}/></a></div>
 </div>;
}
