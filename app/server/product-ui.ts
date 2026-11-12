import type { Product } from './types.js';

type UserMessage={role:string;content:string};
const euro=(cents:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:cents%100?2:0}).format(cents/100);
const numberPattern='(?:\\d{1,3}(?:[ ,.\\u00a0\\u202f]\\d{3})+|\\d+)(?:[,.]\\d{1,2})?';
const budgetBefore=/(?:\b(?:under|below|maximum|max|budget|limit|spend|spending)|\bat most|\bup to|\bless than|\bno more than|\bnot more than|\bcap it at|\bmoins de|\bjusqu['’]à|\bplafond)\s*(?:(?:of|is|at|to|de|est|a|à|:|=|\.)\s*)*$/i;
const budgetAfter=/^\s*(?:total\s+)?(?:budget|maximum|max\b|limit|plafond)/i;
const noBudget=/(?:\b(?:no|without|unlimited)\s+(?:a\s+)?budget\b|\b(?:ignore|forget|remove|drop)\s+(?:the\s+|my\s+)?(?:budget|spending limit)\b|\bsans (?:limite|budget)\b)/i;

function amountCents(value:string):number|undefined{
 const compact=value.replace(/[ \u00a0\u202f]/g,'');
 const decimal=compact.match(/[.,](\d{1,2})$/);
 const whole=(decimal?compact.slice(0,decimal.index):compact).replace(/[.,]/g,'');
 const cents=Number(whole)*100+Number(decimal?.[1].padEnd(2,'0')||0);
 return Number.isSafeInteger(cents)&&cents>0?cents:undefined;
}

/** Recognize an explicit spending cap, not a product price quoted in conversation. */
export function extractEuroBudget(message:string):number|undefined{
 const money=new RegExp(`(?:€|EUR\\b|euros?\\b)\\s*(${numberPattern})(?!\\d)|(${numberPattern})\\s*(?:€|EUR\\b|euros?\\b)`,'gi');
 let budget:number|undefined;
 for(const match of message.matchAll(money)){
  const before=message.slice(0,match.index);
  const after=message.slice(match.index!+match[0].length);
  if(budgetBefore.test(before)||budgetAfter.test(after))budget=amountCents(match[1]||match[2]);
 }
 return budget;
}

/** A thread keeps the user's latest cap until the user changes or removes it. */
export function resolveEuroBudget(message:string,history:UserMessage[]=[],defaultBudget?:number):number|undefined{
 for(const turn of [{role:'user',content:message},...history.slice().reverse()]){
  if(turn.role!=='user')continue;
  const budget=extractEuroBudget(turn.content);
  if(budget!==undefined)return budget;
  if(noBudget.test(turn.content))return undefined;
 }
 return defaultBudget;
}

export function requestsComparison(message:string):boolean{
 return /\b(?:compare|comparison|comparing|versus|vs|comparer|comparaison)\b|\bside[ -]by[ -]side\b/i.test(message);
}

/** Price-bearing UI copy is derived only from authoritative catalog rows. */
type ProductSelection={kind:'products';product_ids:string[];products:Product[];headline:string}&({mode:'shortlist';total_cents:number}|{mode:'compare';total_cents?:never});
export function productSelection(products:Product[],mode:'shortlist'|'compare',options:{budgetCents?:number;allowComparison?:boolean}={}):ProductSelection{
 const selection={kind:'products' as const,mode,product_ids:products.map(product=>product.id),products};
 if(mode==='compare'){
  if(!options.allowComparison)throw new Error('The user did not request a comparison. Render a shortlist containing the complete chosen kit, not all alternative options, and keep its combined total within the user budget.');
  return{...selection,mode:'compare',headline:`Compare ${products.length} products`};
 }
 const total_cents=products.reduce((sum,product)=>sum+product.price_cents,0);
 if(options.budgetCents!==undefined&&total_cents>options.budgetCents)throw new Error(`Selection total ${euro(total_cents)} (${total_cents} cents) exceeds the user's budget ${euro(options.budgetCents)} (${options.budgetCents} cents). Nothing was rendered. Choose fewer or cheaper complementary products from the catalog and retry render_products with the complete kit within budget.`);
 return{...selection,mode:'shortlist',total_cents,headline:`Your selection · ${euro(total_cents)} total`};
}
