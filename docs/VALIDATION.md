# Validation

The intent-atlas redesign was verified on November 11, 2026.

| Check | Result |
|---|---|
| TypeScript unit tests | 27 passed |
| Atlas/persona browser checks | 61 passed |
| Checkout recovery scenarios | 7 passed |
| Guided tour | 16 steps passed on desktop and 320px mobile; checkout and receipt guides also passed |
| Databricks Apps validation | Passed |
| Hosted checks | 21 passed |

Browser checks cover 1440, 1024, 768, 390 and 320px layouts, keyboard selection, map controls, filters, exports, error recovery, query handoff, and profile/thread/cart isolation. Their API fixtures are explicitly synthetic. Selected screenshots are in [images](images/).

The hosted verification checked byte-for-byte production asset hashes, live catalog facts, clustering assignments and server filters. A real Noor / Travel planner / Playful agent run recommended the Memo Pocket Camera and Atelier Notebook for €198, within the €300 profile budget. The exact question and its actual recommendation outcome then appeared in the same account's live atlas. No order was created by that verification.

These are dated verification results, not live metrics. Test commands are in the root README and [tests/README.md](../tests/README.md). Generated results, raw hosted events and deployment reports remain local under ignored paths. The scripts regenerate the evidence for an authorized deployment.
