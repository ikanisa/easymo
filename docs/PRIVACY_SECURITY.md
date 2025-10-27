# Privacy & Security — Baskets Module

> **Note**: This document covers Baskets module specifics. For comprehensive security guidelines applicable to all modules, see [GROUND_RULES.md](GROUND_RULES.md).

## Data Classification
- PII: National IDs, MSISDNs, loan details.
- Financial: Contributions, loan collateral.

## Storage Controls
- Encrypted at rest (Supabase defaults).
- Access via RLS roles.

## Minimization & Masking
- Mask MSISDN in non-privileged views.
- Retain OCR artifacts only as required for compliance.
- **All logs MUST mask PII** using `maskPII()` utility (see [GROUND_RULES.md](GROUND_RULES.md))

## Secrets Management
- Edge functions read from secure env vars; no secrets client-side.
- **Follow secret management rules** in [GROUND_RULES.md](GROUND_RULES.md#secret-management)
- Never expose service role keys, admin tokens, or API secrets to client code
- Use `validateRequiredEnvVars()` to ensure required secrets are present

## Webhook Security
- **Verify all webhook signatures** using utilities in `supabase/functions/_shared/security.ts`
- WhatsApp webhooks: Use `verifyWhatsAppSignature()`
- Other providers: Use `verifyHmacSignature()`

## Compliance & Audit
- Audit log on all mutations.
- Retention policies TBD with SACCO requirements.
- **All operations logged with structured events** (see [GROUND_RULES.md](GROUND_RULES.md#observability))

