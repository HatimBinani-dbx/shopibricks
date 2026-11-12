import type { Product } from '../server/types';

export const personas = [
  {id:'shopper', label:'Shopper', name:'Discover & shop', tab:'Shop', detail:'Find the right things for your life.'},
  {id:'merchant', label:'Merchant', name:'Grow your brand', tab:'Growth studio', detail:'Understand demand. Improve discovery.'},
  {id:'developer', label:'Developer', name:'Connect & inspect', tab:'Protocol studio', detail:'Follow the tools behind every journey.'},
] as const;
export const profiles = [
  {id:'camille',heroIds:['sb-headphones','sb-tote','sb-bottle'],name:'Camille',initials:'CM',title:'The Paris weekender',budget:25000,intent:'weekend',tags:['travel','wireless','everyday'],context:'A weekend in Paris by train. Wants wireless audio and a useful bag.',history:'Previously explored compact travel essentials.',headline:'A little Paris.',emphasis:'A lot of possibility.',cta:'Curate my weekend',prompt:'Build a Paris weekend kit under €250. Include one audio product and something to carry. Check stock and show me the choices.'},
  {id:'alex',heroIds:['sb-backpack','sb-charger','sb-headphones'],name:'Alex',initials:'AL',title:'The focused commuter',budget:20000,intent:'work',tags:['work','laptop','noise cancelling','usb-c'],context:'Works between home, a café and the office. Prioritizes focus and a light daily carry.',history:'Previously explored laptop bags and USB-C accessories.',headline:'Less to carry.',emphasis:'More room to focus.',cta:'Build my workday kit',prompt:'Build my commuter workday kit under €200. Prioritize a laptop bag and a compact charger. Check stock and show the complete kit.'},
  {id:'lea',heroIds:['sb-notebook','sb-scarf','sb-bottle'],name:'Léa',initials:'LM',title:'The thoughtful gift giver',budget:10000,intent:'gift',tags:['creative','style','paper','everyday'],context:'Choosing a useful, thoughtful gift for a friend who sketches and enjoys everyday design.',history:'Previously explored stationery and small accessories.',headline:'A small gesture.',emphasis:'A lasting impression.',cta:'Find a thoughtful gift',prompt:'Find a thoughtful gift set under €100 for a friend who loves sketching and good design. Check stock and show complementary products.'},
  {id:'noor',heroIds:['sb-camera','sb-notebook','sb-tote'],name:'Noor',initials:'NR',title:'The everyday creator',budget:30000,intent:'creative',tags:['photography','creative','travel','tech'],context:'Photographs city walks and captures ideas on the go. Wants a camera and practical creative essentials.',history:'Previously explored compact cameras and notebooks.',headline:'Follow your eye.',emphasis:'Capture the everyday.',cta:'Curate my creative kit',prompt:'Build a city photography kit under €300 with a compact camera and something for capturing ideas. Check stock and show the complete kit.'},
] as const;
export const channels = [
  {id:'storefront',label:'ShopiBricks',description:'Your general shopping concierge',instruction:'Offer broad discovery across the catalog.'},
  {id:'travel',label:'Travel planner',description:'A specialist experience inside this demo',instruction:'Prioritize portability, travel context and complementary essentials. Use only supported product attributes.'},
  {id:'gifting',label:'Gift advisor',description:'A specialist experience inside this demo',instruction:'Help select gifts using stated interests, usefulness and budget. Ask for the recipient interests if missing. Do not infer sensitive traits.'},
] as const;
export const voices = [
  {id:'editorial',label:'Editorial',description:'Warm, considered, quietly confident.',instruction:'Use warm, considered editorial language. Be specific rather than promotional.'},
  {id:'concise',label:'Concise',description:'Clear facts. A quick path to a decision.',instruction:'Use short direct sentences. Lead with fit, price and availability. Avoid decorative language.'},
  {id:'playful',label:'Playful',description:'Light, curious, full of everyday possibility.',instruction:'Use a light, playful tone while staying factual. Never invent product claims or urgency.'},
] as const;
export type Persona = typeof personas[number]['id'];
export type ProfileId = typeof profiles[number]['id'];
export type ChannelId = typeof channels[number]['id'];
export type VoiceId = typeof voices[number]['id'];
export type Experience = {persona:Persona;profile:ProfileId;channel:ChannelId;voice:VoiceId};
export const defaultExperience:Experience = {persona:'shopper',profile:'camille',channel:'storefront',voice:'editorial'};
export function profileFor(id:ProfileId){return profiles.find(p=>p.id===id)!;}
export function matchingTags(product:Product,id:ProfileId):string[]{
  const tags:readonly string[]=profileFor(id).tags;
  return product.tags.filter(tag=>tags.includes(tag));
}
export function rankProducts(products:Product[],id:ProfileId):Product[]{
  const score=(p:Product)=>(p.stock>0?100:0)+matchingTags(p,id).length*10+(p.price_cents<=profileFor(id).budget?1:0);
  return [...products].sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id));
}
export function brandPreview(product:Product,voice:VoiceId){
  const price=new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(product.price_cents/100);
  const fact=product.description.split('.')[0];
  if(voice==='concise')return `${product.name}. ${price}, VAT included. ${fact}. ${product.stock>0?'In stock.':'Currently out of stock.'}`;
  if(voice==='playful')return `Meet your next good find: ${product.name}. ${fact}. Yours to consider at ${price}, VAT included. ${product.stock>0?'Available now.':'Back on your list when stock returns.'}`;
  return `${product.name}, considered for your everyday. ${fact}. ${price}, VAT included. ${product.stock>0?'Available in our collection.':'Currently unavailable.'}`;
}
