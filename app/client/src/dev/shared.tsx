import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {Settings2,X} from 'lucide-react';
import {setInterceptor} from '../api';
import {simulate} from './simulate';

export type Row=Record<string,unknown>;
export type Destination={name:string;traffic_percentage?:number;pay_per_token_config?:{model?:string}};
export type Overview={service:string;identity?:string;workspace_id?:string;demos?:{restricted:string;ratelimit:string;guarded:string};config?:{routing?:{destinations?:Destination[];fallback?:{destinations?:Destination[]}};rate_limits?:{key:string;renewal_period:string;requests?:number;tokens?:number;principal?:string}[];inference_table?:{table?:string}};grants?:{privilege_assignments?:{principal:string;privileges:string[]}[]};system_ai_models?:{name:string;api_types:string[]}[];mcp_services?:{name:string;comment:string}[];routable:string[];routing_enabled:boolean;queried_at:string;model_service?:{error?:string}};
export type Usage={window:string;queried_at:string;service:string;services?:Row[]|{error:string};attribution?:Row[]|{error:string};concierge?:Row[]|{error:string}};
export type BenchModel={model:string;provider:string;runs:number;passed:number;success_rate:number;median_latency_s:number|null;p90_latency_s:number|null;avg_cost_usd:number;cost_per_success_usd:number|null;avg_tokens:number;errors:number;by_scenario:Record<string,number>};
export type Bench={generated_at:string;repeats:number;openai_reasoning_effort:string;scenarios:{id:string;title:string;prompt:string}[];pricing_note:string;models:BenchModel[]};
export type LabEvent={t:number;kind:'model'|'tool'|'guardrail'|'retry'|'error'|'grade';name?:string;detail?:string;step?:number;tokens?:number|null;ok?:boolean;policy?:{name?:string;action?:string;phase?:string;reason?:string}};
export type LabRow={model:string;provider:string;scenario:string;pass:boolean;reasons:string[];latency_s:number;tool_calls:number;usage:{input:number;output:number;cached?:number};cost_usd:number;answer?:{items?:{id:string;quantity:number}[];total_cents?:number;note?:string;feasible?:boolean}|null;error?:string|null;service?:string;events?:LabEvent[];guardrail_fired?:boolean};

