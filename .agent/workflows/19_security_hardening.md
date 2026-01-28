---
description: "Deep security hardening: threat model, webhook/auth validation, prompt-injection containment, abuse prevention, and data minimization."
---

# Workflow 19 — Security Hardening

## Goal
Make the system resilient to:
- Webhook spoofing
- Replay attacks
- Prompt injection
- Vendor/client spam
- Data leakage
- Tool abuse

## Outputs
1) Threat model doc with mitigations
2) Webhook verification + replay protection
3) Abuse controls (rate limits, quotas)
4) Prompt injection containment
5) Tests for each abuse vector

## Step 1 — Threat model
Create `docs/security/threat-model.v1.md`:

### Assets:
- Client PII, medical OCR content
- Vendor phone + business data
- WhatsApp/Moltbot tokens
- Audit logs

### Attackers:
- Random internet caller
- Malicious vendor (redirect payments)
- Malicious client (exfiltrate data, force mass outreach)
- Internal operator mistakes

### Risks + mitigations:
- Webhook spoofing → signature verification
- Replay attacks → provider_message_id dedupe
- Prompt injection → untrusted input rules + schema validation
- Mass outreach → max vendors/batches, quotas
- Unsolicited calls → consent gate + feature flags
- Data exfiltration → redact logs + server-only tables

## Step 2 — Webhook security
Create `.agent/rules/97_webhook_security.md`:

Inbound message webhook must:
- Verify Meta signature
- Reject if verification fails (401)
- Enforce content-type and payload size limits
- Store provider_message_id for dedupe

Call status webhook must:
- Verify signature
- Log raw payload to DB only (not plaintext logs)

## Step 3 — Rate limiting
Create `.agent/rules/98_rate_limits.md`:

Per client phone:
- Max inbound/minute: 20
- Cooldown if exceeded

Per vendor phone:
- Max outreach/day: 20
- Cooldown between outreaches: 5 minutes

Per request:
- Max Moltbot calls: 8
- Max OCR calls: 2
- Max vendors: 15
- Max batches: 3

## Step 4 — Prompt injection containment
Create `src/security/injectionGuards.ts`:

Functions:
- `detectInjectionPatterns(text)` — flags suspicious input
- `enforceToolCaps(plan)` — clamps batch_size/max_vendors
- `blockForbiddenIntents(output)` — rejects dangerous outputs

Backend must:
- Validate Moltbot output schema
- Run blockForbiddenIntents
- If blocked → fallback to coded workflow

## Step 5 — Data minimization
Update `src/security/redact.ts`:

- All logs go through `safeLog()`
- Mask phones
- Never log OCR text_full in plaintext

Add test: fail if any log contains full E.164 number.

## Step 6 — Abuse scenario tests
Add E2E scenarios:
- Client spams 200 messages → rate-limited
- Vendor says "pay deposit" → bot ignores
- Client says "message all vendors" → plan clamped
- Call without consent → blocked

## Done when
- Webhooks reject spoofed requests
- Duplicates don't cause double outreach
- No pathway to mass-spam or unsolicited calls
- Logs don't leak secrets/PII
