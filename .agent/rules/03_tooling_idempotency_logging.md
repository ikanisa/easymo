# Tooling, Idempotency & Logging

## Purpose
Ensure every action is traceable, repeatable, and auditable.

## Idempotency Requirements

### Message Ingestion
- Every inbound WhatsApp event has a `provider_message_id`
- Store with unique constraint: duplicate inserts fail silently
- Never create duplicate requests from same message

### Outbound Messages
- Every send requires an `idempotency_key`
- Format: `request:{request_id}:to:{phone}:hash:{content_hash}`
- If key exists in success state, return existing result without resending

### Vendor Outreach
- Unique constraint on `(request_id, vendor_id)`
- Insert before sending; if fails, vendor already contacted
- Never double-ping same vendor for same request

### Tool Calls
- Every tool call includes:
  - `request_id`
  - `idempotency_key`
  - `actor` (system, client, vendor, admin)
- Idempotent tools return previous result on retry

## Logging Requirements

### Structured Log Format
Every log entry must include:
- `timestamp` (ISO 8601)
- `request_id` (if applicable)
- `conversation_id` (if applicable)
- `event_type`
- `actor`
- `severity` (debug, info, warn, error)

### What to Log
- All inbound webhooks (event_type: `whatsapp.inbound_received`)
- All outbound sends (event_type: `whatsapp.outbound_sent`)
- All Moltbot calls (event_type: `moltbot.called`)
- All OCR jobs (event_type: `ocr.job_created`, `ocr.job_done`)
- All state transitions (event_type: `request.state_changed`)
- All errors (with safe stack trace)

### What NOT to Log
- Full client phone numbers (mask to last 3 digits)
- Raw payloads (store in DB, not logs)
- Secrets, tokens, API keys
- Full OCR text (store in DB only)

## Audit Trail
- `audit_events` table stores all significant actions
- Each row linked to `request_id`
- Include input/output hashes for Moltbot calls
- Retain for compliance period (document in ops)

## Tool Registry
All tools follow naming convention: `marketplace.<verb>_<object>`

Required tools:
1. `marketplace.search_vendors`
2. `marketplace.get_request_snapshot`
3. `marketplace.send_client_message`
4. `marketplace.send_vendor_message`
5. `marketplace.record_vendor_reply`
6. `marketplace.create_ocr_job`
7. `marketplace.get_ocr_result`
8. `marketplace.request_call_consent`
9. `marketplace.start_call`
10. `marketplace.update_request_state`
