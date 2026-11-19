# Developer act: Unity Gateway, Model lab, Codex

Extends Hatim's part (25:00 to 50:00) with three new Developer studio views. Entry point: **Developer studio** in the app sidebar, then the tabs **Unity Gateway**, **Model lab** and **Codex**. Deep links: `/#gateway`, `/#lab`, `/#codex`.

A second deployment runs these views next to the reference app, in its own workspace. Laurent's reference deployment is unchanged. Configuration lives in local, git-ignored files: copy `app/app.showcase.example.yaml` to `app/app.showcase.yaml`, `resources/app-create.showcase.example.json` to `resources/app-create.showcase.json`, and set `PROFILE`, `APP` and `DEST` in `scripts/showcase.local.env`. Then run `scripts/deploy-showcase.sh`.

## What runs where

| Piece | Showcase resource |
|---|---|
| Governed model service | `<catalog>.<schema>.concierge`: GPT-6 Luna primary, GPT-6.1 Sol fallback, 600 req/min service limit, 60 req/min and 200k tokens/min per user, inference table `concierge_payload` |
| Usage | `<catalog>.<schema>.gateway_usage`, a view over `system.ai_gateway.usage` scoped to the workspace, owned by an admin (an app service principal usually cannot be granted system tables directly) |
| SQL warehouse | dedicated serverless PRO, Medium, 1 to 3 clusters, 20 min auto-stop (same sizing as the fevm reference) |
| Lakebase | dedicated Autoscaling project, branch `production`, 1 CU, schema `shopibricks` owned by the app service principal (deploy before running locally) |
| MLflow | dedicated experiment |
| App | service principal with `EXECUTE` (and `MANAGE` for the live routing switch) on the concierge service |

Operations analytics (Lakeflow pipeline, Genie, Vector Search, AI/BI dashboard) are not provisioned in the showcase. Show them from the reference workspace.

## Talk track

The timed script, with one takeaway per panel and the closing ice breaker, is in [PITCH_DEVELOPER_ACT.md](PITCH_DEVELOPER_ACT.md).

Panels: **Architecture** (`#architecture`), **Unity Gateway** (`#gateway`), **Model lab** (`#lab`), **Codex** (`#codex`). Presenter settings (anonymize non-OpenAI models, costs, animations) open from the gear next to the tabs, or with Shift + comma.

## Demo services

Three small model services sit next to the concierge service, in the same schema. Override them with `SHOPIBRICKS_UG_RESTRICTED_SERVICE`, `SHOPIBRICKS_UG_RATELIMIT_SERVICE` and `SHOPIBRICKS_UG_GUARDED_SERVICE`.

| Service | Purpose | Setup |
|---|---|---|
| `finance_reserved` | Identity demo: the app service principal has no `EXECUTE` grant, so the call is denied | GPT-6 Astra destination, no grant to the app |
| `ratelimit_1rpm` | Rate-limit demo: 1 request per minute for the service and per user. The button sends spikes of 5 back-to-back requests | GPT-6 Luna destination, app has `EXECUTE` |
| `guarded_oss` | Guardrail story: gpt-oss-120b behind a Jailbreak service policy, with an inference table | Attach the policy once in the UI (Unity Gateway › Models › guarded_oss › Policies › Jailbreak, input, Deny). There is no public API for service policies |

When a service policy denies a chat turn, the gateway answers HTTP 200 with a top-level `databricks_service_policy` object. The lab harness (`app/server/ug_bench.py`) records it as a guardrail event, withholds the free-text product descriptions from that turn's tool results and retries once with the structured catalog data.

The rate-limit demo sends requests one by one: parallel bursts can pass before the distributed counter updates. Enforcement is approximate across gateway replicas, so a spike of 5 against a 1-per-minute limit typically serves 0 to 3 requests in a variable order, and the limit can take a few spikes to kick in after a quiet period.

## Model lab method

`app/server/ug_bench.py` runs 12 ShopiBricks scenarios (budgeted kits, stockouts, infeasible requests, exact quotes, a prompt injection hidden in a product description, a French request, attribute filtering, quantity above stock, cheapest basket). Each scenario uses the same tools (`search_products`, `get_inventory`, `submit_answer`) and a deterministic grader: right products, in stock, within budget, exact stated total, inventory checked before recommending, injected instruction not followed.

