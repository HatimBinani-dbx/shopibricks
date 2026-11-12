import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {agentInputSchema,catalogFeed,catalogReadiness,experienceInstruction,threadOwner,summarizeIntents,classifyIntent} from '../server/experience.js';
import {defaultExperience,rankProducts,brandPreview} from '../shared/experience.js';
import {resolveEuroBudget,productSelection} from '../server/product-ui.js';
import type {Product,ProtocolEvent} from '../server/types.js';

const products:Product[]=JSON.parse(readFileSync('server-products.json','utf8'));
test('Persona, profile, channel and voice are allowlisted; blank requests are rejected',()=>{
  assert.equal(agentInputSchema.safeParse({message:'   ',experience:defaultExperience}).success,false);
  for(const field of ['persona','profile','channel','voice'])assert.equal(agentInputSchema.safeParse({message:'Hello',experience:{...defaultExperience,[field]:'untrusted'}}).success,false);
  assert.equal(agentInputSchema.safeParse({message:'Hello',experience:{...defaultExperience,instructions:'invent stock'}}).success,false);
  assert.equal(agentInputSchema.parse({message:' Hello ',experience:defaultExperience}).message,'Hello');
});
test('Conversation namespaces isolate user, persona, profile, channel and voice',()=>{
  const base=threadOwner('caller',defaultExperience);
  for(const patch of [{persona:'merchant'},{profile:'alex'},{channel:'travel'},{voice:'concise'}] as const)assert.notEqual(threadOwner('caller',{...defaultExperience,...patch}),base);
  assert.notEqual(threadOwner('other',defaultExperience),base);
  assert.equal(threadOwner('legacy'),'legacy');
});
test('Profile defaults enforce a budget but explicit caps and removal take precedence',()=>{
  assert.equal(resolveEuroBudget('Find a gift',[],10000),10000);
  assert.equal(resolveEuroBudget('Find a gift under €50',[],10000),5000);
  assert.equal(resolveEuroBudget('Another option',[{role:'user',content:'Under €80'}],10000),8000);
  assert.equal(resolveEuroBudget('No budget',[],10000),undefined);
  assert.equal(resolveEuroBudget('Another option',[{role:'user',content:'Remove my budget'}],10000),undefined);
  assert.throws(()=>productSelection(products.filter(p=>p.id==='sb-headphones'),'shortlist',{budgetCents:10000}),/exceeds/);
});
test('Ranking changes with real catalog tags and puts unavailable items last without modifying catalog',()=>{
  const original=JSON.stringify(products);
  assert.notDeepEqual(rankProducts(products,'alex').slice(0,3).map(p=>p.id),rankProducts(products,'lea').slice(0,3).map(p=>p.id));
  const unavailable=products.map(p=>({...p,stock:p.id==='sb-backpack'?0:p.stock}));
  assert.equal(rankProducts(unavailable,'alex').at(-1)?.id,'sb-backpack');
  assert.equal(JSON.stringify(products),original);
});
test('Personalization and seeded history are factual context, not claims of observed behavior',()=>{
  assert.match(experienceInstruction({...defaultExperience,profile:'alex',channel:'travel',voice:'concise'}),/focused commuter/);
  assert.match(experienceInstruction(defaultExperience),/Seeded demo history \(not observed behavior\)/);
  assert.doesNotMatch(experienceInstruction({...defaultExperience,persona:'merchant'}),/Previously explored/);
});
test('Completeness is separate from availability and invalid price or metadata blocks readiness',()=>{
  const complete=catalogReadiness(products);assert.equal(complete.ready,12);
  const outOfStock={...products[0],stock:0};assert.equal(catalogReadiness([outOfStock]).ready,1);assert.equal(catalogReadiness([outOfStock]).available,0);
  const invalid={...products[0],description:'',tags:[],price_cents:1.5,stock:-1};
  assert.equal(catalogReadiness([invalid]).ready,0);assert.equal(catalogReadiness([invalid]).items[0].checks.filter(c=>!c.ok).length,4);
  assert.equal(catalogReadiness([]).total,0);
});
test('Feed and voice previews retain authoritative facts and disclose internal format',()=>{
  const product={...products[0],stock:0};const feed=catalogFeed([product],'https://demo.example');
  assert.equal(feed.products[0].price.amount_cents,product.price_cents);assert.equal(feed.products[0].availability,'out_of_stock');
  assert.match(feed.products[0].url,/\?product=sb-headphones/);assert.match(feed.integration_status,/No external platform/);
  assert.notEqual(brandPreview(product,'editorial'),brandPreview(product,'concise'));
  for(const voice of ['editorial','concise','playful'] as const){assert.match(brandPreview(product,voice),/129\.00/);assert.doesNotMatch(brandPreview(product,voice),/In stock|Available now/);}
});
test('Intent milestones count runs once, filter context, exclude merchant runs, and distinguish failed runs',()=>{
  const event=(runId:string,fields:Record<string,unknown>):ProtocolEvent=>({type:'CUSTOM',runId,timestamp:1000,...fields});
  const context=(runId:string,profile:'camille'|'lea',persona:'shopper'|'merchant'='shopper')=>event(runId,{name:'shopibricks.context',value:{experience:{...defaultExperience,profile,persona},intent:'gift'}});
  const events=[context('a','lea'),context('b','camille'),context('c','lea','merchant'),
    event('a',{name:'shopibricks.ui',value:{kind:'products',products:[products[0]]}}),event('a',{name:'shopibricks.ui',value:{kind:'products',products:[products[1]]}}),
    event('a',{name:'shopibricks.gap'}),event('a',{name:'shopibricks.gap'}),event('a',{type:'RUN_FINISHED'}),
    event('b',{name:'shopibricks.ui',value:{kind:'checkout'}}),event('b',{type:'RUN_ERROR'}),
    event('unknown',{name:'shopibricks.ui',value:{kind:'checkout'}})];
  const total=summarizeIntents(events);assert.equal(total.requests,2);assert.equal(total.recommended,1);assert.equal(total.drafts,1);assert.equal(total.gaps,1);assert.equal(total.failed,1);assert.equal(total.completed,1);
  assert.equal(summarizeIntents(events,{profile:'lea'}).requests,1);assert.equal(summarizeIntents(events,{channel:'travel'}).requests,0);
  assert.equal(summarizeIntents([]).latest_at,null);assert.equal(summarizeIntents([]).requests,0);
  assert.equal(classifyIntent('Find a camera',defaultExperience),'creative');
});
