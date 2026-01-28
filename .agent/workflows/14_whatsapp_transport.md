---
description: "Refactor existing Meta WhatsApp Business API integration into a clean Tool-backed Transport Layer. Isolates WhatsApp specifics from Moltbot/OCR logic."
---

# Workflow 14 — WhatsApp Transport Layer as Tools

## Goal
Turn current WhatsApp code into a stable transport module exposing:
- receive webhooks (inbound)
- send messages (outbound to client/vendor)
- initiate calls
- receive call status callbacks

Everything else (AI, OCR, vendor selection) is upstream and tool-driven.

## Outputs
1) `src/whatsapp/` module with clean interfaces
2) Tool endpoints: send_client_message, send_vendor_message, start_call
3) Webhook handlers: inbound, call status
4) Idempotency + audit logging
5) Tests with mocked Meta API

## Step 1 — Define transport interfaces
Create `src/whatsapp/types.ts`:

```typescript
interface SendMessageInput {
  to_phone: string;
  text: string;
  message_type: 'text' | 'interactive';
  idempotency_key: string;
  request_id: string;
}

interface SendMessageOutput {
  provider_message_id: string;
  conversation_message_id: string;
}

interface StartCallInput {
  to_phone: string;
  purpose: string;
  consent_id: string;
  idempotency_key: string;
  request_id: string;
}
```

## Step 2 — Implement outbound messaging
Create `src/whatsapp/sendMessage.ts`:

- Send via Meta Cloud API
- Write `conversation_messages` row for outbound
- Write `audit_events`
- Enforce idempotency: if same key succeeded, return existing IDs

## Step 3 — Normalize inbound webhooks
Create `src/whatsapp/normalizeInbound.ts`:

Output:
```typescript
interface NormalizedInboundMessage {
  provider_message_id: string;
  from_phone: string;
  message_type: 'text' | 'image' | 'document' | 'audio' | 'interactive';
  text_body?: string;
  media_url?: string;
  raw_payload: object;
}
```

## Step 4 — Inbound webhook handler
Create `src/whatsapp/webhookInbound.ts`:

1. Verify webhook signature
2. Normalize payload
3. Insert message (deduped)
4. Select/create conversation + request
5. Call orchestrator

## Step 5 — Consent prompts
Create `src/whatsapp/sendConsentPrompt.ts`:

- Send YES/NO prompt
- Store consent row status='requested'
- If send fails, mark audit event

## Step 6 — Call initiation wrapper
Create `src/whatsapp/startCall.ts`:

Enforce before calling Meta:
- CALLING_ENABLED=true
- Request state not handed_off
- Consent granted + not expired
- Create call_attempts row before API call

## Step 7 — Call status webhook
Create `src/whatsapp/webhookCallStatus.ts`:

1. Verify authenticity
2. Map provider status to call_attempts.status
3. Persist raw payload
4. On failure: send chat fallback

## Step 8 — Tests
1. send_client_message is idempotent
2. Inbound dedupe works
3. start_call refuses without consent
4. Status updates persist and trigger fallback

## Done when
- System never calls Meta APIs directly
- All WhatsApp interactions are tool-driven, audited, idempotent
