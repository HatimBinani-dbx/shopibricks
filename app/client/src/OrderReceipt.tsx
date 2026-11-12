import {useEffect, useState} from 'react';
import {ArrowLeft, ArrowRight, CheckCircle2, Database, Package, RefreshCw, ShieldCheck, Truck} from 'lucide-react';
import type {Checkout, Product} from '../../server/types';
import {ProductArt} from './ProductArt';
import {TechBrands} from './Brand';
import './receipt.css';
import {TourButton, receiptTour} from './GuidedTour';

type ReceiptState =
  | {status: 'loading'}
  | {status: 'ready'; checkout: Checkout}
  | {status: 'error'; message: string};

export function OrderReceipt({orderId}: {orderId: string}) {
  const [state, setState] = useState<ReceiptState>({status: 'loading'});
  const [products, setProducts] = useState<Product[]>([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    document.title = 'Your saved order · ShopiBricks';
    const controller = new AbortController();
    setState({status: 'loading'});
    async function loadOrder() {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {signal: controller.signal});
        if (!response.ok) {
          throw new Error(response.status === 404
            ? 'This order is not available to your signed-in account. Check the link and use the account that placed the order.'
            : 'We could not retrieve your saved order. Please try again.');
        }
        const checkout: Checkout = await response.json();
        if (checkout.status !== 'completed' || checkout.order?.id !== orderId) {
          throw new Error('This link does not contain a completed order. Please check the order link.');
        }
        if (!controller.signal.aborted) setState({status: 'ready', checkout});
      } catch (error) {
        if (!controller.signal.aborted) setState({status: 'error', message: error instanceof Error ? error.message : 'Unable to load this order. Please try again.'});
      }
    }
    void loadOrder();
    // Catalog data supplies optional artwork and labels only. All amounts and
    // quantities below come from the saved checkout, even if prices change.
    void fetch('/api/products', {signal: controller.signal})
      .then(async response => {if (response.ok) setProducts((await response.json()).products);})
      .catch(() => {});
    return () => controller.abort();
  }, [orderId, attempt]);

  const checkout = state.status === 'ready' ? state.checkout : undefined;
  const money = (amount: number) => new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: checkout?.currency || 'EUR', maximumFractionDigits: amount % 100 ? 2 : 0,
  }).format(amount / 100);
  const address = checkout?.fulfillment_address;

  return <div className="receipt-page">
    <div className="edition-bar"><span><span className="tiny-dot"/> THE PARIS SESSION <span className="bar-divider">/</span> AT OPENAI HQ</span><span>YOUR ORDER. SAFELY SAVED.</span></div>
    <header className="receipt-nav">
      <a className="brand" href="/" aria-label="ShopiBricks home"><span className="brand-mark" aria-hidden="true">S<span> / </span>B</span>ShopiBricks<span className="brand-period">.</span></a>
      <div className="receipt-nav-actions">{checkout&&<TourButton steps={receiptTour} label="Guide to this receipt"/>}<a className="text-button" href="/"><ArrowLeft size={16}/> Back to the collection</a></div>
    </header>
    <main className="receipt-main">
      {state.status === 'loading' && <section className="receipt-state" role="status"><RefreshCw size={30}/><h1>Opening your saved order…</h1><p>Retrieving your receipt from Lakebase.</p></section>}
      {state.status === 'error' && <section className="receipt-state" role="alert"><Package size={32}/><span className="eyebrow">LET’S FIND YOUR ORDER</span><h1>Order unavailable.</h1><p>{state.message}</p><button className="dark-button" onClick={() => setAttempt(value => value + 1)}>Try again <RefreshCw size={16}/></button></section>}
      {checkout && <>
        <section className="receipt-hero">
          <div><span className="eyebrow">THE DETAILS, KEPT FOR YOU</span><h1>Your saved <em>order.</em></h1><p>A little possibility, now with a paper trail.</p></div>
          <div className="receipt-seal"><CheckCircle2 size={31} strokeWidth={1.5}/><strong>Confirmed</strong><span>Sandbox order</span></div>
          <div className="receipt-reference"><span>ORDER REFERENCE</span><code>{checkout.order?.id}</code><span><Database size={13}/> Retrieved from Lakebase</span></div>
        </section>
        <div className="receipt-grid">
          <div className="receipt-details">
            <section className="receipt-card" aria-labelledby="receipt-items-title">
              <div className="receipt-section-title"><h2 id="receipt-items-title">Your collection</h2><span>{checkout.line_items.reduce((sum, line) => sum + line.item.quantity, 0)} items</span></div>
              <ul className="receipt-items">{checkout.line_items.map(line => {
                const product = products.find(item => item.id === line.item.id);
                return <li className="receipt-item" key={line.id}>
                  <div className="mini-art" aria-hidden="true">{product ? <ProductArt kind={product.image_kind} color={product.color}/> : <Package size={28}/>}</div>
                  <div><h3>{product?.name || line.item.id}</h3><p>Quantity {line.item.quantity}</p><small>{line.item.id}</small></div>
                  <div className="receipt-line-price"><strong>{money(line.total)}</strong><small>VAT included</small></div>
                </li>;
              })}</ul>
              <p className="receipt-caption">Quantities and amounts saved with your order.</p>
            </section>
            <section className="receipt-card receipt-delivery" aria-labelledby="receipt-delivery-title">
              <div className="receipt-section-title"><h2 id="receipt-delivery-title">The delivery details</h2><Truck size={20}/></div>
              <div className="receipt-address-grid">
                <div><h3>Demo customer</h3>{checkout.buyer ? <p>{checkout.buyer.name}<br/>{checkout.buyer.email}</p> : <p>No customer details saved.</p>}</div>
                <div><h3>Demo destination</h3>{address ? <address>{address.name}<br/>{address.line_one}{address.line_two && <><br/>{address.line_two}</>}<br/>{address.postal_code} {address.city}{address.state && <><br/>{address.state}</>}<br/>{address.country}</address> : <p>No delivery address saved.</p>}</div>
              </div>
              <div className="receipt-sandbox"><ShieldCheck size={19}/><p><strong>Presentation sandbox</strong>No payment collected. No shipment or email will be sent.</p></div>
            </section>
          </div>
          <aside className="receipt-card receipt-summary" aria-labelledby="receipt-summary-title">
            <span className="eyebrow">CAPTURED AT CHECKOUT</span><h2 id="receipt-summary-title">The final details.</h2>
            <dl className="receipt-totals">{checkout.totals.filter(total => total.type !== 'items_base_amount').map(total => <div className={total.type === 'total' ? 'receipt-grand-total' : ''} key={total.type}><dt>{total.display_text}</dt><dd>{money(total.amount)}</dd></div>)}</dl>
            <p>These are the amounts recorded when you confirmed this order.</p>
            <div className="receipt-saved-note"><Database size={18}/><span>Saved in Lakebase.<br/>Available from this link.</span></div>
            <a className="dark-button full" href="/">Explore the collection <ArrowRight size={16}/></a>
          </aside>
        </div>
      </>}
      <footer className="receipt-footer"><TechBrands compact/><span>Fictional products. Sandbox checkout. Real data & AI.</span></footer>
    </main>
  </div>;
}