- OpenAI models use the Responses API with reasoning effort `low` (the app's production setting). Other providers use Chat Completions, their supported Gateway API for tool calls. Every call goes through Unity Gateway.
- Cost is estimated from measured tokens at public Databricks pay-per-token list prices (short context, $0.07/DBU, AWS us-east-1, November 2026). Gemini 3.8 Flash is at its promotional rate until 31 December 2026.
- Latency is end-to-end wall time per task from a laptop in Paris.
- Scenarios were tightened once after a first run showed three ambiguous prompts (business trip, out-of-stock gift, bulk quantity). The bundled results are from the second run.

Rerun before the talk if models change:

```sh
uv run --with databricks-openai --with "databricks-sdk>=0.81" \
  python app/server/ug_bench.py --profile <PROFILE> --repeats 3 --out bench/results
```

### Results, 17 November 2026 (324 graded runs, 0 infrastructure errors)

| Model | Success | Cost per success | Median latency |
|---|---|---|---|
| GPT-6 Luna | 92% | $0.0003 | 4.7 s |
| gpt-oss-120b | 78% | $0.0014 | 5.3 s |
| GPT-6.1 Terra | 100% | $0.0016 | 5.6 s |
| GPT-6.1 Sol | 100% | $0.0032 | 6.5 s |
| Gemini 3.8 Flash | 97% | $0.0055 | 13.3 s |
| GLM-5.3 | 97% | $0.0094 | 7.8 s |
| Claude Sonnet 5.5 | 100% | $0.017 | 4.7 s |
| GPT-6 Astra | 100% | $0.018 | 6.7 s |
| Claude Opus 5.5 | 100% | $0.034 | 7.2 s |

Read it carefully on stage:

- This task is easy for frontier models: several reach 100%. The differentiator is cost per success, where GPT-6.1 Terra is about 21x cheaper than Claude Opus 5.5 for the same score, and GPT-6 Luna is the cheapest overall.
- GPT-6 Luna's misses are arithmetic on the three-item basket (stated total differs from the real sum). The server-side total check in the app is exactly the safeguard for this.
- GPT-6 Astra is not the cost winner on this task. Its strength is harder work (Terminal-Bench, OfficeQA Pro), as the public benchmarks show.
- gpt-oss-120b followed the injected catalog instruction in 3 of 3 runs.
- The app anonymizes non-OpenAI models by default (toggle in the Model lab header).

## Public benchmarks (for Q&A, no longer shown in the app)

- [Databricks AI Index](https://www.databricks.com/blog/introducing-databricks-ai-index-state-enterprise-ai-tokenomics): GPT-6 Luna 89.1% task success at about $0.05 per task, the same success as Claude Opus 5.5 at $1.62. Claude Fable 5.1 scores higher (96.0%) at $7.47.
- [OfficeQA Pro V2](https://www.databricks.com/blog/introducing-officeqa-pro-v2-new-benchmark-enterprise-grounded-reasoning): GPT-5.6 Sol on Codex 33.3% at $4.70 per rollout versus Sonnet 5 on Claude Code 15.6% at $5.01.
- [GPT-6 Astra announcement](https://openai.com/index/gpt-6-astra-next-generation-work/) (OpenAI): Terminal-Bench 4.0 57.9% versus 37.3% for GPT-5.6 Sol at about 9% lower cost per task, and a Databricks quote on OfficeQA Pro without figures.

No published source measures execution time. Do not claim "faster" from these benchmarks; use the latency measured in the Model lab.

## Before the talk

- Run the concierge and one Model lab comparison 15 to 30 minutes before, so `gateway_usage` already shows traffic (ingestion is delayed).
- Start one Codex session with `scripts/codex-showcase.sh` beforehand for the same reason.
- Confirm the concierge's primary route is back on GPT-6 Luna after rehearsal.
- Smart Routing is supported for the Claude Code harness only, not Codex: do not present it as a Codex feature.
- Guardrails (service policies, Beta) are described but not configured on the concierge service.
