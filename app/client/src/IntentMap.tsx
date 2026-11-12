import {useEffect,useMemo,useRef,useState} from 'react';
import {forceSimulation,forceX,forceY,forceCollide,type SimulationNodeDatum} from 'd3-force';
import {Plus,Minus,Maximize2,RotateCcw,Move} from 'lucide-react';
import type {AtlasData,AtlasQuery} from '../../shared/intelligence';

export const clusterColors=['#a78bfa','#6cc9ff','#f0be6e','#71d8b1','#f19ebd','#9faee7','#c2dc82','#e69b76'];
type Dot=SimulationNodeDatum&{id:string;cluster:string;anchorX:number;anchorY:number;radius:number;query:AtlasQuery};
export function IntentMap({data,selectedCluster,selectedQuery,onCluster,onQuery,search,onlyGaps}:{data:AtlasData;selectedCluster:string|null;selectedQuery:string|null;onCluster:(id:string|null)=>void;onQuery:(query:AtlasQuery)=>void;search:string;onlyGaps:boolean}){
 const[view,setView]=useState({x:0,y:0,k:1});const[expanded,setExpanded]=useState(false);const[hover,setHover]=useState<AtlasQuery>();
 const expandButton=useRef<HTMLButtonElement>(null);
 useEffect(()=>{setView({x:0,y:0,k:1});},[data]);
 useEffect(()=>{if(!selectedCluster)setView({x:0,y:0,k:1});},[selectedCluster]);
 useEffect(()=>{if(!expanded)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape'){setExpanded(false);expandButton.current?.focus();}};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);},[expanded]);
 const drag=useRef<{x:number;y:number;startX:number;startY:number;moved:boolean}|undefined>(undefined);
 const layout=useMemo(()=>{
  const anchors=data.clusters.map((cluster,index)=>{const angle=2*Math.PI*index/Math.max(1,data.clusters.length)-Math.PI/2;return {...cluster,x:430+(data.clusters.length===1?0:255*Math.cos(angle)),y:280+(data.clusters.length===1?0:165*Math.sin(angle)),color:clusterColors[index%clusterColors.length]};});
  const dots:Dot[]=data.queries.map((query,i)=>{const anchor=anchors.find(a=>a.id===query.cluster)!;const angle=i*2.399963;return {id:query.id,cluster:query.cluster,anchorX:anchor.x,anchorY:anchor.y,x:anchor.x+Math.cos(angle)*35,y:anchor.y+Math.sin(angle)*35,radius:query.status==='matched'?5:6,query};});
  const simulation=forceSimulation(dots).force('x',forceX<Dot>(d=>d.anchorX).strength(.07)).force('y',forceY<Dot>(d=>d.anchorY).strength(.07)).force('collide',forceCollide<Dot>(d=>d.radius+7).iterations(3)).stop();
  for(let i=0;i<150;i++)simulation.tick();
  return {anchors,dots};
 },[data]);
 const matches=(q:AtlasQuery)=>(!search||`${q.text} ${q.reason}`.toLowerCase().includes(search.toLowerCase()))&&(!onlyGaps||q.status!=='matched');
 function focus(id:string){onCluster(selectedCluster===id?null:id);const anchor=layout.anchors.find(a=>a.id===id)!;setView(selectedCluster===id?{x:0,y:0,k:1}:{x:430-anchor.x*1.45,y:280-anchor.y*1.45,k:1.45});}
 function zoom(delta:number){setView(v=>{const next=Math.min(2.8,Math.max(.65,v.k+delta));return {x:430-(430-v.x)*next/v.k,y:280-(280-v.y)*next/v.k,k:next};});}
 return <div className={`intent-map ${expanded?'map-expanded':''}`}><div className="map-heading"><div><span className="map-live-dot"/><strong>Intent landscape</strong><span>{data.queries.length} questions</span></div><button ref={expandButton} aria-label={expanded?'Exit expanded map':'Expand intent map'} onClick={()=>setExpanded(v=>!v)}><Maximize2 size={15}/></button></div>
 <svg viewBox="0 0 860 560" role="group" aria-label="Interactive intent cluster map" onPointerDown={e=>{if(e.target instanceof Element&&e.target.closest('[data-node]'))return;drag.current={x:e.clientX,y:e.clientY,startX:view.x,startY:view.y,moved:false};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(!drag.current)return;const factor=860/e.currentTarget.getBoundingClientRect().width;const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;if(Math.abs(dx)+Math.abs(dy)>3)drag.current.moved=true;setView(v=>({...v,x:drag.current!.startX+dx*factor,y:drag.current!.startY+dy*factor}));}} onPointerUp={()=>{drag.current=undefined;}} onPointerCancel={()=>{drag.current=undefined;}}>
  <title>Questions grouped by language similarity</title><desc>Each point represents one question. Select a point to inspect its catalog matches. Use the cluster list or zoom controls to navigate.</desc>
  <defs><pattern id="atlas-grid" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#526174" opacity=".3"/></pattern>{layout.anchors.map(a=><radialGradient id={`glow-${a.id}`} key={a.id}><stop offset="0" stopColor={a.color} stopOpacity=".12"/><stop offset="1" stopColor={a.color} stopOpacity="0"/></radialGradient>)}</defs>
  <rect width="860" height="560" fill="url(#atlas-grid)"/>
  <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
   {layout.anchors.map(a=><g key={a.id} opacity={!selectedCluster||selectedCluster===a.id?1:.22}><circle cx={a.x} cy={a.y} r="123" fill={`url(#glow-${a.id})`}/><circle cx={a.x} cy={a.y} r="90" fill="none" stroke={a.color} strokeOpacity=".1" strokeDasharray="2 6"/>{layout.dots.filter(d=>d.cluster===a.id).map(d=><line key={d.id} x1={a.x} y1={a.y} x2={d.x} y2={d.y} stroke={a.color} strokeOpacity=".1"/>)}<g data-node="cluster" role="button" tabIndex={0} aria-label={`Explore ${a.label} cluster, ${a.count} questions`} onClick={()=>focus(a.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();focus(a.id);}}} className="map-cluster-label"><rect x={a.x-94} y={a.y+64} width="188" height="44" rx="8" fill="#101d2f" stroke={a.color} strokeOpacity=".3"/><text x={a.x} y={a.y+82} textAnchor="middle" fill="#eaf0fa" fontSize="12" fontWeight="600">{a.label}</text><text x={a.x} y={a.y+98} textAnchor="middle" fill={a.color} fontSize="9">{a.count} questions · {a.gaps} to review</text></g></g>)}
   {layout.dots.map(dot=>{const anchor=layout.anchors.find(a=>a.id===dot.cluster)!;const active=matches(dot.query)&&(!selectedCluster||selectedCluster===dot.cluster);return <g key={dot.id} data-node="query" role="button" tabIndex={active?0:-1} aria-label={`Inspect query: ${dot.query.text}`} aria-pressed={selectedQuery===dot.id} className="map-node" opacity={active?1:.12} onPointerDown={e=>e.stopPropagation()} onClick={()=>onQuery(dot.query)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onQuery(dot.query);}}} onMouseEnter={()=>setHover(dot.query)} onMouseLeave={()=>setHover(undefined)} onFocus={()=>setHover(dot.query)} onBlur={()=>setHover(undefined)}><circle cx={dot.x} cy={dot.y} r="13" fill="transparent"/>{selectedQuery===dot.id&&<circle cx={dot.x} cy={dot.y} r="12" fill="none" stroke="white" strokeWidth="1.5"/>}<circle cx={dot.x} cy={dot.y} r={dot.radius} fill={dot.query.status==='matched'?anchor.color:'#101b2b'} stroke={anchor.color} strokeWidth={dot.query.status==='matched'?1:2}/></g>;})}
  </g>
 </svg>
 {hover&&<div className="map-query-tooltip" role="status"><span>QUESTION</span><p>{hover.text}</p><small>{hover.status==='matched'?`${hover.matches.length} relevant products`:'Catalog opportunity'} · select to explore</small></div>}
 <div className="map-bottom"><span><Move size={12}/>Drag to explore <i/> Filled: matched · outlined: review</span><div className="map-controls"><button aria-label="Zoom out" onClick={()=>zoom(-.2)} disabled={view.k<=.65}><Minus size={15}/></button><output aria-label="Map zoom level">{Math.round(view.k*100)}%</output><button aria-label="Zoom in" onClick={()=>zoom(.2)} disabled={view.k>=2.8}><Plus size={15}/></button><button aria-label="Reset map view" onClick={()=>{setView({x:0,y:0,k:1});onCluster(null);}}><RotateCcw size={14}/></button></div></div>
 </div>;
}
