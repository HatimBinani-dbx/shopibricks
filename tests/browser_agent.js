/* Run within an authenticated ShopiBricks browser tab. No checkout is performed. */
window.runShopiBricksAgentCheck = async function () {
  const startedAt = new Date().toISOString();
  const events = [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 115000);
  try {
    const response = await fetch('/api/agent/run', {
      method: 'POST', credentials: 'same-origin',
      headers: {'Content-Type': 'application/json', 'Accept': 'text/event-stream'},
      body: JSON.stringify({message: 'Choose a Paris weekend kit with wireless audio and a bag, maximum €250 total. Check current stock and show product cards. Do not checkout.'}),
      signal: controller.signal,
    });
    if (!response.ok || !response.body) throw new Error(`Agent HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    function parseFrame(frame) {
      const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
      if (data && data !== '[DONE]') {
        try { events.push(JSON.parse(data)); } catch { throw new Error('Malformed JSON in agent SSE event'); }
      }
    }
    while (true) {
      const {done, value} = await reader.read();
      pending += decoder.decode(value, {stream: !done}).replace(/\r\n/g, '\n');
      let boundary;
      while ((boundary = pending.indexOf('\n\n')) >= 0) {
        parseFrame(pending.slice(0, boundary)); pending = pending.slice(boundary + 2);
      }
      if (done) { if (pending.trim()) parseFrame(pending); break; }
    }
    const products = events.filter(e => e.type === 'CUSTOM' && e.name === 'shopibricks.ui' && e.value?.kind === 'products');
    const lastProducts = products.at(-1)?.value?.products || [];
    const total = lastProducts.reduce((sum, p) => sum + p.price_cents, 0);
    const checks = [
      {name: 'AG-UI run started', passed: events.some(e => e.type === 'RUN_STARTED')},
      {name: 'Run completed without an error', passed: events.some(e => e.type === 'RUN_FINISHED') && !events.some(e => e.type === 'RUN_ERROR')},
      {name: 'Real catalog tool called', passed: events.some(e => e.name === 'shopibricks.mcp' && e.value?.tool === 'search_products')},
      {name: 'Real inventory tool called', passed: events.some(e => e.name === 'shopibricks.mcp' && e.value?.tool === 'get_inventory')},
      {name: 'At least two specialists participated', passed: new Set(events.filter(e => e.type === 'STEP_STARTED' && e.agent !== 'Concierge').map(e => e.agent)).size >= 2},
      {name: 'Structured product cards returned', passed: lastProducts.length >= 2},
      {name: 'Recommended bundle respects €250 budget', passed: total > 0 && total <= 25000},
      {name: 'Recommended bundle contains a bag', passed: lastProducts.some(p => p.category === 'Carry')},
      {name: 'Recommended bundle contains wireless audio', passed: lastProducts.some(p => p.category === 'Sound')},
      {name: 'All recommended products available', passed: lastProducts.length > 0 && lastProducts.every(p => p.stock > 0)},
      {name: 'No checkout prepared without request', passed: !events.some(e => e.type === 'CUSTOM' && e.name === 'shopibricks.ui' && e.value?.kind === 'checkout')},
    ];
    return {
      passed: checks.every(c => c.passed), origin: location.origin, startedAt, completedAt: new Date().toISOString(),
      checks, eventCount: events.length,
      runId: events.find(e => e.type === 'RUN_STARTED')?.runId,
      modelEvidence: events.filter(e => e.name === 'shopibricks.model').map(e => ({agent: e.agent, ...e.value})),
      products: lastProducts.map(p => ({id: p.id, price_cents: p.price_cents, stock: p.stock})), total_cents: total,
      errors: events.filter(e => e.type === 'RUN_ERROR'),
    };
  } catch (error) {
    return {passed: false, startedAt, completedAt: new Date().toISOString(), error: String(error), eventCount: events.length, errors: events.filter(e => e.type === 'RUN_ERROR')};
  } finally { clearTimeout(timeout); }
};
