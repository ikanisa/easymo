---
description: "PHASE D — Calling via Meta WhatsApp Calling API. Consent-gated."
---

# PHASE D — Calling

## D1 — Consent + start_call tool + call status webhook
Implement:
- request consent (YES/NO) stored in DB
- start_call tool requires consent + CALLING_ENABLED
- callback updates call_attempts status
- chat fallback on failure

**Acceptance**:
- no call without consent
- blocked after handed_off
- idempotent start_call

**Rollback**:
- CALLING_ENABLED=false
