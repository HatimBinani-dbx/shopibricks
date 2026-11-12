# ShopiBricks — OpenAI Office Paris

50-minute headless commerce demonstration, Laurent and Hatim, two 25-minute acts.

## Story

An AI concierge helps a shopper build a Paris weekend kit below €250. A presenter-triggered stockout changes live inventory while a separate bounded stream supplies synthetic campaign analytics. Specialist agents consult current products, stock and commerce analytics, present a revised selection as interactive UI, and request human confirmation before a sandbox checkout. Native Lakebase change data capture brings that same order into Unity Catalog for merchant analysis.

## Implementation direction

- Workspace: FEVM serverless stable, explicit CLI profile `fevm`.
- Workspace URL: https://fevm-serverless-stable-vwywqi.cloud.databricks.com
- Unity Catalog: `serverless_stable_vwywqi_catalog.shopibricks_laurent`.
- Dedicated Lakebase Autoscaling project `shopibricks-paris`; operational schema `shopibricks`.
- Databricks App: React/TypeScript, Express, structured Generative UI, AG-UI events, official MCP SDK.
- OpenAI Responses through Unity Gateway, using workspace-supported OpenAI models and native OAuth libraries.
- Unity Catalog products/customers, streaming synthetic commerce events, Lakeflow medallion transformations and quality expectations.
- Genie for merchant analytics; AI/BI dashboard; Vector Search product retrieval; MLflow traces where supported.
- ACP merchant API with authoritative pricing, idempotency and sandbox payments. ChatGPT merchant activation is an external onboarding dependency, never implied by a local implementation.

## Visual direction

Premium Paris editorial retail: warm ivory, dark ink, restrained vermilion accents, original product illustrations, legible projector-scale typography. Storefront stays customer-oriented. Operations and Protocol Studio expose lineage, identity, freshness, actual events and deployment health.

## Demonstration integrity

Synthetic data is labelled. Business counters come from persisted data. Errors and unavailable integrations are visible. Agent output does not fabricate tool results. Checkout requires a human action; payments do not charge a real card. MCP and AG-UI are distinct protocols. ACP is a REST merchant interface, not an MCP checkout certification.

## Runtime bounds

Streaming sessions are time-bounded. Start controls and a rehearsal runbook describe costs and warmup. No perpetual schedules are enabled by default. All deployed resources are dedicated to this demo except the existing shared warehouse and model endpoints.
