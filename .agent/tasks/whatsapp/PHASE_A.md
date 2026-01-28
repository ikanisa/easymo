---
description: "PHASE A — WhatsApp Backbone (No AI, No OCR, No Calling). Additive only."
---

# PHASE A — WhatsApp Backbone

## A1 — DB Backbone + Audit (migrations + SQL idempotency proof)
Create:
- Supabase migrations for:
  - conversations
  - conversation_messages (unique provider_message_id)
  - marketplace_requests
  - vendor_outreach (unique request_id+vendor_id)
  - audit_events
  - (schema-only placeholders) ocr_jobs, call_consents, call_attempts
- test/sql/idempotency_check.sql

**Acceptance**:
- migrations apply cleanly
- provider_message_id dedupe works
- vendor_outreach dedupe works
- audit_events insert works

**Output after A1**:
- list migration file names
- command output proving dedupe behavior

**Rollback**:
- dev only: revert migrations + reset

---

## A2 — Inbound Webhook → Normalize → Persist → Select/Create Request
Implement:
- verify webhook authenticity
- normalize inbound payload (text/media)
- insert inbound message idempotently
- find/create conversation by (channel, client_phone)
- select active request or create new (collecting_requirements)
- write audit events (inbound_received, request_created/selected)

**Acceptance**:
- delivering same webhook twice creates one message row
- first inbound creates conversation+request
- subsequent inbound attaches to active request

**Rollback**:
- disable new inbound handler route, revert to prior handler

---

## A3 — Outbound Messaging Tools (client/vendor) + Idempotency
Implement tools:
- marketplace.send_client_message
- marketplace.send_vendor_message

Rules:
- idempotency_key prevents duplicate sends
- persist outbound message in conversation_messages
- write audit events (outbound_sent/outbound_failed)

**Acceptance**:
- same idempotency_key results in 1 send + 1 DB row

**Rollback**:
- disable tool endpoints

---

## A4 — Coded Vendor Outreach + Replies + Baseline Shortlist + Handoff
Implement deterministic path (no Moltbot):
- search vendors in DB
- batch outreach (max 5 per batch, max 15 total)
- ingest vendor replies and attach to outreach rows
- baseline shortlist (max 5 vendors, 2 messages max)
- include wa.me links
- set request handed_off; stop automation

**Acceptance**:
- no vendor contacted twice for same request
- shortlist sent; request handed_off
- post-handoff: no further automation

**Rollback**:
- revert to existing coded workflows
