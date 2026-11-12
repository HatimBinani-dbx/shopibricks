import test from 'node:test';
import assert from 'node:assert/strict';
import { extractEuroBudget, productSelection, requestsComparison, resolveEuroBudget } from '../server/product-ui.js';
import type { Product } from '../server/types.js';
const items=[{id:'bag',price_cents:7900},{id:'bottle',price_cents:2900},{id:'headphones',price_cents:12900}].map(item=>({...item,name:item.id,category:'Test',description:'Fixture',currency:'eur',stock:1,color:'#fff',image_kind:'tote',tags:[]} satisfies Product));
test('Selection heading derives €237 from all three authoritative rows',()=>{const ui=productSelection(items,'shortlist');assert.equal(ui.total_cents,23700);assert.equal(ui.headline,'Your selection · €237 total');assert.equal(ui.products.length,3);});
test('Comparison has no combined total for alternatives',()=>{const ui=productSelection(items.slice(0,2),'compare',{allowComparison:true,budgetCents:5000});assert.equal(ui.headline,'Compare 2 products');assert.equal('total_cents' in ui,false);});
test('Explicit EUR budget forms are parsed as integer cents',()=>{
 for(const message of ['Build a Paris weekend kit under €250.','max€250','budget€250','Stay under 250EUR','My budget is 250 EUR.','A 250 euro budget','€250 maximum'])assert.equal(extractEuroBudget(message),25000,message);
 assert.equal(extractEuroBudget('Budget: €250.50'),25050);
 assert.equal(extractEuroBudget('Budget de 250,50 EUR'),25050);
 assert.equal(extractEuroBudget('Budget €1,250.50'),125050);
 assert.equal(extractEuroBudget('Budget 1.250,50 EUR'),125050);
 assert.equal(extractEuroBudget('Under €250, actually max €300.'),30000);
});
test('Product prices and non-EUR prices do not create a budget',()=>{
 for(const message of ['The headphones cost €129.','The €79 bag looks nice.','There are 250 products.','Budget $250','Under £250'])assert.equal(extractEuroBudget(message),undefined,message);
});
test('Follow-up shopping keeps the latest user budget and supports overrides/removal',()=>{
 const history=[{role:'user',content:'Build a kit under €250.'},{role:'assistant',content:'A budget of €900 would buy everything.'},{role:'user',content:'Actually my budget is 200 EUR.'}];
 assert.equal(resolveEuroBudget('Replace the out-of-stock headphones.',history),20000);
 assert.equal(resolveEuroBudget('Now make it under €300.',history),30000);
 assert.equal(resolveEuroBudget('Forget the budget.',history),undefined);
 assert.equal(resolveEuroBudget('Choose something else.',[...history,{role:'user',content:'No budget limit.'}]),undefined);
});
test('Shortlist over the authoritative budget is rejected with prices for retry',()=>{
 assert.throws(()=>productSelection(items,'shortlist',{budgetCents:20000}),/Selection total €237 \(23700 cents\) exceeds the user's budget €200 \(20000 cents\).*Nothing was rendered.*retry render_products/);
 assert.equal(productSelection(items,'shortlist',{budgetCents:23700}).total_cents,23700);
 assert.equal(productSelection(items,'shortlist',{budgetCents:25000}).total_cents,23700);
});
test('Comparison requires the user to ask for alternatives and cannot bypass a kit budget',()=>{
 assert.equal(requestsComparison('Build a kit under €250. Check stock and show me the choices.'),false);
 assert.equal(requestsComparison('Compare the Forma Headphones and Echo Earbuds.'),true);
 assert.equal(requestsComparison('Show headphones versus earbuds side by side.'),true);
 assert.throws(()=>productSelection(items,'compare',{budgetCents:20000,allowComparison:false}),/did not request a comparison/);
});
