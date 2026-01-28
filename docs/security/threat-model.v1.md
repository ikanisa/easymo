# Threat Model v1 — Moltbot Concierge System

## Overview

This document defines the threat model for the Moltbot WhatsApp Concierge system. It identifies assets, potential attackers, risks, and corresponding mitigations.

---

## Assets

| Asset | Sensitivity | Storage |
|-------|-------------|---------|
| Client PII (phone, name) | High | `moltbot_conversations`, `marketplace_requests` |
| Medical OCR content | Critical | `moltbot_ocr_jobs.extracted_data` |
| Vendor phone + business data | Medium | `vendors`, `vendor_inventory_tags` |
| WhatsApp/Meta tokens | Critical | Environment variables (server-only) |
| Moltbot/Gemini API keys | Critical | Environment variables (server-only) |
| Audit logs | Medium | `moltbot_audit_events` |
| Call consent records | High | `moltbot_call_consents` |

---

## Attackers

| Attacker | Motivation | Capability |
|----------|------------|------------|
| Random internet caller | Spam, reconnaissance | Spoofed webhooks, enumeration |
| Malicious vendor | Redirect payments, exfiltrate client data | Crafted replies, social engineering |
| Malicious client | Force mass outreach, exfiltrate vendor data, abuse AI | Prompt injection, message flooding |
| Internal operator | Accidental misconfiguration | Console access, deployment |

---

## Risks and Mitigations

### R1: Webhook Spoofing
- **Impact:** Fake messages processed, data pollution
- **Mitigation:** HMAC-SHA256 signature verification (implemented in `normalizeInbound.ts`)
- **Status:** ✅ Implemented

### R2: Replay Attacks
- **Impact:** Duplicate outreach, double orders
- **Mitigation:** `provider_message_id` unique constraint + idempotent insert
- **Status:** ✅ Implemented

### R3: Prompt Injection
- **Impact:** AI manipulated to bypass controls, reveal data, spam vendors
- **Mitigation:**
  - Input: Detect injection patterns before context pack
  - Output: Schema validation + forbidden intent blocking
  - Fallback: Switch to coded workflow if blocked
- **Status:** 🔄 Implementing (`injectionGuards.ts`)

### R4: Mass Outreach / Spam
- **Impact:** Vendor harassment, reputation damage, cost explosion
- **Mitigation:**
  - Hard limits: `batch_size ≤ 5`, `max_vendors ≤ 15`
  - Per-client rate: 20 messages/minute
  - Per-vendor rate: 20 outreach/day, 5-min cooldown
- **Status:** ✅ Limits in safety gates, 🔄 Rate limiting module

### R5: Unsolicited Calls
- **Impact:** User harassment, legal liability
- **Mitigation:**
  - Consent gate: `state = granted` + not expired
  - Feature flag: `CALLING_ENABLED` default OFF
  - Audit: All call attempts logged
- **Status:** ✅ Implemented

### R6: Data Exfiltration
- **Impact:** PII leak, regulatory violation
- **Mitigation:**
  - Logs: `safeLog()` for all output
  - OCR: Never log `text_full` in plaintext
  - Export: `redactRawPayload()` before any external output
  - Sensitive tables: Server-only access (no anon key)
- **Status:** ✅ Partially implemented, 🔄 E.164 detection test

### R7: Token/Secret Exposure
- **Impact:** Account takeover, unauthorized API access
- **Mitigation:**
  - Never log secrets
  - Environment variables only (not DB)
  - Rotate on suspected breach
- **Status:** ✅ .env discipline enforced

---

## Control Matrix

| Control | R1 | R2 | R3 | R4 | R5 | R6 | R7 |
|---------|----|----|----|----|----|----|----| 
| Signature verification | ✓ | | | | | | |
| Idempotent message insert | | ✓ | | | | | |
| Injection pattern detection | | | ✓ | | | | |
| Output schema validation | | | ✓ | ✓ | | | |
| Hard limits (batch/vendor) | | | | ✓ | | | |
| Rate limiting | | | | ✓ | | | |
| Consent gate | | | | | ✓ | | |
| Feature flags | | | ✓ | | ✓ | | |
| safeLog() | | | | | | ✓ | ✓ |
| E.164 leak detection | | | | | | ✓ | |

---

## Audit Trail

All security-relevant events are logged to `moltbot_audit_events`:
- `whatsapp.webhook_signature_invalid`
- `moltbot.injection_detected`
- `moltbot.output_blocked`
- `moltbot.rate_limit_exceeded`
- `calling.consent_denied`
- `calling.consent_expired`

---

## Review Schedule

- **Quarterly:** Review threat model against new features
- **On Incident:** Update mitigations and add new risks
- **Pre-Launch:** Security review gate before production expansion
