// Real Lakebase + OpenAI checks through the local app. No payment or order is completed.
import {request} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const baseURL=process.env.SHOPIBRICKS_TEST_URL||'http://localhost:8011';
const client=await request.newContext({baseURL,timeout:115000});
const evidence={baseURL,started_at:new Date().toISOString(),checks:[],runs:[]};
const assert=(condition,message)=>{if(!condition)throw new Error(message);evidence.checks.push(message);};
const json=async url=>{const response=await client.get(url);assert(response.ok(),`${url} returned successfully`);return response.json();};
await mkdir('artifacts/personas',{recursive:true});
try{
  const health=await json('/api/health');assert(health.database==='connected','Lakebase is connected');
  const readiness=await json('/api/catalog/readiness');assert(readiness.ready===readiness.total&&readiness.total>0,'Live catalog passes all completeness checks');evidence.readiness=readiness;
  const feed=await json('/api/catalog/feed');assert(feed.products.length===readiness.total&&feed.sandbox===true,'Feed exports the live catalog with its sandbox disclosure');
  const before=await json('/api/insights');
  const invalid=await client.post('/api/agent/run',{data:{message:'Hello',experience:{persona:'unknown',profile:'lea',channel:'gifting',voice:'concise'}}});assert(invalid.status()===422,'Invalid context is rejected before starting a model run');
  for(const sample of [{profile:'lea',channel:'gifting',voice:'concise',message:'Choose a thoughtful gift kit for a friend who sketches. Use my profile budget, check stock and render the complete selection. Do not prepare checkout.',budget:10000},{profile:'alex',channel:'storefront',voice:'editorial',message:'Choose my workday kit with a laptop bag and charger. Use my profile budget, check stock and render the complete selection. Do not prepare checkout.',budget:20000}]){
    console.log(`Running real ${sample.profile} recommendation…`);
    const response=await client.post('/api/agent/run',{data:{message:sample.message,experience:{persona:'shopper',profile:sample.profile,channel:sample.channel,voice:sample.voice}}});
    assert(response.ok(),`${sample.profile} agent endpoint succeeded`);
    const events=(await response.text()).split('\n').filter(line=>line.startsWith('data: ')).map(line=>JSON.parse(line.slice(6)));
    const errors=events.filter(e=>e.type==='RUN_ERROR');const cards=events.filter(e=>e.name==='shopibricks.ui'&&e.value?.kind==='products').map(e=>e.value);
    evidence.runs.push({profile:sample.profile,events});
    assert(errors.length===0,`${sample.profile} completed without an agent error: ${errors.map(e=>e.message).join('; ')}`);
    assert(events.some(e=>e.type==='RUN_FINISHED')&&cards.length>0,`${sample.profile} produced real recommendation cards`);
    assert(cards.every(card=>card.total_cents<=sample.budget),`${sample.profile} recommendations respect the server-enforced profile budget`);
    assert(events.some(e=>e.name==='shopibricks.context'&&e.value.budget_cents===sample.budget),`${sample.profile} context and budget appear in persisted protocol events`);
    assert(events.some(e=>e.toolCallName==='get_inventory'),`${sample.profile} checks live inventory`);
    console.log(`${sample.profile}: ${cards.at(-1).total_cents/100} EUR; completed.`);
  }
  const insights=await json('/api/insights');assert(insights.requests===before.requests+2&&insights.recommended>=2,'Actual shopper runs and recommendations appear in intent analytics');evidence.insights=insights;
  const filtered=await json('/api/insights?profile=lea&channel=gifting');assert(filtered.requests>=1,'Insight filters return the requested shopper and experience');
  const outsider=await request.newContext({baseURL});const empty=await (await outsider.get('/api/insights')).json();await outsider.dispose();assert(empty.requests===0,'A fresh local session does not see another session’s demand signals');
  evidence.passed=true;
}catch(error){evidence.passed=false;evidence.error=String(error);throw error;}
finally{await writeFile('artifacts/personas/live-results.json',JSON.stringify(evidence,null,2));await client.dispose();console.log(JSON.stringify({passed:evidence.passed,checks:evidence.checks.length,error:evidence.error}));}
