/**
 * Repeatable local browser checks in an isolated Chrome instance.
 * Never attaches to, closes or changes the presenter's normal browser profile.
 * Usage: npm run verify -- --ui
 * Full rendered shopper flow: npm run verify -- --flow
 * --protocol creates one sandbox order and consumes one notebook unit.
 * --flow makes two real agent requests and confirms one sandbox notebook order.
 */
import {chromium} from 'playwright';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const flags = new Set(process.argv.slice(2));
const url = process.env.SHOPIBRICKS_TEST_URL || 'http://localhost:8000';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const artifacts = path.join(here, 'artifacts', stamp);
await mkdir(artifacts, {recursive: true});
const browser = await chromium.launch({channel: 'chrome', headless: true});
const context = await browser.newContext({viewport: {width: 1440, height: 900}});
const page = await context.newPage();
await page.emulateMedia({reducedMotion: 'reduce'});
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
page.on('console', message => {if (message.type() === 'error') consoleErrors.push(message.text());});
const result = {url, startedAt: new Date().toISOString(), checks: {}};
const assert = (condition, message) => {if (!condition) throw new Error(message);};
const shot = name => page.screenshot({path: path.join(artifacts, `${name}.png`), fullPage: true, animations: 'disabled'});
async function checkAgentUi(prompt, cardKind) {
  const beforeCards = await page.locator('.generated-card').count();
  const beforeErrors = await page.locator('.message.error').count();
  await page.getByRole('textbox', {name: 'Ask your shopping concierge'}).fill(prompt);
  await page.getByRole('button', {name: 'Send message', exact: true}).click();
  await page.getByRole('button', {name: 'Stop agent run', exact: true}).waitFor({timeout: 10000});
  const activeAgents = new Set();
  const begin = Date.now();
  while (await page.getByRole('button', {name: 'Stop agent run', exact: true}).isVisible()) {
    for (const name of await page.locator('.agent.active').allTextContents()) activeAgents.add(name.trim());
    if (Date.now() - begin > 180000) throw new Error('Rendered agent run exceeded 180 seconds');
    await page.waitForTimeout(750);
  }
  const errors = await page.locator('.message.error').allTextContents();
  assert(errors.length === beforeErrors, `Agent UI error: ${errors.slice(beforeErrors).join('; ')}`);
  assert(await page.locator('.generated-card').count() > beforeCards, `No ${cardKind} UI card rendered`);
  return {seconds: (Date.now() - begin) / 1000, observedAgents: [...activeAgents], cardsAdded: await page.locator('.generated-card').count() - beforeCards};
}
try {
  await page.goto(`${url}/api/health`, {waitUntil: 'domcontentloaded'});
  const health = await page.evaluate(async () => (await fetch('/api/health')).json());
  if (health.database !== 'connected') throw new Error('Lakebase health is not connected.');
  result.health = health;
  if (flags.has('--protocol')) {
    await page.addScriptTag({content: await readFile(path.join(here, 'browser_protocol.js'), 'utf8')});
    result.checks.protocol = await page.evaluate(() => window.runShopiBricksChecks({confirmSandboxWrite: true}));
  }
  if (flags.has('--agent')) {
    await page.addScriptTag({content: await readFile(path.join(here, 'browser_agent.js'), 'utf8')});
    result.checks.agent = await page.evaluate(() => window.runShopiBricksAgentCheck());
  }
  if (flags.has('--ui') || flags.has('--flow') || flags.size === 0) {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.getByRole('link', {name: 'ShopiBricks home', exact: true}).waitFor({timeout: 15000});
    await page.getByRole('button', {name: /^Add .+ to bag$/}).first().waitFor({timeout: 15000});
    const shop = {passed: true};
    shop.productCards = await page.getByRole('article').count();
    assert(shop.productCards === 12, `Expected 12 live products, found ${shop.productCards}`);
    await shot('shop');
    await page.screenshot({path: path.join(artifacts, 'shop-viewport.png')});
    await page.getByRole('button', {name: 'Sound', exact: true}).click();
    shop.soundCards = await page.getByRole('article').count();
    assert(shop.soundCards === 3, `Expected 3 sound products, found ${shop.soundCards}`);
    await page.getByRole('button', {name: 'All', exact: true}).click();
    await page.getByRole('textbox', {name: 'Search collection'}).fill('notebook');
    assert(await page.getByRole('article').count() === 1, 'Product search must narrow the catalog');
    await page.getByRole('textbox', {name: 'Search collection'}).fill('no-such-product');
    assert(await page.getByRole('article').count() === 0 && await page.getByText('No products available in this collection.', {exact: false}).isVisible(), 'Empty search needs a recovery message');
    await page.getByRole('textbox', {name: 'Search collection'}).fill('');
    shop.brandAssetsLoaded = await page.locator('img[alt="Databricks"], img[alt="OpenAI"]').evaluateAll(images => images.length >= 4 && images.every(img => img.complete && img.naturalWidth > 0));
    assert(shop.brandAssetsLoaded, 'Official brand assets must load');

    await page.getByRole('button', {name: 'Present', exact: true}).click();
    await page.getByText('LAURENT + HATIM', {exact: true}).waitFor();
    await shot('presentation');
    await page.screenshot({path: path.join(artifacts, 'presentation-viewport.png')});
    await page.getByRole('button', {name: 'Exit presentation mode', exact: true}).click();
    for (const name of ['Shop', 'Operations', 'Protocol studio']) {
      const tab = page.getByRole('button', {name, exact: true});
      await tab.click();
      if (name === 'Operations') {
        await page.getByRole('heading', {name: 'Commerce, in motion.', exact: true}).waitFor();
        await page.getByText(/Updated \d\d:/).waitFor({timeout: 15000});
        await page.getByText(/Queried \d\d:/).waitFor({timeout: 60000});
        shop.operationsSource = await page.locator('.traffic-panel .source-note').innerText();
        assert(!shop.operationsSource.includes('latest event —'), 'Missing analytical event freshness');
        await page.getByText('Inspect the governed query', {exact: true}).click();
        shop.sqlVisible = await page.locator('.query-details pre').isVisible();
      }
      if (name === 'Protocol studio') {
        await page.getByRole('heading', {name: 'Intelligence. In the open.', exact: true}).waitFor();
        await page.getByRole('button', {name: 'Discover live MCP tools', exact: true}).click();
        await page.getByRole('heading', {name: 'MCP tools/list · live response', exact: true}).waitFor();
        shop.mcpDiscovery = await page.locator('.mcp-result pre').innerText();
        assert(shop.mcpDiscovery.includes('search_products'), 'Visible MCP discovery is missing search_products');
      }
      await shot(name.replaceAll(' ', '-').toLowerCase());
    }
    await page.getByRole('button', {name: 'Shop', exact: true}).click();
    shop.desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    await page.setViewportSize({width: 390, height: 844});
    await page.reload({waitUntil: 'domcontentloaded'});
    await page.getByRole('article').first().waitFor();
    shop.mobileStartsAtTop = await page.evaluate(() => scrollY === 0);
    assert(shop.mobileStartsAtTop, 'The initial empty concierge must not scroll the mobile page');
    await shot('mobile');
    shop.mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    shop.passed = !shop.desktopOverflow && !shop.mobileOverflow && shop.sqlVisible;
    result.checks.ui = shop;
    await page.setViewportSize({width: 1440, height: 900});
  }
  if (flags.has('--flow')) {
    const flow = {passed: false};
    result.checks.flow = flow;
    const before = await page.evaluate(async () => (await (await fetch('/api/products')).json()).products.find(p => p.id === 'sb-notebook'));
    assert(before?.stock > 0, 'Notebook must be available for the rendered order test');
    flow.recommendation = await checkAgentUi('Choose a Paris weekend kit with wireless audio and a bag, maximum €250 total. Check current stock and show product cards. Do not checkout.', 'products');
    flow.productRecommendations = await page.locator('.recommendation').count();
    assert(flow.productRecommendations >= 2, 'Expected at least two visible recommendations');
    await shot('agent-recommendations');
    flow.checkoutAgent = await checkAgentUi('Prepare a draft checkout for exactly one Atelier Notebook only. Use fictional buyer Camille Martin, camille@example.test, 10 Rue de Rivoli, Paris 75001, FR. Show the checkout for my review. Do not complete or place the order.', 'checkout');
    await page.getByRole('button', {name: 'Review checkout', exact: true}).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    assert(await dialog.getByRole('heading', {name: 'Atelier Notebook', exact: true}).isVisible(), 'Agent draft is missing its notebook');
    await dialog.getByLabel('Name', {exact: true}).fill('Camille Demo');
    assert(await dialog.getByRole('heading', {name: 'Atelier Notebook', exact: true}).isVisible(), 'Editing the draft buyer lost the selected items');
    await dialog.getByLabel('Demo email', {exact: true}).fill('camille-demo@example.test');
    await dialog.getByLabel('Delivery address', {exact: true}).fill('10 Rue de Rivoli');
    await dialog.getByLabel('City', {exact: true}).fill('Paris');
    await dialog.getByLabel('Postal code', {exact: true}).fill('75001');
    await dialog.getByRole('button', {name: 'Review checkout', exact: true}).click();
    const confirm = dialog.getByRole('button', {name: 'Confirm sandbox order', exact: true});
    await confirm.waitFor({timeout: 15000});
    assert(await confirm.isDisabled(), 'Order confirmation must start disabled');
    flow.reviewedQuote = await dialog.locator('.quote').innerText();
    await shot('checkout-review');
    await dialog.getByRole('checkbox').check();
    assert(await confirm.isEnabled(), 'Explicit human confirmation did not enable completion');
    const completeResponse = page.waitForResponse(r => r.url().includes('/api/checkout/') && r.url().endsWith('/complete') && r.request().method() === 'POST');
    await confirm.click();
    const response = await completeResponse;
    const complete = await response.json();
    assert(response.ok() && complete.status === 'completed' && complete.order?.id, `Sandbox checkout did not complete: ${JSON.stringify(complete)}`);
    flow.orderId = complete.order.id;
    await dialog.getByRole('heading', {name: 'All yours. In the sandbox.', exact: true}).waitFor();
    await shot('order-confirmed');
    await dialog.getByRole('link', {name: 'View persisted order', exact: true}).click();
    await page.getByRole('heading', {name: 'Your saved order.', exact: true}).waitFor({timeout: 15000});
    await page.getByText(flow.orderId, {exact: true}).waitFor();
    assert(await page.getByRole('dialog').count() === 0, 'Persisted order must open a dedicated receipt, not the confirmation drawer');
    assert(await page.getByRole('link', {name: 'View persisted order', exact: true}).count() === 0, 'Receipt must not link back to itself');
    assert(await page.locator('.receipt-item').count() === complete.line_items.length, 'Receipt lost saved line items');
    assert((await page.locator('.receipt-delivery').innerText()).includes(complete.buyer.email), 'Receipt lost saved buyer details');
    const receiptTotal = new Intl.NumberFormat('fr-FR', {style: 'currency', currency: complete.currency, maximumFractionDigits: complete.totals.find(t => t.type === 'total').amount % 100 ? 2 : 0}).format(complete.totals.find(t => t.type === 'total').amount / 100);
    assert(await page.locator('.receipt-grand-total dd').innerText() === receiptTotal, 'Receipt must show the captured checkout total');
    await page.reload({waitUntil: 'domcontentloaded'});
    await page.getByRole('heading', {name: 'Your saved order.', exact: true}).waitFor({timeout: 15000});
    await page.getByText(flow.orderId, {exact: true}).waitFor();
    flow.persistedAfterReload = true;
    const after = await page.evaluate(async () => (await (await fetch('/api/products')).json()).products.find(p => p.id === 'sb-notebook'));
    flow.stock = {before: before.stock, after: after.stock};
    assert(after.stock === before.stock - 1, 'Rendered checkout did not decrement notebook stock exactly once');
    await shot('persisted-order');
    flow.passed = true;
  }
  if (flags.has('--review')) {
    const review = {passed: false};
    result.checks.review = review;
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.getByRole('button', {name: 'Add Atelier Notebook to bag', exact: true}).click();
    const bag = page.getByRole('button', {name: 'Review bag, 1 items', exact: true});
    await bag.click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await page.waitForFunction(() => document.activeElement?.closest('[role="dialog"]'));
    review.initialFocusInside = true;
    await dialog.getByRole('button', {name: 'Close bag', exact: true}).focus();
    await page.keyboard.press('Shift+Tab');
    review.reverseTabInside = await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')));
    await page.keyboard.press('Tab');
    review.forwardTabInside = await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')));
    const quoteResponse = page.waitForResponse(r => new URL(r.url()).pathname === '/api/checkout' && r.request().method() === 'POST');
    await dialog.getByRole('button', {name: 'Review checkout', exact: true}).click();
    const quote = await (await quoteResponse).json();
    review.checkoutId = quote.id;
    const confirm = dialog.getByRole('button', {name: 'Confirm sandbox order', exact: true});
    await confirm.waitFor({timeout: 15000});
    review.confirmationDisabled = await confirm.isDisabled();
    review.total = await dialog.locator('.authoritative-total').innerText();
    const visibleTotal = async () => {
      const box = await dialog.locator('.authoritative-total').boundingBox();
      return Boolean(box && box.y >= 0 && box.y + box.height <= page.viewportSize().height);
    };
    review.desktopTotalVisible = await visibleTotal();
    await page.screenshot({path: path.join(artifacts, 'review-desktop.png')});
    await page.setViewportSize({width: 390, height: 844});
    review.mobileTotalVisible = await visibleTotal();
    await page.screenshot({path: path.join(artifacts, 'review-mobile.png')});
    await page.keyboard.press('Escape');
    await dialog.waitFor({state: 'hidden'});
    review.focusReturnedToBag = await bag.evaluate(el => el === document.activeElement);
    review.cleanup = await page.evaluate(async id => {
      const r = await fetch(`/checkout_sessions/${id}/cancel`, {method: 'POST', headers: {'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID()}, body: '{}'});
      return {status: r.status, body: await r.json()};
    }, quote.id);
    review.passed = review.initialFocusInside && review.reverseTabInside && review.forwardTabInside && review.confirmationDisabled && review.desktopTotalVisible && review.mobileTotalVisible && review.focusReturnedToBag && review.cleanup.status === 200;
  }
  result.pageErrors = pageErrors;
  result.consoleErrors = consoleErrors;
  result.passed = Object.values(result.checks).every(c => c.passed) && pageErrors.length === 0;
} catch (error) {
  result.passed = false;
  result.error = String(error);
  result.pageErrors = pageErrors;
  result.consoleErrors = consoleErrors;
  await shot('failure').catch(() => {});
} finally {
  result.completedAt = new Date().toISOString();
  await writeFile(path.join(artifacts, 'results.json'), JSON.stringify(result, null, 2));
  await browser.close();
}
console.log(JSON.stringify({passed: result.passed, artifacts, checks: result.checks, error: result.error}, null, 2));
process.exitCode = result.passed ? 0 : 1;
