# Structured Logging Standard

## Purpose
Ensure every log line is machine-parseable, traceable to a request, and privacy-safe.

## Required Log Format (JSON)

Every log entry MUST include:

```json
{
  "timestamp": "ISO 8601 format",
  "request_id": "uuid (if applicable)",
  "conversation_id": "uuid (if applicable)",
  "event_type": "category.action (e.g., moltbot.called)",
  "actor": "system|moltbot|client|vendor|admin",
  "severity": "debug|info|warn|error",
  "idempotency_key": "string (if applicable)",
  "timing_ms": "number (if measured)"
}
```

## Event Type Naming Convention

Format: `domain.action`

### Allowed Event Types

#### WhatsApp Events
- `whatsapp.inbound_received`
- `whatsapp.outbound_sent`
- `whatsapp.send_failed`

#### Moltbot Events
- `moltbot.called`
- `moltbot.output_accepted`
- `moltbot.output_rejected`
- `moltbot.budget_exceeded`

#### OCR Events
- `ocr.job_created`
- `ocr.job_processing`
- `ocr.job_done`
- `ocr.job_failed`

#### Vendor Events
- `vendor.outreach_queued`
- `vendor.outreach_sent`
- `vendor.reply_recorded`
- `vendor.no_response`

#### Call Events
- `call.consent_requested`
- `call.consent_granted`
- `call.consent_denied`
- `call.started`
- `call.status_updated`
- `call.failed`

#### Request Events
- `request.created`
- `request.state_changed`
- `request.completed`
- `request.error`

## What MUST Be Logged

1. All inbound webhook events
2. All outbound message sends
3. All Moltbot API calls (input hash + output hash)
4. All OCR job lifecycle events
5. All state machine transitions
6. All errors with safe stack traces

## What MUST NOT Be Logged

### Never Log Secrets
- API keys
- Service role keys
- Webhook verification tokens
- JWT tokens

### Never Log Full PII
- Full phone numbers → mask to last 3 digits (e.g., `***123`)
- Full addresses → log only city/country
- Email addresses → mask domain (e.g., `j***@***.com`)

### Never Log Raw Payloads
- Full WhatsApp webhook payloads → store in DB only
- Full OCR extracted text → store in DB only
- Full media URLs → log media_id only, not signed URLs

## Phone Number Masking

```typescript
function maskPhone(phone: string): string {
  if (phone.length < 4) return "***";
  return "***" + phone.slice(-3);
}
```

## Error Logging

Errors MUST include:
- `error_code` (machine-readable)
- `error_message` (safe for logging)
- `error_context` (relevant but not sensitive data)

Errors MUST NOT include:
- Full stack traces in production (use error_id and lookup)
- Request/response bodies
- Database query parameters

## Log Retention

- Production logs: 30 days
- Audit events (DB): 2 years (compliance)
- Error traces: 90 days
