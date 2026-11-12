/**
 * Integration regressions against the dedicated ShopiBricks Lakebase schema.
 * Run from app/: node --import tsx ../tests/checkout_regressions.ts
 * Uses a temporary SKU cloned from the persisted notebook; no shared SKU is altered.
 * All temporary records are removed in finally; CDC retains its normal audit history.
 */
import {existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';

if (existsSync('.env')) process.loadEnvFile('.env');
const {initialize, getPool, transaction, createCheckout, completeCheckout, CommerceError} = await import('../app/server/db.ts');
const suffix = randomUUID();
const sku = `zz-regression-${suffix}`;
const ownerPrefix = `integration-regression-${suffix}`;
const checkoutIds: string[] = [];
const observations: Array<{name: string; passed: boolean; detail?: unknown}> = [];
const report: Record<string, unknown> = {startedAt: new Date().toISOString(), temporarySku: sku, observations};
let failure: unknown;
const input = {
  items: [{id: sku, quantity: 1}],
  buyer: {name: 'ShopiBricks Integration Test', email: 'demo@example.com'},
  fulfillment_address: {name: 'ShopiBricks Integration Test', line_one: '1 rue de la Demo', city: 'Paris', state: 'IDF', country: 'FR', postal_code: '75002'},
};

try {
  await initialize();
  const pool = getPool();
  const seeded = await pool.query(`
    INSERT INTO shopibricks.products(id,name,category,description,price_cents,currency,stock,color,image_kind,tags)
    SELECT $1,name||' (temporary integration test)',category,description,price_cents,currency,5,color,image_kind,tags
    FROM shopibricks.products WHERE id='sb-notebook' RETURNING price_cents`, [sku]);
  assert.equal(seeded.rowCount, 1, 'Authoritative notebook source must exist');
  const originalPrice = seeded.rows[0].price_cents;
  report.sourcePriceCents = originalPrice;

  const priceOwner = `${ownerPrefix}-price`;
  const quote = await transaction(c => createCheckout(c, priceOwner, input));
  checkoutIds.push(quote.id);
  assert.equal(quote.status, 'ready_for_payment');
  await pool.query('UPDATE shopibricks.products SET price_cents=$1 WHERE id=$2', [originalPrice + 100, sku]);
  let priceError: unknown;
  try {
    await transaction(c => completeCheckout(c, quote.id, priceOwner, input.buyer));
  } catch (error) { priceError = error; }
  assert.ok(priceError instanceof CommerceError && priceError.code === 'price_changed', 'Completing a stale quote with buyer details must reject the changed total');
  const priceState = await pool.query('SELECT stock FROM shopibricks.products WHERE id=$1', [sku]);
  const priceOrders = await pool.query('SELECT count(*)::int count FROM shopibricks.orders WHERE checkout_id=$1', [quote.id]);
  assert.equal(priceState.rows[0].stock, 5, 'Rejected price change cannot consume stock');
  assert.equal(priceOrders.rows[0].count, 0, 'Rejected price change cannot create an order');
  observations.push({name: 'Changed price after review is rejected even with buyer details', passed: true, detail: {reviewed_cents: originalPrice, new_cents: originalPrice + 100, stock_unchanged: 5}});

  await pool.query('UPDATE shopibricks.products SET price_cents=$1,stock=1 WHERE id=$2', [originalPrice, sku]);
  const owners = [`${ownerPrefix}-race-a`, `${ownerPrefix}-race-b`];
  const quotes = await Promise.all(owners.map(owner => transaction(c => createCheckout(c, owner, input))));
  checkoutIds.push(...quotes.map(q => q.id));
  assert.ok(quotes.every(q => q.status === 'ready_for_payment'), 'Both customers must have seen the last available unit');
  const raced = await Promise.all(owners.map((owner, index) => transaction(c => completeCheckout(c, quotes[index].id, owner, input.buyer))));
  const successful = raced.filter(q => q.status === 'completed');
  const unavailable = raced.filter(q => q.status === 'not_ready_for_payment');
  assert.equal(successful.length, 1, 'Exactly one concurrent checkout may win the last unit');
  assert.equal(unavailable.length, 1, 'The other checkout must receive an authoritative unready cart');
  assert.ok(unavailable[0].messages.some(m => m.code === 'out_of_stock'), 'Losing checkout must explain the stock conflict');
  const raceState = await pool.query('SELECT stock FROM shopibricks.products WHERE id=$1', [sku]);
  const raceOrders = await pool.query('SELECT count(*)::int count FROM shopibricks.orders WHERE checkout_id=ANY($1::text[])', [quotes.map(q => q.id)]);
  assert.equal(raceState.rows[0].stock, 0, 'Stock cannot go negative');
  assert.equal(raceOrders.rows[0].count, 1, 'No oversold order may be stored');
  observations.push({name: 'Concurrent buyers cannot oversell the last unit', passed: true, detail: {completed: successful.length, rejected_as_unready: unavailable.length, final_stock: 0, orders: 1}});
  report.passed = true;
} catch (error) {
  failure = error;
  report.passed = false;
  report.error = String(error);
} finally {
  try {
    const pool = getPool();
    await transaction(async c => {
      await c.query('DELETE FROM shopibricks.commerce_events WHERE product_id=$1 OR payload->>\'checkout_id\'=ANY($2::text[]) OR payload->>\'checkout_session_id\'=ANY($2::text[])', [sku, checkoutIds]);
      await c.query('DELETE FROM shopibricks.orders WHERE owner LIKE $1', [`${ownerPrefix}%`]);
      await c.query('DELETE FROM shopibricks.checkouts WHERE owner LIKE $1', [`${ownerPrefix}%`]);
      await c.query('DELETE FROM shopibricks.products WHERE id=$1', [sku]);
    });
    const remaining = await pool.query('SELECT count(*)::int count FROM shopibricks.products WHERE id=$1', [sku]);
    assert.equal(remaining.rows[0].count, 0);
    report.cleanup = 'Temporary SKU, checkout, order and commerce-event rows removed; original product records were unchanged.';
    await pool.end();
  } catch (cleanupError) {
    report.passed = false;
    report.cleanupError = String(cleanupError);
  }
  report.completedAt = new Date().toISOString();
  console.log(JSON.stringify(report, null, 2));
}
if (failure || !report.passed) process.exitCode = 1;
