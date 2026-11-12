> November 2026 redesign: the merchant landing page is now the interactive Intent atlas, with separate Catalog lab, Brand studio and Channels views. See [INTENT_ATLAS.md](INTENT_ATLAS.md) for the current UI, data sources and verification.

# Personas and agent commerce growth

Reference: [Lemrock’s public website](https://www.lemrock.com/), reviewed 11 November 2026. This comparison covers its public product themes, not a verified evaluation of Lemrock’s private implementation or performance claims.

## What changed

| Public Lemrock theme | ShopiBricks implementation | Boundary |
|---|---|---|
| Personalization by profile, context and history | Four fictional shopper profiles, interest-based catalog ranking, profile-specific hero art and prompts, server-enforced default budgets, contextual agent instructions | Seeded history is explicitly fictional. Conversation history is real within each demo context. |
| Specialized conversational interfaces | Native storefront, Travel planner and Gift advisor contexts | These run within ShopiBricks; they are not third-party channel integrations. |
| Structured catalogs for AI discovery | Six completeness checks on live Lakebase rows and a downloadable catalog feed with intent tags, current price, availability and product links | Internal `shopibricks.catalog.v1` preview; platform schemas, public product photography and external acceptance still require work. |
| Brand voice and consistent storytelling | Editorial, Concise and Playful settings applied to the concierge and all specialists; product-fact template preview | Session setting, not a global merchant policy or a production content publishing system. |
| Signals from shopper intent | Real recorded requests, recommendation cards, draft checkouts and selection gaps, filterable by shopper profile and experience | Last 24 hours for the caller, bounded at 5,000 relevant events with an explicit partial-result notice. Intent labels are rule-based. |
| Distribution across major AI platforms | Channel readiness cards for ShopiBricks, ChatGPT, Perplexity, Gemini, Mistral AI and DeepSeek | External channels are not connected. The native storefront, MCP and sandbox ACP implementation are real. |
| Transactions and conversion | Existing authoritative quotes, consent-based sandbox orders, saved receipts and operational order metrics | No real payments, externally attributed sales, ROAS claims or mass-distribution metrics. Milestone counts are not conversion rates. |

## Presentation flow

1. Choose **Shopper**. Start with Camille, then compare Alex, Léa and Noor. Their catalog order, interests, product art, prompt and default budget change.
2. Ask for a recommendation without repeating the budget: the server applies the active profile’s default. A newer explicit EUR budget overrides it; “No budget” removes it.
3. Add a product to Camille’s bag and switch to Alex. The new bag and conversation are separate. Switch back to restore Camille’s state.
4. Select **Travel planner** or **Gift advisor** to change specialist context. Each context gets its own thread; changing the brand voice also selects a separate conversation.
5. Choose **Merchant** to open **Growth studio**. Inspect live catalog checks and export the internal JSON preview. Select a brand voice, inspect the template preview, then try it with the concierge.
6. Open channel cards to show the distinction between the working native experience and external integration prerequisites.
7. Refresh demand intelligence after a shopper run. Filter by shopper and experience. These counts come from recorded events; an unused profile shows an empty state.
8. Use **Operations** for the existing order, inventory and streaming data story, then **Developer** for actual tool calls and protocol events. The guided tour covers all four screens.

## Context and state contracts

- `shared/experience.ts` contains the fictional profiles, roles, specialist experiences, brand voices and deterministic ranking/preview helpers.
- `POST /api/agent/run` optionally accepts `experience: {persona, profile, channel, voice}`. All fields are validated against fixed enums. Existing clients without this field remain supported.
- Caller identity still comes from Databricks authentication or the local session cookie. Selecting a demo persona does not grant permissions or impersonate another account.
- Agent thread storage is scoped by caller, persona, profile, channel and voice. An existing thread from a different scope cannot be read as the new context.
- The browser keeps carts and checkout drafts separately per shopper profile. Conversation snapshots are per complete experience context. These snapshots last for the current page lifetime; voice preference is retained in session storage.
- `shopibricks.context` records profile, channel, voice, intent and effective budget. `shopibricks.gap` records rejected selections or unavailable products. Existing `shopibricks.ui`, `RUN_FINISHED` and `RUN_ERROR` events supply milestone outcomes.
- `GET /api/insights?profile=lea&channel=gifting` reads owner-scoped events for the last 24 hours. Multiple recommendation renders and retries in one run count once. Business/technical persona runs are excluded.
- A gap can be followed by a successful retry. A failed or stopped run is counted separately. Drafts and recommendations are independent milestones; neither implies a purchase.
- `GET /api/catalog/readiness` evaluates current product completeness. Out-of-stock products can be complete but unavailable.
- `GET /api/catalog/feed` exports current facts from Lakebase; it never publishes externally. `?product=<id>` opens the storefront filtered to that product.

No schema migration, new Databricks resource, continuous schedule, payment processor or external AI channel is introduced.

## Verification

- `npm test` in `app/`: 22 checks covering existing pricing safeguards plus context validation, conversation scoping, profile budgets, ranking, catalog/feed integrity and deduplicated intent aggregation.
- `databricks apps validate --profile fevm`: passed, including build and tests.
- `npm run verify:personas` in `tests/`: deterministic browser fixtures exercise switching, isolated carts and conversations, context payloads, brand voice, export, filtered empty/error states and widths from 320 to 1440 pixels. Fixtures are explicitly labeled in saved evidence.
- `npm run verify:personas:live`: actual Lakebase and OpenAI checks via the local app, including a €58 Léa gift selection under €100 and a €128 Alex workday selection under €200. Both used inventory tools and produced persisted intent milestones. No orders were placed.
- Existing checkout recovery and expanded guided-tour suites cover consent, drafts, recovery, keyboard navigation and mobile layout.
- Hosted FEVM verification passed 12 checks after deployment `01f1ddddefb7149797a47af2ea29206c`. Both deployed asset hashes match the validated local build. Noor’s real hosted recommendation contained a Memo Pocket Camera and Atelier Notebook for €198 under her €300 default budget, used live inventory checks, and appeared in the profile/channel-filtered intent metrics.

The deployed application is [ShopiBricks Paris](https://shopibricks-paris-7474645565734606.aws.databricksapps.com), verified running on 11 November 2026. To repeat hosted checks with native OAuth, run `app/.venv/bin/python -P scripts/verify_personas_hosted.py` from the project root; `-P` avoids the existing `scripts/platform.py` shadowing Python’s standard library.

Evidence is saved under `tests/artifacts/personas/`. The comparison separates working demo capabilities from external integration requirements; it does not claim Lemrock’s reported scale or commercial results.
