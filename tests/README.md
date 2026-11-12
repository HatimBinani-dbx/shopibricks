# ShopiBricks verification

The current validation record is [docs/VALIDATION.md](../docs/VALIDATION.md). Fixture-based UI tests and real integration tests are separate.

## Workspace, persona and checkout UI

Run the application tests first to generate the fictional atlas fixture:

```sh
npm --prefix app test
npm --prefix app run build
```

With the app running locally and Google Chrome installed:

```sh
cd tests
npm ci
SHOPIBRICKS_TEST_URL=http://localhost:8000 npm run verify
SHOPIBRICKS_TEST_URL=http://localhost:8000 npm run verify:funnel
SHOPIBRICKS_TEST_URL=http://localhost:8000 npm run verify:tour
```

`verify`, `verify:atlas` and `verify:personas` run the current workspace suite with explicit API fixtures. They check clusters, query inspection and handoff, catalog/brand/channel views, data-source labeling, error recovery, downloads, profile/thread/cart isolation, and 1440/1024/768/390/320px layouts. They make no real model calls or database writes.

`verify:funnel` checks empty bags, sold-out products, quantity limits, saved draft details, edits, validation, changed prices, expired quotes and stock conflicts using fixtures.

`verify:tour` checks all 16 main tour steps on desktop and mobile, plus checkout/receipt guides, previous/next/exit behavior, focus restoration and unchanged checkout consent.

Artifacts go into ignored `tests/artifacts/` subdirectories. Tests use isolated headless Chrome; they do not attach to a presenter's browser or reuse its cookies.

## Real integrations

`npm run verify:personas:live` targets a local app configured for the selected workspace. It makes two real profile-aware model requests, checks current catalog facts and persisted intent milestones, and does not place orders. Set `SHOPIBRICKS_TEST_URL` to the local app's origin.

For the configured hosted FEVM demo, run from the repository root:

```sh
app/.venv/bin/python -P scripts/verify_personas_hosted.py
```

This uses native SDK OAuth with the explicit `fevm` profile. It checks production asset hashes, live catalog/readiness/feed APIs, clustering/filter behavior, one real recommendation and its appearance in account-scoped live activity. It creates no order. Adapt the profile and application URL in the script for another deployment.

The supplementary `verify:receipt` script uses saved-order fixtures. `verify:legacy` retains the earlier storefront test runner for historical workflows; its UI selectors predate the workspace redesign. Its `--agent` and `--protocol` modes make real integration calls. The protocol and full-flow modes can create sandbox orders and decrement demo inventory.

The standalone `browser_agent.js` and `browser_protocol.js` helpers can run in an authenticated same-origin hosted browser. The latter requires `{confirmSandboxWrite: true}` before creating its sandbox order.

## Transaction races

From `app/`:

```sh
node --import tsx ../tests/checkout_regressions.ts
```

This uses native Lakebase authentication, clones a temporary SKU, checks stale-price rejection and two buyers racing for one unit, then removes its temporary operational rows. CDC audit history remains. It does not change shared product stock or prices.
