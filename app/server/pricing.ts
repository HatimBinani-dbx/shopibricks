import { z } from 'zod';
import type { Checkout, CheckoutInput, Product } from './types.js';
export const itemSchema = z.object({ id: z.string().max(100), quantity: z.number().int().min(1).max(10) }).strict();
export const addressSchema = z.object({ name:z.string().min(1).max(256),line_one:z.string().min(1).max(60),line_two:z.string().max(60).optional(),city:z.string().min(1).max(60),state:z.string().max(60).optional(),country:z.literal('FR'),postal_code:z.string().regex(/^\d{5}$/) });
export const buyerSchema = z.object({name:z.string().min(1).max(256),email:z.string().email().max(256),phone_number:z.string().optional()});
export const checkoutSchema = z.object({items:z.array(itemSchema).min(1).max(12),buyer:buyerSchema.optional(),fulfillment_address:addressSchema.optional(),fulfillment_option_id:z.enum(['paris-standard','paris-express']).optional()});
export function priceCheckout(id: string, input: CheckoutInput, products: Product[], publicUrl: string, now = new Date()): Checkout {
 const ids = new Set(input.items.map(x => x.id));
 if (ids.size !== input.items.length) throw new Error('Duplicate product IDs are not allowed; update the quantity instead.');
 const messages: Checkout['messages'] = [{type:'info',param:'$',content_type:'plain',content:'Sandbox order. No payment will be collected and no goods will be shipped.'}];
 const line_items = input.items.map((item,i) => {
   const p = products.find(p => p.id === item.id);
   if (!p) throw new Error(`Unknown product: ${item.id}`);
   if (p.stock < item.quantity) messages.push({type:'error',code:'out_of_stock',param:`$.line_items[${i}]`,content_type:'plain',content:`${p.name} has ${p.stock} units available.`});
   const total = p.price_cents * item.quantity;
   const subtotal = Math.round(total / 1.2);
   return {id:`li_${id}_${i}`,item,base_amount:subtotal,discount:0,subtotal,tax:total-subtotal,total};
 });
 if (!input.fulfillment_address) messages.push({type:'error',code:'missing',param:'$.fulfillment_address',content_type:'plain',content:'Add a delivery address in France to continue.'});
 const fulfillment_option_id = input.fulfillment_address ? input.fulfillment_option_id || 'paris-standard' : undefined;
 const delivery = fulfillment_option_id === 'paris-express' ? 900 : 0;
 const subtotal = line_items.reduce((s,x)=>s+x.subtotal,0);
 const tax = line_items.reduce((s,x)=>s+x.tax,0);
 const deliveryDate=(days:number)=>new Date(now.getTime()+days*86400000).toISOString();
 return {id,...input,payment_provider:{provider:'stripe',supported_payment_methods:['card']},currency:'eur',status:messages.some(x=>x.type==='error')?'not_ready_for_payment':'ready_for_payment',line_items,fulfillment_option_id,
 fulfillment_options:input.fulfillment_address ? [
 {type:'shipping',id:'paris-standard',title:'Standard delivery',subtitle:'2–3 business days · France',carrier:'ShopiBricks Sandbox',earliest_delivery_time:deliveryDate(2),latest_delivery_time:deliveryDate(3),subtotal:0,tax:0,total:0},
 {type:'shipping',id:'paris-express',title:'Express delivery',subtitle:'Next business day · France',carrier:'ShopiBricks Sandbox',earliest_delivery_time:deliveryDate(1),latest_delivery_time:deliveryDate(2),subtotal:750,tax:150,total:900}
 ]:[],totals:[{type:'items_base_amount',display_text:'Items before VAT',amount:subtotal},{type:'subtotal',display_text:'Subtotal before VAT',amount:subtotal},{type:'tax',display_text:'VAT (20%)',amount:tax},{type:'fulfillment',display_text:'Delivery (VAT included)',amount:delivery},{type:'total',display_text:'Total',amount:subtotal+tax+delivery}],messages,
 links:[{type:'terms_of_use',url:`${publicUrl}/legal/terms`},{type:'privacy_policy',url:`${publicUrl}/legal/privacy`}],};
}
