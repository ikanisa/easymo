# Edge Function Inventory (Phase 0)

## Active Functions

- **wa-webhook** — primary WhatsApp router; largest surface area.
- **flow-exchange** — handles rich flows (encrypted payloads) for WA.
- **flow-exchange-mock** — sandbox for Meta Flow API; candidate for
  consolidation with shared crypto helpers.
- **notification-worker** — cron/HTTP worker for notification queue.
- **ocr-processor** — OCR job runner for insurance menu uploads.
- **admin-*** (users, settings, stats, trips, subscriptions, messages) — admin
  panel API.
- **media-fetch**, **housekeeping**, **campaign-dispatch**, **qr_info**,
  **qr-resolve** — specialized endpoints.

## Observations & Next Steps

1. **Module structure** — `wa-webhook` mixes router, service, state, and domain
   logic; plan to split into `/domains/<feature>` modules with shared utilities
   (logging, Supabase client).
2. **Shared helpers** — `supabase/functions/_shared/flow_crypto.ts` created;
   expand to include logging, HTTP clients, error handling.
3. **Redundant functions** — confirm if admin functions overlap with GraphQL or
   rest; evaluate deprecation plan.
4. **Testing** — deno-based smoke tests now live in `tests/edge/` (see below);
   SQL regression scripts cover privileged helpers.
5. **Documentation** — add README per function with env vars, expected triggers,
   and runbooks.

## Deployment Workflow (Phase 3)

1. Run local checks:
   - `deno test tests/edge/` (router smoke tests)
   - `psql -f tests/sql/run_all.sql` against a staging database snapshot
2. Build and deploy edge functions via Supabase CLI:
   - `supabase functions deploy wa-webhook`
   - `supabase functions deploy notification-worker`
   - `supabase functions deploy flow-exchange`
   - `supabase functions deploy ocr-processor`
3. Verify deployment logs in Supabase dashboard and ensure cron triggers (e.g.
   `notification-worker`) remain enabled.

## Smoke Tests

- **Router**: `tests/edge/wa_webhook_router.test.ts` stubs guards/handlers to
  ensure the WhatsApp router delegates correctly for text, list, button,
  location, and unknown payloads.
- **Notifications**: `supabase/functions/wa-webhook/notify/sender.test.ts`
  exercises queue processing + retry logic.
- **SQL Regression**: `tests/sql/claim_notifications.sql`,
  `tests/sql/promote_draft_menu.sql`, `tests/sql/matching_v2.sql` validate
  privileged functions in a transactional harness.

> Run `deno test tests/edge/` and
> `deno test --allow-env supabase/functions/wa-webhook/notify/sender.test.ts`
> before deploying.
