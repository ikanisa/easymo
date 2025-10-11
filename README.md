# easymo

This repo follows a standard blueprint to help our Dev Agent (Codex-style) work
better.

- `app/` – app code
- `packages/` – shared libs
- `supabase/` – database, migrations, seeds
- `agent/` – Dev Agent tools + policies
- `.github/workflows/` – CI jobs
- `docs/` – decisions & notes

See `docs/maintenance/refactor-roadmap.md` for the staged cleanup plan that
guides go-live hardening efforts.

## Alert Preferences (Admin Panel)

- The settings screen now calls `/api/settings/alerts`, which requires
  `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for write operations and
  `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` for read access.
- When these credentials are missing, the route falls back to mock data and
  returns an integration status of `degraded`. Operators can force this mode by
  setting `NEXT_PUBLIC_USE_MOCKS=true`.
- Supabase migrations `20251031152000_admin_alert_prefs_rls.sql` and
  `20251031151500_insurance_media_queue_enhancements.sql` must be applied before
  enabling the feature in staging or production.

## Insurance OCR Worker

- Deploy `supabase/functions/insurance-ocr` alongside migration
  `20251031151500_insurance_media_queue_enhancements.sql`.
- Optional metrics webhooks can be enabled via
  `INSURANCE_OCR_METRICS_WEBHOOK_URL` (and
  `INSURANCE_OCR_METRICS_TOKEN` for bearer auth). When set, the worker emits
  `insurance_ocr.queue_remaining` and `insurance_ocr.processed` samples after
  each run.

## Monitoring Helpers

- `tools/monitoring/admin-synthetic-checks.ts` performs simple HTTP probes
  against critical Admin APIs. Set `ADMIN_BASE_URL` (and optionally
  `ADMIN_API_TOKEN`) before running; the script exits non-zero on failure so it
  can back GitHub Actions or cron alerts.

---

## WhatsApp Admin Approval (Simulator Notes)

These notes apply to the WhatsApp admin approval flows via Supabase Edge Functions.

### Commands

- `SUB APPROVE <id> [txn_id]` - Approve a subscription with optional transaction ID
- `SUB REJECT <id> [reason]` - Reject a subscription with optional reason
- `SUB LIST PENDING` - List all pending subscription IDs

### Simulator Usage

1. Use `/admin/wa-console` to simulate inbound admin WhatsApp messages (dev mode only)
2. Configure admin numbers in Settings → Admin WhatsApp Numbers
3. Copy commands from Subscriptions row buttons to send via WhatsApp operationally

### Phase-2 Integration

In Phase-2, the backend will:
- Parse real WhatsApp messages using the same command grammar
- Enforce admin phone whitelist from settings
- Update database and reply to admin with success/failure
- Use webhook at `/functions/v1/wa-webhook`

### WhatsApp Webhook

- Deploy the bundled Edge Function with `supabase functions deploy wa-webhook --no-verify-jwt` after setting:
  - `WA_PHONE_ID` / `WHATSAPP_PHONE_NUMBER_ID`
  - `WA_TOKEN` / `WHATSAPP_ACCESS_TOKEN`
  - `WA_APP_SECRET` / `WHATSAPP_APP_SECRET`
  - `WA_VERIFY_TOKEN` / `WHATSAPP_VERIFY_TOKEN`
  - `WA_BOT_NUMBER_E164`
- The webhook validates Meta signatures, enforces admin phone allow-lists, consumes credits, and routes messages through the same flows the simulator exercises.

### Environment Variables

Use `.env.sample` as a guide and never commit secrets.
