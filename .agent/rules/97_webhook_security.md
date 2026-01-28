# Webhook Security Rules

## Purpose

Define mandatory security requirements for all WhatsApp webhook endpoints.

---

## Inbound Message Webhook

### Signature Verification (REQUIRED)

All inbound webhooks MUST:

1. **Verify Meta signature** using HMAC-SHA256
   - Header: `X-Hub-Signature-256`
   - Secret: `WHATSAPP_APP_SECRET`
   - Use timing-safe comparison (`crypto.timingSafeEqual`)

2. **Reject if verification fails**
   - Return HTTP 401 Unauthorized
   - Log to audit: `whatsapp.webhook_signature_invalid`
   - Do NOT process the payload

### Implementation Reference

```typescript
// src/whatsapp/normalizeInbound.ts
export function verifyWebhookSignature(
    payload: string,
    signature: string,
    appSecret: string
): boolean
```

---

## Content Requirements

### Content-Type Validation

- Accept: `application/json` only
- Reject other content types with HTTP 415

### Payload Size Limits

- Max size: 1 MB
- Reject oversized payloads with HTTP 413
- Log: `whatsapp.payload_too_large`

---

## Replay Protection

### Provider Message ID Dedupe

All message handlers MUST:

1. Store `provider_message_id` in database
2. Use unique constraint to prevent duplicates
3. On duplicate: Skip processing silently (idempotent)

### Implementation Reference

```typescript
// src/whatsapp/webhookInbound.ts
async function insertMessageIdempotent(
    supabase: SupabaseClient,
    conversationId: string,
    msg: NormalizedInboundMessage
): Promise<{ id: string; isNew: boolean }>
```

---

## Call Status Webhook

### Signature Verification

Same requirements as inbound message webhook.

### Payload Handling

- Log raw payload to database ONLY (not plaintext logs)
- Use `redactRawPayload()` before any logging
- Store in: `moltbot_call_consents.call_metadata`

---

## Audit Requirements

Log these events to `moltbot_audit_events`:

| Event Type | Trigger |
|------------|---------|
| `whatsapp.webhook_signature_invalid` | Signature check failed |
| `whatsapp.message_received` | Valid message processed |
| `whatsapp.payload_too_large` | Size limit exceeded |
| `whatsapp.duplicate_message` | Replay attempt detected |

---

## Checklist for New Endpoints

- [ ] Signature verification enabled
- [ ] Content-type validation
- [ ] Payload size limit
- [ ] Idempotency via provider_message_id
- [ ] Audit events configured
- [ ] No plaintext secrets in logs
