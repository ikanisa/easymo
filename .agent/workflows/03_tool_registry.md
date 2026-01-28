---
description: "Define the Tool Registry and the strict internal contract between your WhatsApp backend and Moltbot (Option A). Implements: tool interface, schemas, safety gates, and the single orchestrator loop."
---

# Workflow 03 — Tool Registry + Moltbot Internal API Contract

## Goal
Make Moltbot a pure "brain service" that can only cause side-effects by calling your backend tools.
No direct WhatsApp sending from Moltbot. No direct DB writes from Moltbot. Everything is mediated.

**Core invariant:** Moltbot returns intent + structured arguments; your backend executes tools and logs everything.

## Outputs
1) A versioned Tool Registry spec (JSON Schema or TypeScript types)
2) Backend tool endpoints (HTTP) with auth + idempotency
3) Moltbot "output contract" validator (rejects non-conforming output)
4) Orchestrator loop implementation (single function)
5) Audit logs for every tool call (request_id)

## Step 1 — Create the Tool Registry spec
Create: `docs/tools/tool-registry.v1.md`

### Tool naming convention
`marketplace.<verb>_<object>` (stable, explicit, no ambiguity)

### Required tools (v1):
1. `marketplace.search_vendors` — find candidate vendors
2. `marketplace.get_request_snapshot` — get canonical request state
3. `marketplace.send_client_message` — send message to client
4. `marketplace.send_vendor_message` — send message to vendor
5. `marketplace.record_vendor_reply` — persist + parse vendor reply
6. `marketplace.create_ocr_job` — queue OCR processing
7. `marketplace.get_ocr_result` — fetch OCR status/result
8. `marketplace.request_call_consent` — ask for call permission
9. `marketplace.start_call` — initiate WhatsApp call
10. `marketplace.update_request_state` — transition request state

## Step 2 — Define the Moltbot Output Contract
Create: `docs/moltbot/output-contract.v1.json`

Moltbot must return exactly one of:
- `ask_client` { question_text, why, state_suggestion }
- `vendor_outreach_plan` { category, normalized_need, vendor_filters, batch_size, vendor_questions, stop_conditions, calling }
- `shortlist` { summary_text, items[], handoff }
- `escalate` { reason, safe_client_message, state_suggestion }

Validator rule: any other output → reject + fallback to coded workflow.

## Step 3 — Implement the Orchestrator Loop
Create: `src/orchestrator/handleInboundMessage.ts`

Algorithm:
1. Load Context Pack: `get_request_snapshot(request_id)`
2. If media: create OCR job, set `ocr_processing`, respond "Processing image…"
3. Call Moltbot with Context Pack + policies
4. Validate output against contract
5. Execute according to type (tools only)
6. Write audit record for every decision

## Step 4 — Safety gates
Create: `.agent/rules/20_safety_gates.md`

Required gates:
- Feature flags: `AI_CONCIERGE_ENABLED`, `OCR_ENABLED`, `CALLING_ENABLED`
- Hard defaults: Calling OFF, batch size max 5, max vendors 15
- Consent gate: `start_call` must fail without valid consent

## Step 5 — Tests
- Contract test: invalid Moltbot output → fallback
- Tool idempotency: same message twice → no double-send
- Vendor batching: never exceeds limits
- Consent: call tool refuses without consent

## Done when
Full simulation works: client request → clarify → vendor outreach → replies → shortlist → handoff
