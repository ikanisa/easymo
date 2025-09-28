# Security Audit

## Signature & Idempotency

- `wa-webhook` verifies Meta signature (HMAC SHA-256) and logs failures before
  returning 401.
- `wa_events` stores message IDs to prevent replay.

## PII masking

- Logs mask WA IDs (`***1234`) before emitting structured events.
- QR resolver and admin logs mask phone numbers.

## Access controls

- Admin flows gated by `app_config.admin_numbers`/`insurance_admin_numbers` plus
  PIN session (`admin_sessions`).
- STOP command updates `contacts` opt-out flag.

## Secrets

- Function expects `WA_TOKEN`, `WA_APP_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`,
  `OPENAI_API_KEY`, `QR_TOKEN_SECRET` (set via env).

## Pending

- Admin broadcast/templates placeholders require deeper review before enabling
  actual sends.
- Ensure future OCR worker enforces storage bucket access via signed URLs.
