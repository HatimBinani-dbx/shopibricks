import { z } from 'zod';
import { channels, defaultExperience, personas, profiles, voices, profileFor, type Experience } from '../shared/experience.js';
import type { Product, ProtocolEvent } from './types.js';

export const experienceSchema=z.object({
  persona:z.enum(personas.map(x=>x.id)),profile:z.enum(profiles.map(x=>x.id)),
  channel:z.enum(channels.map(x=>x.id)),voice:z.enum(voices.map(x=>x.id)),
}).strict();
export const agentInputSchema=z.object({message:z.string().trim().min(1).max(3000),threadId:z.string().uuid().optional(),experience:experienceSchema.optional()});

// Personas are presentation context, never authorization. Caller identity still scopes all records.
export function threadOwner(owner:string,experience?:Experience){
  return experience?`${owner}:${experience.persona}:${experience.profile}:${experience.channel}:${experience.voice}`:owner;
}
export function experienceInstruction(experience:Experience){
  const profile=profileFor(experience.profile);
  const voice=voices.find(x=>x.id===experience.voice)!;
  const channel=channels.find(x=>x.id===experience.channel)!;
  return `Demo persona: ${experience.persona}. Brand voice: ${voice.instruction} Channel: ${channel.label}. ${channel.instruction}
${experience.persona==='shopper'?`Fictional shopper profile: ${profile.name}, ${profile.title}. ${profile.context} Seeded demo history (not observed behavior): ${profile.history} Preferred catalog tags: ${profile.tags.join(', ')}. Use these preferences when the request is ambiguous; explicit user requests take priority. Explain the match using actual catalog attributes. Ask a brief clarification when needed.`:'This is a business/technical view. Do not apply the fictional shopper preferences to business questions.'}
These personas and specialist channels are native demo experiences, not connections to external AI platforms. Never imply external distribution or real customer history. Brand voice must never change factual prices, stock or checkout policy.`;
}

export function catalogReadiness(products:Product[]){
  const items=products.map(p=>{
    const checks=[
      {key:'identity',label:'Stable ID and product name',ok:!!p.id?.trim()&&!!p.name?.trim()},
      {key:'description',label:'Useful description (at least 40 characters)',ok:(p.description?.trim().length??0)>=40},
      {key:'discovery',label:'Category and intent tags',ok:!!p.category?.trim()&&Array.isArray(p.tags)&&p.tags.length>=2},
      {key:'price',label:'EUR price in integer cents',ok:Number.isInteger(p.price_cents)&&p.price_cents>0&&p.currency?.toLowerCase()==='eur'},
      {key:'inventory',label:'Nonnegative integer stock',ok:Number.isInteger(p.stock)&&p.stock>=0},
      {key:'visual',label:'Storefront illustration',ok:!!p.image_kind?.trim()&&!!p.color?.trim()},
    ];
    return {id:p.id,name:p.name,stock:p.stock,checks,ready:checks.every(x=>x.ok)};
  });
  return {items,ready:items.filter(x=>x.ready).length,total:items.length,available:items.filter(x=>x.stock>0).length,definition:'Internal catalog completeness: six checks per product. This is not external platform approval.'};
}
export function catalogFeed(products:Product[],baseUrl:string){
  return {schema:'shopibricks.catalog.v1',generated_at:new Date().toISOString(),source:'Lakebase · shopibricks.products',sandbox:true,
    integration_status:'Internal feed preview. No external platform is connected by this export.',
    products:products.map(p=>({id:p.id,title:p.name,description:p.description,category:p.category,intent_tags:p.tags,
      price:{amount_cents:p.price_cents,currency:p.currency.toUpperCase(),vat_included:true},availability:p.stock>0?'in_stock':'out_of_stock',available_quantity:p.stock,
      url:`${baseUrl}/?product=${encodeURIComponent(p.id)}`,visual:{type:'demo_illustration',kind:p.image_kind,color:p.color},updated_at:p.updated_at??null}))};
}

type ContextEvent={experience:Experience;intent:string;budget_cents?:number};
function contextValue(event:ProtocolEvent):ContextEvent|undefined{
  const value=z.object({experience:experienceSchema,intent:z.string(),budget_cents:z.number().optional()}).safeParse(event.value);
  return value.success?value.data:undefined;
}
export function classifyIntent(message:string,experience:Experience):string{
  if(/\b(compare|versus|comparison)\b/i.test(message))return 'comparison';
  if(/\b(checkout|buy|purchase|order)\b/i.test(message))return 'purchase';
  if(/\b(gift|present|cadeau)\b/i.test(message))return 'gift';
  if(/\b(work|commut|laptop|office)/i.test(message))return 'work';
  if(/\b(camera|photograph|creative|sketch)/i.test(message))return 'creative';
  if(/\b(weekend|travel|trip|paris)\b/i.test(message))return 'weekend';
  return experience.persona==='shopper'?'discovery':experience.persona==='merchant'?'merchant analytics':'technical';
}
export function summarizeIntents(events:ProtocolEvent[],filters:{profile?:string;channel?:string}={}){
  const runs=new Map<string,{context:ContextEvent;recommended:boolean;draft:boolean;failed:boolean;finished:boolean;gap:boolean;at:number}>();
  for(const event of events){
    if(event.name!=='shopibricks.context'||!event.runId)continue;
    const context=contextValue(event);if(!context||context.experience.persona!=='shopper')continue;
    if(filters.profile&&filters.profile!==context.experience.profile)continue;
    if(filters.channel&&filters.channel!==context.experience.channel)continue;
    runs.set(event.runId,{context,recommended:false,draft:false,failed:false,finished:false,gap:false,at:event.timestamp});
  }
  for(const event of events){
    const run=event.runId?runs.get(event.runId):undefined;if(!run)continue;
    if(event.type==='RUN_ERROR')run.failed=true;
    if(event.type==='RUN_FINISHED')run.finished=true;
    if(event.name==='shopibricks.gap')run.gap=true;
    if(event.name==='shopibricks.ui'&&typeof event.value==='object'&&event.value){
      const value=event.value as {kind?:string;products?:Product[]};
      if(value.kind==='products'&&value.products?.length)run.recommended=true;
      if(value.kind==='checkout')run.draft=true;
    }
  }
  const list=[...runs.values()];
  const intents=[...new Set(list.map(x=>x.context.intent))].map(intent=>({intent,requests:list.filter(x=>x.context.intent===intent).length,gaps:list.filter(x=>x.context.intent===intent&&x.gap).length})).sort((a,b)=>b.requests-a.requests);
  return {requests:list.length,recommended:list.filter(x=>x.recommended).length,drafts:list.filter(x=>x.draft).length,failed:list.filter(x=>x.failed).length,completed:list.filter(x=>x.finished).length,gaps:list.filter(x=>x.gap).length,intents,
    latest_at:list.length?new Date(Math.max(...list.map(x=>x.at))).toISOString():null,
    definition:'Distinct shopper agent runs for your signed-in account or local demo session. Rule-based intent labels. Recommendations and drafts are independent milestones, not conversion rates or orders.'};
}
export { defaultExperience };
