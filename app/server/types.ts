export interface Product { id: string; name: string; category: string; description: string; price_cents: number; currency: string; stock: number; color: string; image_kind: string; tags: string[]; updated_at?: string }
export interface Item { id: string; quantity: number }
export interface Buyer { name: string; email: string; phone_number?: string }
export interface Address { name: string; line_one: string; line_two?: string; city: string; state?: string; country: string; postal_code: string }
export interface CheckoutInput { items: Item[]; buyer?: Buyer; fulfillment_address?: Address; fulfillment_option_id?: string }
export interface Checkout extends CheckoutInput {
 id: string; status: 'not_ready_for_payment'|'ready_for_payment'|'completed'|'canceled'; currency: string;
 payment_provider: { provider: 'stripe'; supported_payment_methods: ['card'] };
 line_items: { id: string; item: Item; base_amount: number; discount: number; subtotal: number; tax: number; total: number }[];
 totals: { type: string; display_text: string; amount: number }[];
 fulfillment_options: Record<string, unknown>[];
 messages: {type:'info'|'error'; code?:string; param?:string; content_type:'plain'; content:string}[];
 links: { type: string; url: string }[];
 order?: {id:string;checkout_session_id:string;permalink_url:string};
}
export type ProtocolEvent = { id?: number; type: string; timestamp: number; runId?: string; agent?: string; [key: string]: unknown };