// Validated categorical colors (dataviz validate_palette.js, light surface).
export const OPENAI='#ff3621',OTHER='#2a78c4',THIRD='#7a5cc7';
export const isOpenAI=(provider:string)=>String(provider||'').startsWith('OpenAI');
const NAMES:Record<string,string>={'gpt-6-luna':'GPT-6 Luna','gpt-6-astra':'GPT-6 Astra','gpt-6-sol':'GPT-6 Sol','gpt-6-1-sol':'GPT-6.1 Sol','gpt-6-1-terra':'GPT-6.1 Terra','gpt-6-2-sol':'GPT-6.2 Sol','gpt-6-2-astra':'GPT-6.2 Astra','gpt-5-6-luna':'GPT-5.6 Luna','gpt-5-6-sol':'GPT-5.6 Sol','gpt-5-6-terra':'GPT-5.6 Terra','gpt-5-5':'GPT-5.5','gpt-5-5-pro':'GPT-5.5 Pro','gpt-5-4':'GPT-5.4','gpt-5-4-mini':'GPT-5.4 mini','gpt-5-4-nano':'GPT-5.4 nano','gpt-oss-120b':'gpt-oss-120b','gpt-oss-20b':'gpt-oss-20b','claude-opus-5-5':'Claude Opus 5.5','claude-sonnet-5-5':'Claude Sonnet 5.5','gemini-3-8-flash':'Gemini 3.8 Flash','glm-5-3':'GLM-5.3'};
export const modelKey=(m:string)=>String(m||'').replace(/^models\//,'').replace(/^system\.ai\./,'').replace(/^databricks-/,'').replace(/^primary-|^fallback-/,'').replace(/\./g,'-');
export const prettyModel=(m:string)=>{const k=modelKey(m);return NAMES[k]||k;};
export const providerOf=(m:string)=>{const k=modelKey(m);return /^gpt|^o\d/.test(k)?(k.startsWith('gpt-oss')?'OpenAI (open weights)':'OpenAI'):/^claude/.test(k)?'Anthropic':/^gemini/.test(k)?'Google':/^glm/.test(k)?'Zhipu':'Other';};
export const usd=(v:number|null|undefined)=>v==null||Number.isNaN(v)?'—':v<0.01?`$${v.toFixed(4)}`:v<10?`$${v.toFixed(3)}`:`$${v.toFixed(2)}`;
export const secs=(v:unknown)=>v==null?'—':`${(Number(v)/1000).toFixed(1)} s`;
export const num=(v:unknown)=>new Intl.NumberFormat('en-GB').format(Number(v||0));
export const compact=(v:unknown)=>new Intl.NumberFormat('en-GB',{notation:'compact',maximumFractionDigits:1}).format(Number(v||0));
export const clock=(v:unknown,seconds=false)=>v?new Date(String(v)).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',...(seconds?{second:'2-digit'}:{})}):'—';
export const rows=(v:Row[]|{error:string}|undefined)=>Array.isArray(v)?v:[];
export const failed=(v:Row[]|{error:string}|undefined)=>v&&!Array.isArray(v)?v.error:undefined;
export const modelOf=(d?:Destination)=>modelKey(d?.pay_per_token_config?.model||d?.name||'');
export const shortService=(s?:string)=>String(s||'').split('.').pop()||'';
export const workspaceUrl=(host:string,pathname:string)=>host?`${host}${pathname}`:'';

// ---------------------------------------------------------------- presenter settings
type Settings={anonymize:boolean;motion:boolean;showCosts:boolean;fallback:boolean};
const DEFAULTS:Settings={anonymize:true,motion:true,showCosts:true,fallback:false};
const KEY='shopibricks.presenter';
const Ctx=createContext<{settings:Settings;set:(patch:Partial<Settings>)=>void}>({settings:DEFAULTS,set:()=>undefined});
export function PresenterProvider({children}:{children:React.ReactNode}){
 const [settings,setSettings]=useState<Settings>(()=>{try{return{...DEFAULTS,...JSON.parse(localStorage.getItem(KEY)||'{}')};}catch{return DEFAULTS;}});
 useEffect(()=>{localStorage.setItem(KEY,JSON.stringify(settings));},[settings]);
 useEffect(()=>{setInterceptor(settings.fallback?simulate:null);},[settings.fallback]);
 const value=useMemo(()=>({settings,set:(patch:Partial<Settings>)=>setSettings(s=>({...s,...patch}))}),[settings]);
 return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const usePresenter=()=>useContext(Ctx);
export const useReducedMotion=()=>{const {settings}=usePresenter();const [prefers]=useState(()=>typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches);return prefers||!settings.motion;};

/** Every non-OpenAI model the studio can show: one list, so "Model A, B…" letters match on every page. */
export const OTHER_MODELS=['claude-sonnet-5-5','claude-opus-5-5','gemini-3-8-flash','glm-5-3'];
/** A service name for display: system.ai services are labelled like their model (anonymized when needed). */
export const serviceLabel=(s:string,label:(m:string)=>string)=>{const v=String(s||'');return v.startsWith('system.ai.')?label(v):shortService(v);};

/** Display name for a model: non-OpenAI models become "Model A, B…" when anonymized (stable alphabetical order). */
export function useModelLabel(models:string[]){
 const {settings}=usePresenter();
 return useMemo(()=>{const others=[...new Set(models.filter(m=>!isOpenAI(providerOf(m))))].sort();const map=new Map(others.map((m,i)=>[m,`Model ${String.fromCharCode(65+i)}`]));return(m:string)=>settings.anonymize&&map.has(modelKey(m))?map.get(modelKey(m))!:settings.anonymize&&!isOpenAI(providerOf(m))?'Other model':prettyModel(m);},[models.join('|'),settings.anonymize]);
}

/** Small gear that opens presenter-only settings. Also opens with Shift+, */
export function PresenterSettingsButton(){
 const {settings,set}=usePresenter();const [open,setOpen]=useState(false);
 useEffect(()=>{const h=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);return;}const el=e.target as HTMLElement|null;if(el&&/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)&&(el as HTMLInputElement).type!=='checkbox')return;if(e.shiftKey&&e.code==='Comma'){e.preventDefault();setOpen(o=>!o);}};addEventListener('keydown',h);return()=>removeEventListener('keydown',h);},[]);
 return <>
  <button className="dev-gear" aria-label="Presenter settings" title="Presenter settings" onClick={()=>setOpen(true)}><Settings2 size={15}/></button>
  {open&&<div className="dev-drawer-backdrop" onClick={()=>setOpen(false)}><aside className="dev-drawer" role="dialog" aria-label="Presenter settings" onClick={e=>e.stopPropagation()}>
   <div className="dev-drawer-head"><div><span className="eyebrow">PRESENTER</span><h3>Settings</h3></div><button className="icon-button" aria-label="Close settings" onClick={()=>setOpen(false)}><X size={16}/></button></div>
   {([['anonymize','Anonymize non-OpenAI models','Shows "Model A, B…" instead of other providers’ names in the model lab.'],['showCosts','Show costs','Estimated spend at public list price on every page.'],['motion','Animations','Flowing diagrams and transitions. Off respects a calmer projector.'],['fallback','Fallback mode','Serves recorded responses across the Developer studio (Unity Gateway, Model lab, Codex) if the workspace is unreachable. Keep off: live is the default.']] as const).map(([k,t,d])=><label key={k} className="dev-switch"><input type="checkbox" checked={settings[k]} onChange={e=>set({[k]:e.target.checked})}/><span className="dev-switch-ui" aria-hidden/><span><strong>{t}</strong><small>{d}</small></span></label>)}
   <p className="muted dev-drawer-foot">Stored in this browser only. Shortcut: Shift + ,</p>
  </aside></div>}
 </>;
}

