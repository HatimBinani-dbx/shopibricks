# Intent atlas and workspace redesign

The merchant landing page now centers on interactive demand discovery. React 19 remains the UI framework; D3 force layout arranges shopper questions into navigable groups. The existing Express, Lakebase, agent, MCP and checkout integrations remain in place.

## What changed

- Persistent workspace navigation and Shopper / Merchant / Developer perspectives.
- Merchant views: Intent atlas, Catalog lab, Brand studio, Channels.
- A full-width cluster map with point and cluster selection, keyboard activation, drag, zoom, reset and expansion.
- Inspector with the original question, profile, experience, budget, relevant live products, matched terms, and an explanation of coverage, budget or stock gaps.
- Search, opportunity filtering, profile and experience filters, cluster granularity, pagination and JSON export.
- “Try in the storefront” restores the appropriate profile and experience and prefills the composer. It does not submit a message automatically.
- Product dossiers with catalog checks and discovery actions; three voice previews with real product facts; explicit integration prerequisites for each external channel.
- A toggleable copilot that preserves the working area, responsive navigation, and an updated 16-step guided tour.

## Sources and limits

Public reference: https://www.lemrock.com/ (reviewed November 11, 2026). The visible site groups language such as “trail, track, hiking,” “shoes, footwear, sneakers,” and “running, jogging, activity,” and emphasizes intent matching, personalization, brand voice and distribution. Research captures are in `tests/artifacts/lemrock-research/`. This demo does not claim access to Lemrock's private product, its algorithms, or performance parity.

**Example queries:** a read-only corpus of 72 explicitly fictional questions. They are not written as activity, orders or traffic. Prices and stock used for their matches come from the current catalog.

**My live activity:** actual shopper questions from the current signed-in account (or local demo session), captured in `shopibricks.context` events. The existing SQL reader scopes records by caller and by the last 24 hours. Older events without query text are excluded. At most 180 captured questions within 5,000 relevant events are shown, with a partial-result notice when bounded. This introduces prompt text into the same owner-scoped event log; it is visible in that account’s protocol timeline and atlas.

**Clustering:** deterministic spherical k-means on TF-IDF vectors, a small curated synonym dictionary, and farthest-first initialization. Cluster labels come from centroid terms. Requested detail is 3–8 clusters; sparse or repetitive data can produce fewer populated groups. D3 positions illustrate membership, not semantic distances or an embedding projection.

**Product matching:** cosine lexical relevance of at least 0.12, followed by availability and individual-product budget checks. A small explicit absent-category rule handles clearly unsupported demands. Scores are not probabilities, and lexical matching can miss paraphrases or surface tangential products. The concierge verifies the complete selection and bundle budget. Match counts are estimated catalog coverage, not observed recommendations, sales, conversion, revenue or lost revenue. Recorded agent outcomes appear separately for real activity.

**Distribution:** the native ShopiBricks storefront is available. ChatGPT, Perplexity, Gemini, Mistral AI and DeepSeek remain unconnected. Exporting a JSON preview does not publish a feed or complete merchant onboarding.

## Verification

- `npm --prefix app test`: 27 TypeScript tests, including deterministic assignments, empty/duplicate queries, budget/stock/assortment gaps, and observed-event attribution.
- `databricks apps validate --profile fevm`: build, typechecking, lint and test validation.
- `tests/verify-atlas.mjs`: 61 browser checks, including persona/thread/cart isolation, query handoff, filters, error recovery, exports, and layouts at 1440, 1024, 768, 390 and 320 pixels. Fixtures are explicitly isolated from real activity.
- `tests/verify-funnel.mjs`: seven checkout recovery scenarios; no real payment.
- `tests/verify-tour.mjs`: desktop/mobile tour, focus restoration, checkout and receipt guides, and unchanged approval requirements.
- `scripts/verify_personas_hosted.py`: native SDK OAuth using `fevm`; production asset hashes, live catalog APIs, clustering filters, an actual model recommendation and its appearance in the live atlas.

Verification scripts write screenshots and machine-readable results to the ignored `tests/artifacts/atlas/` directory. The hosted report is `hosted-results.json`. Selected fixture screenshots are published in `docs/images/`; raw hosted traces and account-scoped activity remain local.
