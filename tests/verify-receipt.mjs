/** Focused receipt regression: controlled API fixtures; no database writes or model calls. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const base = process.env.SHOPIBRICKS_TEST_URL || 'http://localhost:8000';
const artifactDir = fileURLToPath(new URL(`./artifacts/receipt-${new Date().toISOString().replace(/[:.]/g, '-')}/`, import.meta.url));
await mkdir(artifactDir, {recursive: true});
const browser = await chromium.launch({channel: 'chrome', headless: true});
const context = await browser.newContext({viewport: {width: 1440, height: 1000}, reducedMotion: 'reduce'});
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
const result = {checks: [], passed: false};
const products = [
  {id: 'sb-bottle', name: 'Rive Bottle', category: 'Everyday', description: 'A reusable bottle.', price_cents: 2900, currency: 'EUR', stock: 10, color: '#91b6a6', image_kind: 'bottle', tags: []},
  {id: 'sb-camera', name: 'Moment Camera', category: 'Tech', description: 'A compact camera.', price_cents: 17900, currency: 'EUR', stock: 10, color: '#b1b9ac', image_kind: 'camera', tags: []},
];
const checkout = {
  id: 'cs_receipt_fixture', status: 'ready_for_payment', currency: 'EUR',
  items: products.map(product => ({id: product.id, quantity: 1})),
  buyer: {name: 'Camille Receipt', email: 'receipt@example.test'},
  fulfillment_address: {name: 'Camille Receipt', line_one: '10 Rue de Rivoli', line_two: 'Demo apartment 2', city: 'Paris', postal_code: '75001', country: 'FR'},
  payment_provider: {provider: 'stripe', supported_payment_methods: ['card']},
  line_items: products.map((product, index) => ({id: `li_${index}`, item: {id: product.id, quantity: 1}, base_amount: index ? 14917 : 2417, subtotal: index ? 14917 : 2417, discount: 0, tax: index ? 2983 : 483, total: product.price_cents})),
  totals: [{type: 'items_base_amount', display_text: 'Items before VAT', amount: 17334}, {type: 'subtotal', display_text: 'Subtotal before VAT', amount: 17334}, {type: 'tax', display_text: 'VAT (20%)', amount: 3466}, {type: 'fulfillment', display_text: 'Delivery (VAT included)', amount: 0}, {type: 'total', display_text: 'Total', amount: 20800}],
  fulfillment_options: [], messages: [], links: [],
};
const orderId = 'ord_receipt_fixture';
const saved = {...checkout, status: 'completed', order: {id: orderId, checkout_session_id: checkout.id, permalink_url: `${base}/?order=${orderId}`}};
const money = cents => new Intl.NumberFormat('fr-FR', {style: 'currency', currency: 'EUR', maximumFractionDigits: cents % 100 ? 2 : 0}).format(cents / 100);
let changedPrices = false;
let catalogMissing = false;
let orderAvailable = true;
let deferOrder;
let releaseOrder;
const writes = [];
await page.route('**/api/**', async route => {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  const json = body => route.fulfill({status: 200, json: body});
  if (request.method() !== 'GET') writes.push(path);
  if (path === '/api/products') return json({products: catalogMissing ? [] : products.map(product => ({...product, price_cents: changedPrices ? 99900 : product.price_cents}))});
  if (path === '/api/health') return json({database: 'connected', gateway: 'configured'});
  if (path === '/api/whoami') return json({label: 'Receipt regression fixture'});
  if (path === '/api/checkout') return json(checkout);
  if (path === `/api/checkout/${checkout.id}/complete`) return json(saved);
  if (path === `/api/orders/${orderId}`) {
    if (deferOrder) await deferOrder;
    return orderAvailable ? json(saved) : route.fulfill({status: 404, json: {error: {message: 'Order not found.'}}});
  }
  throw new Error(`Unexpected API request: ${request.method()} ${path}`);
});

async function assertReceipt() {
  await page.getByRole('heading', {name: 'Your saved order.', exact: true}).waitFor();
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal(await page.getByRole('link', {name: 'View persisted order', exact: true}).count(), 0);
  assert.equal(await page.getByRole('button', {name: 'Confirm sandbox order', exact: true}).count(), 0);
  assert.equal(await page.getByText(orderId, {exact: true}).count(), 1);
  assert.equal(await page.locator('.receipt-item').count(), 2);
  assert.equal(await page.locator('.receipt-grand-total dd').innerText(), money(20800));
  assert.deepEqual(await page.locator('.receipt-line-price strong').allTextContents(), [money(2900), money(17900)]);
  assert.deepEqual(await page.locator('.receipt-totals dd').allTextContents(), [money(17334), money(3466), money(0), money(20800)]);
  assert.match(await page.locator('.receipt-delivery').innerText(), /receipt@example\.test/);
  assert.match(await page.locator('.receipt-delivery').innerText(), /Demo apartment 2/);
  assert.match(await page.locator('.receipt-delivery').innerText(), /75001 Paris/);
}

try {
  await page.goto(base);
  for (const product of products) await page.getByRole('button', {name: `Add ${product.name} to bag`, exact: true}).click();
  await page.getByRole('button', {name: 'Review bag, 2 items', exact: true}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'Review checkout', exact: true}).click();
  const confirm = page.getByRole('button', {name: 'Confirm sandbox order', exact: true});
  await confirm.waitFor();
  assert.equal(await confirm.isDisabled(), true);
  await page.getByRole('dialog').getByRole('checkbox').check();
  await confirm.click();
  await page.getByRole('heading', {name: 'All yours. In the sandbox.', exact: true}).waitFor();
  changedPrices = true;
  deferOrder = new Promise(resolve => {releaseOrder = resolve;});
  await page.getByRole('link', {name: 'View persisted order', exact: true}).click();
  await page.getByRole('status').getByText('Opening your saved order…', {exact: true}).waitFor();
  result.checks.push('Link navigates to a dedicated receipt with an explicit loading state');
  releaseOrder();
  deferOrder = undefined;
  await assertReceipt();
  result.checks.push('Receipt shows saved lines, VAT, delivery, total and buyer despite catalog price changes');
  await page.screenshot({path: `${artifactDir}/desktop.png`, fullPage: true});
  const writeCount = writes.length;
  await page.reload();
  await assertReceipt();
  assert.equal(writes.length, writeCount);
  result.checks.push('Reload preserves receipt without placing another order');
  for (const width of [390, 320]) {
    await page.setViewportSize({width, height: 844});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({path: `${artifactDir}/mobile-${width}.png`, fullPage: true});
  }
  result.checks.push('Receipt fits 390px and 320px screens without horizontal overflow');
  catalogMissing = true;
  await page.reload();
  await assertReceipt();
  assert.match(await page.locator('.receipt-item').first().innerText(), /sb-bottle/);
  result.checks.push('Missing catalog products keep saved items and totals with SKU fallbacks');
  orderAvailable = false;
  await page.reload();
  await page.getByRole('heading', {name: 'Order unavailable.', exact: true}).waitFor();
  assert.equal(await page.locator('.receipt-item').count(), 0);
  assert.match(await page.getByRole('alert').innerText(), /signed-in account/);
  orderAvailable = true;
  await page.getByRole('button', {name: 'Try again', exact: true}).click();
  await assertReceipt();
  result.checks.push('Unavailable order has a clear error and working retry');
  await page.getByRole('link', {name: 'Back to the collection', exact: true}).click();
  await page.getByRole('heading', {name: 'A little Paris. A lot of possibility.', exact: true}).waitFor();
  assert.equal(new URL(page.url()).searchParams.has('order'), false);
  await page.goBack();
  await assertReceipt();
  result.checks.push('Back-to-collection clears the order URL; browser back restores the receipt');
  assert.equal(writes.length, writeCount);
  assert.deepEqual(pageErrors, []);
  result.passed = true;
} catch (error) {
  result.error = String(error);
  await page.screenshot({path: `${artifactDir}/failure.png`, fullPage: true});
} finally {
  result.pageErrors = pageErrors;
  await writeFile(`${artifactDir}/results.json`, JSON.stringify(result, null, 2));
  await browser.close();
}
console.log(JSON.stringify({...result, artifactDir}, null, 2));
process.exitCode = result.passed ? 0 : 1;
