import React,{useEffect,useState} from 'react';
import {AlertCircle,Gauge,Layers,ShieldCheck,Terminal} from 'lucide-react';
import {api} from './api';
import {PresenterSettingsButton,type Overview,type Usage} from './dev/shared';
import {GatewayView} from './dev/GatewayView';
import {ModelLab} from './dev/ModelLab';
import {CodexView} from './dev/CodexView';
import './gateway.css';
import './dev/dev.css';

export {PresenterProvider} from './dev/shared';
export {AppArchitecture} from './dev/Architecture';
export type DeveloperView='protocols'|'gateway'|'lab'|'codex';

export function DeveloperTabs({view,onView}:{view:DeveloperView;onView:(v:DeveloperView)=>void}){
 return <div className="dev-tabs-row"><nav className="studio-tabs" aria-label="Developer studio">{([{id:'protocols',label:'Architecture',icon:Layers},{id:'gateway',label:'Unity Gateway',icon:ShieldCheck},{id:'lab',label:'Model lab',icon:Gauge},{id:'codex',label:'Codex',icon:Terminal}] as const).map(({id,label,icon:Icon})=><button key={id} aria-current={view===id?'page':undefined} onClick={()=>onView(id)}><Icon size={16}/>{label}</button>)}</nav><PresenterSettingsButton/></div>;
}

export function GatewayStudio({view,workspace}:{view:Exclude<DeveloperView,'protocols'>;workspace?:string}){
 const [overview,setOverview]=useState<Overview>();const [usage,setUsage]=useState<Usage>();const [windowSize,setWindow]=useState<'1h'|'24h'|'7d'>('24h');const [error,setError]=useState('');
 const loadOverview=(refresh=false)=>api<Overview>(`/api/ug/overview${refresh?'?refresh=1':''}`).then(setOverview).catch(e=>setError(e.message));
 const loadUsage=(refresh=false)=>api<Usage>(`/api/ug/usage?window=${windowSize}${refresh?'&refresh=1':''}`).then(setUsage).catch(e=>setError(e.message));
 useEffect(()=>{void loadOverview();},[]);
 useEffect(()=>{if(view!=='gateway')return;void loadUsage();const id=setInterval(()=>void loadUsage(),30000);return()=>clearInterval(id);},[view,windowSize]);
 const host=workspace?(/^https?:\/\//.test(workspace)?workspace:`https://${workspace}`):'';
 return <div className="gateway-studio">
  {error&&<div className="ug-alert" role="alert"><AlertCircle size={15}/>{error}<button className="text-button" onClick={()=>{setError('');void loadOverview(true);void loadUsage(true);}}>Retry</button></div>}
  {view==='gateway'&&<GatewayView overview={overview} usage={usage} windowSize={windowSize} onWindow={setWindow} onRefresh={()=>{void loadOverview(true);void loadUsage(true);}} onRouted={()=>void loadOverview(true)} host={host}/>}
  {view==='lab'&&<ModelLab/>}
  {view==='codex'&&<CodexView overview={overview} host={host}/>}
 </div>;
}
