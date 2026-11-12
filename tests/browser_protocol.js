/*
 * Run in the authenticated ShopiBricks browser page using DevTools.
 * This test creates ONE sandbox order and consumes ONE notebook unit.
 * It makes no payment-provider request. It requires explicit sandbox opt-in.
 *
 * Load this file into a DevTools evaluate-script call, then invoke:
 *   await window.runShopiBricksChecks({confirmSandboxWrite: true})
 * Keep its returned JSON with the presentation verification artifacts.
 */
window.runShopiBricksChecks = async function ({confirmSandboxWrite = false} = {}) {
  if (!confirmSandboxWrite) throw new Error('Explicit sandbox test opt-in is required.');
  const prefix = `review-${crypto.randomUUID()}`;
  const observations = [];
  const startedAt = new Date().toISOString();
  function check(name, condition, detail) {
    observations.push({name, passed: Boolean(condition), detail});
    if (!condition) throw new Error(`${name}: ${JSON.stringify(detail)}`);
  }
  async function call(path, {method = 'GET', body, key} = {}) {
    const requestId = crypto.randomUUID();
    const headers = {'Accept': 'application/json', 'Request-Id': requestId};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (key) headers['Idempotency-Key'] = key;
    const response = await fetch(path, {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(45000),
    });
    const text = await response.text();
    let json;
    try { json = JSON.parse(text); } catch { json = {unparseable: text.slice(0, 300)}; }
    return {status: response.status, json, requestId: response.headers.get('request-id'), expectedRequestId: requestId};
  }
  try {
    const initial = await call('/api/products');
    check('Product API is available', initial.status === 200 && Array.isArray(initial.json.products), initial.status);
    const product = initial.json.products.find(p => p.id === 'sb-notebook');
    check('Test product has available persisted stock', product?.stock > 0, product && {id: product.id, stock: product.stock});
    const address = {name: 'ShopiBricks Demo', line_one: '1 rue de la Demo', city: 'Paris', country: 'FR', postal_code: '75002'};
    const buyer = {name: 'ShopiBricks Demo', email: 'demo@example.com'};
    const input = {items: [{id: product.id, quantity: 1}], buyer, fulfillment_address: address};

    for (const [name, items] of [
      ['Negative quantity rejected', [{id: product.id, quantity: -1}]],
      ['Fractional quantity rejected', [{id: product.id, quantity: 1.5}]],
      ['Duplicate SKU rejected', [{id: product.id, quantity: 1}, {id: product.id, quantity: 1}]],
      ['Unknown SKU rejected', [{id: 'sb-does-not-exist', quantity: 1}]],
    ]) {
      const result = await call('/checkout_sessions', {method: 'POST', body: {...input, items}, key: `${prefix}-${observations.length}`});
      check(name, result.status >= 400 && result.status < 500, {status: result.status, error: result.json});
    }

    const noAddress = await call('/checkout_sessions', {method: 'POST', body: {items: input.items}, key: `${prefix}-address`});
    check('Missing address leaves checkout unready', noAddress.status === 201 && noAddress.json.status === 'not_ready_for_payment', {http: noAddress.status, state: noAddress.json.status});
    const canceled = await call(`/checkout_sessions/${noAddress.json.id}/cancel`, {method: 'POST', body: {}, key: `${prefix}-cancel`});
    check('Open checkout can be canceled', canceled.status === 200 && canceled.json.status === 'canceled', canceled);
    const canceledAgain = await call(`/checkout_sessions/${noAddress.json.id}/cancel`, {method: 'POST', body: {}, key: `${prefix}-cancel-again`});
    check('Terminal cancel returns ACP 405', canceledAgain.status === 405, canceledAgain);

    const created = await call('/checkout_sessions', {method: 'POST', body: input, key: `${prefix}-create`});
    check('Authoritative cart created ready for payment', created.status === 201 && created.json.status === 'ready_for_payment', {http: created.status, state: created.json.status});
    check('Create echoes request correlation ID', created.requestId === created.expectedRequestId, {received: created.requestId, expected: created.expectedRequestId});
    check('Cart totals use EUR minor units', created.json.currency === 'eur' && created.json.totals.every(t => Number.isInteger(t.amount)), created.json.totals);
    const total = created.json.totals.find(t => t.type === 'total')?.amount;
    check('Cart total comes from persisted product price', total === product.price_cents, {actual: total, expected: product.price_cents});
    check('Sandbox payment disclosure is present', JSON.stringify(created.json.messages).toLowerCase().includes('sandbox'), created.json.messages);

    const createReplay = await call('/checkout_sessions', {method: 'POST', body: input, key: `${prefix}-create`});
    check('Create retry returns same checkout', createReplay.status === 201 && createReplay.json.id === created.json.id, {first: created.json.id, retry: createReplay.json.id});
    const conflict = await call('/checkout_sessions', {method: 'POST', body: {...input, items: [{id: product.id, quantity: 2}]}, key: `${prefix}-create`});
    check('Changed body with reused idempotency key is rejected', conflict.status >= 400 && conflict.status < 500 && JSON.stringify(conflict.json).includes('request_not_idempotent'), conflict);

    const completePath = `/checkout_sessions/${created.json.id}/complete`;
    const payment = {provider: 'stripe', token: 'shopibricks_sandbox'};
    const missingConfirmation = await call(`/api/checkout/${created.json.id}/complete`, {method: 'POST', body: {buyer, payment_data: payment}, key: `${prefix}-missing-confirmation`});
    check('Browser checkout requires explicit human confirmation', missingConfirmation.status >= 400 && missingConfirmation.status < 500, missingConfirmation);
    const denied = await call(completePath, {method: 'POST', body: {confirmed: false, buyer, payment_data: payment}, key: `${prefix}-unconfirmed`});
    check('Explicitly denied confirmation cannot complete checkout', denied.status >= 400 && denied.status < 500, denied);
    const completed = await call(completePath, {method: 'POST', body: {confirmed: true, buyer, payment_data: payment}, key: `${prefix}-complete`});
    check('Sandbox completion persists an order', completed.status === 200 && completed.json.status === 'completed' && Boolean(completed.json.order?.id), {http: completed.status, state: completed.json.status, order: completed.json.order});
    check('Completion echoes request correlation ID', completed.requestId === completed.expectedRequestId, {received: completed.requestId, expected: completed.expectedRequestId});
    const completedReplay = await call(completePath, {method: 'POST', body: {confirmed: true, buyer, payment_data: payment}, key: `${prefix}-complete`});
    check('Completion retry returns same order', completedReplay.status === 200 && completedReplay.json.order?.id === completed.json.order?.id, {first: completed.json.order?.id, retry: completedReplay.json.order?.id});
    const differentKey = await call(completePath, {method: 'POST', body: {confirmed: true, buyer, payment_data: payment}, key: `${prefix}-complete-again`});
    check('Second completion cannot create a second order', (differentKey.status === 200 && differentKey.json.order?.id === completed.json.order?.id) || [405,409].includes(differentKey.status), differentKey);

    const after = await call('/api/products');
    const updated = after.json.products.find(p => p.id === product.id);
    check('Inventory decremented exactly once', updated.stock === product.stock - 1, {before: product.stock, after: updated.stock});
    const terminalUpdate = await call(`/checkout_sessions/${created.json.id}`, {method: 'POST', body: {...input, items: [{id: product.id, quantity: 2}]}, key: `${prefix}-terminal-update`});
    check('Completed checkout cannot be edited', [405,409].includes(terminalUpdate.status), terminalUpdate);
    const terminalCancel = await call(`/checkout_sessions/${created.json.id}/cancel`, {method: 'POST', body: {}, key: `${prefix}-terminal-cancel`});
    check('Completed checkout cannot be canceled', terminalCancel.status === 405, terminalCancel);

    const operations = await call('/api/operations');
    check('Operations API returns a result', operations.status === 200, operations.status);
    const events = await call('/api/events');
    check('Persisted protocol/event API returns a result', events.status === 200, events.status);
    return {passed: true, origin: location.origin, startedAt, completedAt: new Date().toISOString(), orderId: completed.json.order.id, observations};
  } catch (error) {
    return {passed: false, origin: location.origin, startedAt, completedAt: new Date().toISOString(), error: String(error), observations};
  }
};