export function Empty({loading,text='No traffic in this window yet.'}:{loading?:boolean;text?:string}){return <div className="empty-state ug-empty">{loading?'Reading Unity Gateway data…':text}</div>;}
export function WindowPicker({value,onChange,options=['1h','24h','7d']}:{value:string;onChange:(v:'1h'|'24h'|'7d')=>void;options?:('1h'|'24h'|'7d')[]}){return <div className="ug-window" role="group" aria-label="Time window">{options.map(w=><button key={w} className={value===w?'active':''} onClick={()=>onChange(w)}>{w}</button>)}</div>;}

/** Pull a human-readable summary out of an inference-table request/response JSON. */
export function summarizePayload(request:string,response:string){
 let input='',output='',policy='',tools=0;
 // Requests are truncated in the query, so read the agent name from the raw text rather than the parsed JSON.
 const agent=(request.match(/You are ShopiBricks ([A-Z][A-Za-z ]*?)[.,]/)||[])[1]||(/ShopiBricks concierge/i.test(request)?'Concierge':'');
 try{const r=JSON.parse(request);const items=(r.input||r.messages||[]) as Row[];tools=items.filter(m=>m.type==='function_call_output'||m.role==='tool').length;const last=[...items].reverse().find(m=>m.role==='user'||m.role==='tool'||m.type==='function_call_output');const c=last?.content??last?.output;input=typeof c==='string'?c:Array.isArray(c)?(c as Row[]).map(x=>String(x.text||'')).join(' '):JSON.stringify(c||'');}catch{input=request.slice(0,200);}
 try{const r=JSON.parse(response);const p=r.databricks_service_policy;if(p)policy=typeof p==='object'?String((p as Row).reason||JSON.stringify(p)):String(p);output=r.output_text||(r.output||[]).flatMap((o:Row)=>o.type==='message'?((o.content as Row[])||[]).map(x=>String(x.text||'')):o.type==='function_call'?[`→ ${o.name}(${String(o.arguments||'').slice(0,80)})`]:[]).join(' ')||r.choices?.[0]?.message?.content||(r.choices?.[0]?.message?.tool_calls||[]).map((t:{function:{name:string;arguments:string}})=>`→ ${t.function.name}(${t.function.arguments.slice(0,80)})`).join(' ')||'';}catch{output=response.slice(0,200);}
 // Tool results arrive as JSON strings (sometimes wrapped in {"text": ...}): decode them for a readable preview.
 const tidy=(v:string)=>{let x:unknown=v;for(let i=0;i<3&&typeof x==='string';i++){try{x=JSON.parse(x);}catch{break;}if(x&&typeof x==='object'&&'text' in (x as Row))x=(x as Row).text;}return typeof x==='string'?x:JSON.stringify(x,null,1);};
 return{input:tidy(input).slice(0,600),output:String(output).slice(0,400),policy,tools,agent};
}

/** Shown while a live call runs: says what is happening, in a few words. */
export function Waiter({text,sub}:{text:string;sub?:string}){
 return <div className="ug-waiter" role="status" aria-live="polite"><span className="ug-waiter-spin" aria-hidden="true"/><div><strong>{text}</strong>{sub&&<small>{sub}</small>}<span className="ug-waiter-bar" aria-hidden="true"><i/></span></div></div>;
}
