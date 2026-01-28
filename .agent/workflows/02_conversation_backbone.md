---
description: "Define the conversation backbone: WhatsApp event ingestion → Supabase persistence → request state machine. Creates the canonical tables, enums, and idempotent processing rules used by Moltbot, OCR, vendor outreach, and calling."
---

# Workflow 02 — Conversation Backbone + Request State Machine (Supabase)

## Goal
Implement a rock-solid, auditable backbone that everything plugs into:
- Every WhatsApp inbound/outbound message is stored.
- Every concierge "request" has a clear lifecycle state.
- Processing is idempotent (no duplicate vendor pings, no double replies).
- Moltbot is invoked only with a clean, minimal "context pack" derived from this backbone.

## Outputs
1) SQL migrations for Supabase (tables + enums + indexes)
2) RLS posture decision (initially service-role only; later tighten)
3) A single "context pack" JSON schema for Moltbot calls
4) Tests: idempotency + state transitions + vendor outreach dedupe

## Step 1 — Create state machine definitions

### Request states (client-side)
- `collecting_requirements`
- `ocr_processing`
- `vendor_outreach`
- `awaiting_vendor_replies`
- `shortlist_ready`
- `handed_off`
- `closed`
- `error`

### Vendor outreach states (per vendor)
- `queued` | `sent` | `replied` | `no_response` | `failed` | `excluded`

### Call consent states
- `not_requested` | `requested` | `granted` | `denied` | `expired`

### Hard transition rules
- Never skip from `collecting_requirements` → `shortlist_ready` unless requirements are already complete.
- `handed_off` ends concierge mediation.
- `error` requires a human-readable reason + safe fallback response.

## Step 2 — Create Supabase tables
Create `supabase/migrations/0002_moltbot_conversation_backbone.sql`:

### Tables to create:
- `conversations` (id, channel, client_phone, language, status)
- `conversation_messages` (provider_message_id unique for dedupe)
- `marketplace_requests` (request_state, requirements, shortlist)
- `ocr_jobs` (status, extracted, confidence)
- `vendors` (business_name, whatsapp_phone, categories)
- `vendor_outreach` (unique by request_id + vendor_id)
- `call_consents` (status, scope, expires_at)
- `call_attempts` (status, provider_call_id)

## Step 3 — Define the "Context Pack" sent to Moltbot
Required fields:
- `request_id`, `conversation_id`, `language`
- `request_state`, `requirements`
- `last_messages` (last 10–20 messages; redact secrets)
- `ocr` (latest extracted + confidence)
- `vendor_outreach_summary`
- `policies` (calling enabled? ocr enabled? ai enabled?)

Moltbot output contract:
- `ask_client` | `vendor_outreach_plan` | `shortlist` | `escalate`

## Step 4 — Implement idempotent ingestion
- Every WhatsApp inbound event maps to one `provider_message_id`
- Before inserting a message, check unique constraint (ignore duplicates)
- Vendor outreach: insert first (unique constraint ensures dedupe), then send

## Step 5 — Acceptance tests
1) Same inbound webhook twice → one `conversation_messages` row
2) Same vendor twice → one `vendor_outreach` row, one WhatsApp message
3) Request cannot be `handed_off` unless `shortlist_ready` was reached
4) OCR low confidence forces `ask_client`

## Done when
- Migration runs cleanly
- Messages dedupe correctly
- Requests have correct state transitions
- Vendor outreach is deduped
