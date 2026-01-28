---
description: "Add enterprise-grade observability: audit logs, traces, metrics, cost controls, and a regulator-friendly reconciliation pack. Ensures every AI/tool decision is explainable and reversible."
---

# Workflow 09 — Observability & Audit Pack

## Goal
Make the system auditable end-to-end:
- Every action traced to `request_id`
- Every side-effect logged with inputs/outputs/timing
- Answer: "Why did the bot pick these vendors?"

## Outputs
1) Audit log table + write helpers
2) Structured logging format (JSON)
3) Metrics: time-to-shortlist, reply rate, OCR confidence, call rate
4) Cost controls: token budgets, per-request limits
5) Reconciliation pack generator

## Step 1 — Create audit log table
Create `supabase/migrations/0003_moltbot_audit_logs.sql`:

Table: `audit_events`
- `id uuid primary key`
- `request_id uuid`, `conversation_id uuid`
- `event_type text not null`
- `actor text not null`
- `input jsonb`, `output jsonb`
- `idempotency_key text`
- `duration_ms int`
- `created_at timestamptz`

Event types:
- `whatsapp.inbound_received`, `whatsapp.outbound_sent`
- `moltbot.called`, `moltbot.output_rejected`
- `ocr.job_created`, `ocr.job_done`
- `vendor.outreach_sent`, `vendor.reply_recorded`
- `call.consent_requested`, `call.started`, `call.status_updated`
- `request.state_changed`

## Step 2 — Standardize structured logs
Create `.agent/rules/70_logging_standard.md`:

Every log line must include:
- `request_id`, `conversation_id`, `event_type`
- `severity`, `idempotency_key`, `timing_ms`

Never log secrets or full raw media.

## Step 3 — AI cost controls
Create `.agent/rules/71_cost_controls.md`:

### Token budgets (per request):
- Max Moltbot calls: 8
- Max OCR calls: 2
- Max vendor batches: 3 (15 vendors max)

### Time budgets:
- Target time-to-shortlist: ≤ 6 minutes
- Max processing time: 10 minutes → apologize + handoff options

## Step 4 — Metrics instrumentation
Create `src/metrics/metrics.ts`:

Emit:
- `requests_created_total`
- `time_to_shortlist_seconds` (histogram)
- `vendor_messages_sent_total`
- `ocr_jobs_total`, `ocr_failures_total`
- `calls_started_total`, `calls_failed_total`
- `moltbot_output_rejected_total`

## Step 5 — Reconciliation pack
Create `src/audit/exportRequestPack.ts`

Input: `request_id`

Output JSON bundle:
- Request snapshot (state transitions)
- Conversation messages (redacted)
- OCR jobs (extracted + confidence)
- Vendor outreach (sent + replies)
- Moltbot decisions (hashed inputs + outputs)
- Call attempts + statuses
- Final shortlist + handoff timestamp

Redaction rules:
- Do not include full client phone
- Mask vendor numbers in external exports

## Step 6 — Alerting rules
Create `.agent/rules/72_alerting.md`:

Alert on:
- OCR failure rate > 10% daily
- Moltbot rejection > 5% daily
- Vendor reply rate < 15%
- Call failures spike

## Step 7 — Tests
1. Every orchestrator path writes audit events
2. Export pack includes all sections
3. Redaction removes PII
4. Budget exceed → safe fallback

## Done when
- Any request_id → full story in minutes
- Can disable AI instantly, audit continues
