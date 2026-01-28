---
description: "Implement Meta WhatsApp Business Calling as a controlled escalation tool: consent capture, strict triggers, call initiation, callbacks, and safe fallbacks. Prevents unsolicited calling and preserves auditability."
---

# Workflow 07 — Calling Tool (Consent, Triggers, Callbacks, Fallbacks)

## Goal
Enable calls via Meta WhatsApp Business Calling **only** when appropriate and consented.
Calling is an escalation path, not the default.

## Outputs
1) Calling policy rules
2) Consent capture flow
3) Backend call tool endpoints
4) Call status callback handler
5) Tests: consent enforcement, gating, fallback

## Step 1 — Define the "When to Call" policy
Create `.agent/rules/60_calling_policy.md`:

### Allowed call targets:
- Vendor call: confirm availability quickly when chat is slow/unclear
- Client call: only if client explicitly requested

### Allowed triggers (vendor call):
1. `urgency=true` AND no reply within 3 minutes
2. Vendor reply is ambiguous AND client waiting (confidence < 0.6)

### Allowed triggers (client call):
1. Client explicitly asked: "call me"
2. Client opted in + request needs rapid clarification

### Hard "NO CALL" rules:
- No consent → never call
- After `handed_off` → never call
- Medical prescriptions: never diagnose, only clarify text

## Step 2 — Consent model
Consent record must include:
- `request_id`, `phone`, `status`, `scope`, `expires_at`

Status values: `requested` | `granted` | `denied` | `expired`
Scope: `call_vendor` | `call_client` | `either`

## Step 3 — WhatsApp consent prompts
Create `docs/calling/consent-messages.v1.md`:

Request template:
> "To speed this up, I can place a WhatsApp call. Do you allow a call for this request?"
> Options: YES | NO

Store: who, when, scope

## Step 4 — Tool endpoints
### `marketplace.request_call_consent`
1. Check request state not handed_off/closed/error
2. Create consent row (status='requested')
3. Send consent prompt message
4. Return consent_id + status

### `marketplace.start_call`
MUST enforce:
1. `CALLING_ENABLED=true`
2. Request state NOT handed_off/closed/error
3. Consent granted, not expired, scope allows
4. Create call_attempt row
5. Call Meta API
6. Update status

## Step 5 — Consent capture handler
Create `src/calling/consentHandler.ts`

On client reply YES/NO:
- Update consent status
- Confirm via chat: "Thanks. I may place a call if needed."

## Step 6 — Call status webhook
Create `src/calling/callStatusWebhook.ts`

1. Verify authenticity
2. Map provider status to call_attempts.status
3. Store raw payload
4. On failure: send chat fallback "Call didn't go through; continuing via chat."

## Step 7 — Moltbot integration
Add `policies.calling`:
- enabled, consent_status, allowed_scopes
- cooldown_minutes (max 1 call per 10 min per request)

## Step 8 — Tests
1. `start_call` fails without consent
2. `start_call` fails when handed_off
3. Duplicate calls prevented by idempotency
4. Callback updates status, triggers fallback on failure

## Done when
- Calls initiated only with consent, fully auditable
