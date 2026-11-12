# ShopiBricks — on-stage cues

**Laurent 00:00–25:00 · Hatim 25:00–50:00**

[Open the shop](https://shopibricks-paris-7474645565734606.aws.databricksapps.com) · [Dashboard](https://fevm-serverless-stable-vwywqi.cloud.databricks.com/dashboardsv3/01f1da3c06ef14dda98059288ee88ad5/published) · [Full runbook](RUNBOOK.md)

Before the audience arrives: sign in, start the bounded stream, verify a new completed pipeline update, run one concierge prompt, check headphone stock, prepare the labelled rehearsal screenshots. Click **Present** for the Laurent + Hatim navigation dock.

Build checkpoint: final deployment `01f1da4b5185131aaedb46647f556b20` passed agent **11/11** and checkout **27/27** checks; its available recommendation totaled **€168**. The hosted MLflow body was inspected and correlated to that run. Earlier dated rehearsals separately proved the **€237** UI total, **€158** stockout kit, exact-order CDC and genuine Genie call. All demo verification gates are complete; ChatGPT connection remains deferred.

| Clock | Laurent's cue | Evidence to leave on screen |
|---|---|---|
| 00:00 | One Paris weekend kit, €250 budget | Storefront, prices, synthetic/sandbox disclosure |
| 05:00 | New data is arriving | Two different source-batch timestamps |
| 09:00 | Trustworthy data needs quality rules | Completed Lakeflow update, accepted and quarantined rows |
| 13:00 | Governance follows the data | Unity Catalog sources and actual execution identity |
| 16:00 | Find the merchant's constraint | Current stock; actual `ask_genie`, generated SQL and dated exposure figures |
| 20:00 | **Operations → Simulate stockout** | Forma Headphones now has zero stock; disclose the presenter action |
| 25:00 | Hand over to Hatim | “The original choice is constrained. Show us how the agents adapt.” |

| Clock | Hatim's cue | Evidence to leave on screen |
|---|---|---|
| 25:00 | Submit the shopper prompt | Live run status and specialist activity |
| 28:00 | Follow the decisions | Generated product cards, actual prices and available stock |
| 32:00 | Recheck the constraint | An available alternative, with total under €250 |
| 35:00 | Review, then pause | Authoritative quote, fictional address, unchecked confirmation |
| 39:00 | Confirm and inspect | Persisted sandbox order ID; no payment or shipment |
| 43:00 | Follow the same evidence | Protocol events, Operations, exact-order CDC and the verified hosted MLflow model span |
| 46:00 | Explain the ChatGPT boundary | Live MCP discovery and ACP sandbox; account connection deferred |
| 48:00 | Return to the completed journey | Leave two minutes for questions |

**Shopper prompt**

> Choose a Paris weekend kit with wireless audio and a bag, maximum €250 total. Check current stock and show product cards. Do not checkout.

**Stock follow-up**

> Check the stock again. If the headphones are unavailable, suggest the best available alternative and keep the whole kit under €250.

**Checkout handoff**

> Prepare a draft checkout for the products we selected. Show me the total for review. Do not complete the order without my confirmation.

**Merchant question**

> Use Genie to find the product with the highest total stockout exposure across all cities and channels. Show the generated SQL, latest event timestamp and definition. Does this represent actual lost revenue?

The verified rehearsal returned Forma Headphones, €184,212, through 00:28:41 UTC. Read the current result during the talk; this is all-city synthetic exposure, not a Paris-only value or actual lost revenue.

**Trace bookmark:** [verified hosted MLflow span](https://fevm-serverless-stable-vwywqi.cloud.databricks.com/ml/experiments/588811517474050/traces/a24563724d88895df4dc1fc2ba6c36f9), experiment `588811517474050`. Show the shopping prompt, `system.ai.gpt-6-luna`, and `delegate_catalog` response. Its response ID matches final agent run `c7f44cbb-8be3-440c-9326-fdb8c9a3faf4`; describe it as the recorded rehearsal trace when showing it alongside a new live order.

Use fictional buyer Camille Martin, `camille@example.test`, 10 Rue de Rivoli, Paris 75001, France. Read the displayed products and amount before checking the confirmation box.

**If a dependency fails:** show the real error or last successful timestamp; retry once. Keep the working merchant path or use a dated rehearsal recording. Do not label old analytics as live or an unconfirmed checkout as successful.

**Afterwards:** stop the bounded stream, confirm no active emitter remains, and allow any already-triggered Lakeflow update to finish. Leave resources and evidence available for review.
