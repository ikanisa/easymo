---
description: "A build order + task plan for implementable tasks. Converts Workflows 01–11 into phased implementation with verifiable increments."
---

# Workflow 12 — Implementation Order & Task Plan

## Goal
Turn the workflows into an executable plan:
- Build backbone first
- Add AI gradually
- Keep coded workflows as fallback
- Stay testable at every step

## Phase A — Backbone (no AI yet)

### A1) Supabase schema (Workflow 02 + 09)
Tasks:
- Add migrations: conversation backbone + audit_events
Acceptance:
- Migrations apply cleanly
- Dedupe constraint works

### A2) Webhook ingestion + persistence
Tasks:
- Verify WhatsApp webhook signature
- Store inbound messages
- Select/create request
- Append audit events
Acceptance:
- Double webhook → one message
- Request created/selected correctly

### A3) Vendor outreach execution (coded)
Tasks:
- Implement vendor selection
- Send vendor messages with idempotency
- Parse replies, persist
Acceptance:
- No duplicate outreach
- Replies parsed into fields

## Phase B — OCR (Gemini), still no AI decisions

### B1) OCR jobs + worker
Tasks:
- Create OCR job on media
- Worker processes with Gemini
- Store extracted + confidence
- Normalize requirements
Acceptance:
- Low confidence triggers "needs clarification" flag

## Phase C — Moltbot (AI for allowlist only)

### C1) Tool registry + orchestrator loop
Tasks:
- Implement tool endpoints
- Implement output validator
- Orchestrator: context pack → Moltbot → tools
Acceptance:
- Invalid output → fallback
- Tool calls logged

### C2) Moltbot skill
Tasks:
- Create skill files
- Add examples + injection attacks
Acceptance:
- Valid outputs for all examples
- Attacks do not change behavior

### C3) Shortlist generation + handoff
Tasks:
- Generate shortlist from replies
- wa.me links
- Set handed_off
Acceptance:
- Max 2 client messages
- Request ends handed_off

## Phase D — Calling (last)

### D1) Consent flow + gating
Tasks:
- Consent request + capture
- start_call gated by consent
- Callbacks logged
Acceptance:
- Zero calls without consent
- Failures fall back to chat

## Phase E — Observability + CI

### E1) E2E suite
Tasks:
- Add golden scenarios
- Mocks for all dependencies
Acceptance:
- All scenarios pass in CI

### E2) Deployment runbooks
Tasks:
- Flags default off
- Allowlist pilot
- Rollback steps documented
Acceptance:
- Toggle AI off → coded workflows instantly

## Feature flags (must exist before prod)
- `AI_CONCIERGE_ENABLED=false`
- `OCR_ENABLED=false`
- `CALLING_ENABLED=false`
- `AI_CONCIERGE_ALLOWLIST_PHONES`

## Done when
- Phase A end-to-end without AI
- Enable OCR
- Enable AI for allowlist
- Enable calling after consent works
- Flip flags off to revert instantly
