# Interactive Developer studio

Protocols contains a clickable architecture of the whole app, three animated journeys, and live MCP discovery. Optional reference integrations are identified.

Unity Gateway adds animation, governed-access and bounded rate-limit probes, cost planning and real inference payload inspection. Probes display actual HTTP results; a configured limit does not guarantee a particular caller sees HTTP 429. Cost planning does not enforce a budget.

Model lab removes the historical failure heatmap and public benchmark panels. Presenter settings control other providers and anonymization (Model A, Model B, etc.). Live runs retain baseline and protected results, actual tool calls, latency, tokens and agent cost.

## Injection demo

Select the injected-catalog scenario, run without protection, enable the catalog guard and rerun. GPT evaluates the untrusted description through Unity Gateway. The application withholds the entire flagged description while preserving structured attributes. Evaluator errors stop the model run before the description is exposed.

This is **application enforcement**, not an attached native Gateway policy. Native service-policy attachment requires the workspace UI: Jailbreak output policy on a governed MCP service. Native policies block unsafe results; agents still need recovery logic. The lab explains this distinction. Protected latency includes evaluation; agent cost excludes guard usage, shown separately in verdict evidence.

A local authenticated rehearsal on 18 November 2026 returned no final basket for gpt-oss before protection, while Luna and Terra passed; all three passed with protection. A missing final answer is a task failure, not proof of obeying the injected instruction. Outcomes vary; never promise a specific model must fail.

## Configuration

Use ignored showcase configuration as described in UNITY_GATEWAY_ACT.md. Optional variables:

- `SHOPIBRICKS_LAB_SERVICE_PREFIX=<catalog>.<schema>.lab_`: suffixes are exact lab model IDs. Provision matching model destinations and inference logging. Payload table prefixes use underscores, for example `lab_gpt_6_luna_payload`.
- `SHOPIBRICKS_RATE_DEMO_SERVICE=<catalog>.<schema>.rate_demo`: isolated one-request/minute service, no retries in the probe.

The app principal needs EXECUTE on services, USE_CATALOG/USE_SCHEMA and SELECT on payload tables. Keep deployment identifiers in ignored files. For local development explicitly set `DATABRICKS_CONFIG_PROFILE`; inherited shell values take precedence over `.env`.

## Codex

SQL and frontend both filter to actual Codex sessions with GPT destinations. Select a session to inspect attribution; copy the connection command to start Codex. The separate live GPT workbench reviews allowlisted app source using the app identity; it does not launch Codex or execute generated code.

## Validation

Run `npm --prefix app test`, `npm --prefix app run build`, and `app/.venv/bin/python -m unittest discover -s app/tests -p '*_test.py'`. Verify deployed probes and inference reads with the app identity too.
