import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {clusterQueries,activityQueries,buildAtlas} from '../server/intelligence.js';
import {exampleQueries} from '../shared/intelligence.js';
import {defaultExperience} from '../shared/experience.js';
import type {Product,ProtocolEvent} from '../server/types.js';
const products:Product[]=JSON.parse(readFileSync('server-products.json','utf8'));
const examples=exampleQueries();
test('Clustering deterministically assigns every question and preserves counts',()=>{
 const first=clusterQueries(examples.map(q=>q.text),6),second=clusterQueries(examples.map(q=>q.text),6);
 assert.deepEqual(first,second);assert.equal(first.assignments.length,72);assert.ok(new Set(first.assignments).size>=3);
 const atlas=buildAtlas(examples,products,{source:'examples',clusters:6});
 assert.equal(atlas.clusters.reduce((n,c)=>n+c.count,0),72);
 assert.equal(atlas.summary.matched+atlas.summary.gaps,72);
 assert.ok(atlas.queries.every(q=>atlas.clusters.some(c=>c.id===q.cluster)));
 assert.ok(atlas.queries.every(q=>q.matches.every(m=>products.some(p=>p.id===m.id))));
 assert.ok(atlas.queries.every(q=>!q.observed));assert.match(atlas.sourceLabel,/Fictional/);
 mkdirSync('../tests/artifacts/atlas',{recursive:true});writeFileSync('../tests/artifacts/atlas/fixture.json',JSON.stringify(atlas,null,2));
});
test('Empty, duplicate and punctuation-only questions never crash the atlas',()=>{
 assert.deepEqual(clusterQueries([],6).assignments,[]);
 const empty=buildAtlas([],products,{source:'activity',clusters:6});assert.equal(empty.summary.queries,0);assert.equal(empty.clusters.length,0);
 for(const text of ['!!!','the for of','headphones']){const a=buildAtlas([0,1].map(i=>({id:String(i),text,profile:'camille',channel:'storefront'})),products,{source:'examples',clusters:8});assert.equal(a.clusters.length,1);assert.equal(a.clusters[0].count,2);assert.ok(a.clusters[0].label.length>0);}
});
test('Coverage distinguishes missing assortment, unavailable stock and price caps',()=>{
 const signal=(text:string)=>[{id:'q',text,profile:'camille' as const,channel:'storefront' as const}];
 assert.equal(buildAtlas(signal('running shoes under €100'),products,{source:'examples',clusters:6}).queries[0].status,'uncovered');
 const headphones=products.filter(p=>p.id==='sb-headphones');assert.equal(headphones.length,1);
 assert.equal(buildAtlas(signal('Forma Headphones under €5'),headphones,{source:'examples',clusters:6}).queries[0].status,'budget');
 assert.equal(buildAtlas(signal('Forma Headphones'),headphones.map(p=>({...p,stock:0})),{source:'examples',clusters:6}).queries[0].status,'stock');
 const match=buildAtlas(signal('Forma Headphones under €250'),headphones,{source:'examples',clusters:6}).queries[0];assert.equal(match.status,'matched');assert.equal(match.matches[0].id,headphones[0].id);
});
test('Activity excludes legacy and business contexts and links actual outcomes by run',()=>{
 const context=(id:string,value:object):ProtocolEvent=>({type:'CUSTOM',timestamp:1,runId:id,name:'shopibricks.context',value});
 const events=[context('legacy',{experience:defaultExperience,intent:'work'}),context('merchant',{experience:{...defaultExperience,persona:'merchant'},query:'Orders?'}),context('shopper',{experience:defaultExperience,query:'Find headphones',budget_cents:25000}),{type:'CUSTOM',timestamp:2,runId:'shopper',name:'shopibricks.ui',value:{kind:'products',products:[products[0]]}},{type:'RUN_ERROR',timestamp:3,runId:'unrelated'}];
 const actual=activityQueries(events);assert.equal(actual.length,1);assert.equal(actual[0].text,'Find headphones');assert.equal(actual[0].observed?.recommended,true);assert.equal(actual[0].observed?.failed,false);
 const atlas=buildAtlas(actual,products,{source:'activity',clusters:6,truncated:true});assert.equal(atlas.truncated,true);assert.equal(atlas.source,'activity');assert.match(atlas.method,/not observed recommendations/);
});
test('Activity is bounded to the latest 180 captured questions',()=>{
 const events=Array.from({length:200},(_,i)=>({type:'CUSTOM',timestamp:i,runId:String(i),name:'shopibricks.context',value:{experience:defaultExperience,query:`Query ${i}`}}));
 const queries=activityQueries(events);assert.equal(queries.length,180);assert.equal(queries[0].id,'199');assert.equal(queries.at(-1)?.id,'20');
});
