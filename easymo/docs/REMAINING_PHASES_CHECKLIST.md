# Remaining Phases Checklist

## Phase 2 – Supabase Integration (Complete)

- ✅ **RealAdapter migration:** `src/lib/adapter.real.ts` now injects a
  Supabase service client and issues direct queries/RPC calls for all admin
  flows.
- ✅ **Edge functions:** Supabase edge functions for admin settings, stats,
  users, trips, subscriptions and the simulator are implemented under
  `supabase/functions/` with shared auth helpers.
- ✅ **Database migrations:** `20251112090000_phase2_mobility_core.sql` and
  `20251112091000_phase2_mobility_rls.sql` provision the mobility schema,
  PostGIS helpers and RLS policies.
- ✅ **Seed data:** `supabase/seed/fixtures/phase_b_seed.sql` provides
  idempotent fixtures for profiles, subscriptions, vouchers and simulator
  presence.
- ✅ **Environment template:** `docs/env/env.sample` documents Supabase,
  simulator, WhatsApp and monitoring variables required for local and hosted
  deployments.
- ✅ **Error handling & logging:** Front-end adapter calls surface friendly
  errors, while edge functions centralise logging via `_shared/admin.ts`.
- ✅ **Tests:** Vitest coverage exercises the adapter; Deno tests in
  `supabase/functions/tests/` cover edge-function request handling.
- ✅ **Documentation:** README, runbooks and this checklist now reference the
  Supabase-first architecture. CI hooks should be reviewed separately when
  deployment automation resumes.

## Phase 5 – Operational Enhancements (Optional / Deferred)

### 1. Vendor Pending Reminder (WhatsApp Template)

- Scheduled Supabase function (cron) to scan `orders` with status `pending`
  exceeding threshold (e.g., 15 minutes).
- Use existing notification helper to send `order_pending_vendor` template to
  active bar numbers.
- Insert `order_events` entry (`vendor_nudge`) for audit.
- Configurable threshold via `platform_settings` table (future).

**Status:** Complete — job runs via `supabase/functions/order-pending-reminder` and queues `order_pending_vendor` notifications.

### 2. Cart Reminder

- Scheduled job to find `carts` with status `open` older than X minutes.
- Send `cart_reminder_customer` template to customer WA ID.
- Respect quiet hours (reuse policy evaluation).

**Status:** Complete — `supabase/functions/cart-reminder` queues `cart_reminder_customer` with quiet-hours safeguards.

### 3. Admin Notification Retry API

- Add Next.js API route `/api/notifications/retry`.
- Verify failure status, resend via notification helper, update row.

**Status:** Complete — `/api/notifications/retry` re-queues failed notifications with outbound policy checks.

## Phase 6 – QA & Runbooks

### 1. End-to-End Test Scripts

- Build Postman/Vitest scripts covering customer order flow, vendor status
  updates, and notification side-effects.
- Validate OCR pipeline by uploading sample PDF via `wa-webhook` endpoint.

**Status:** Complete — Vitest e2e suite (`admin-app/tests/e2e/admin-flows.test.ts`) covers order journeys, OCR job review, and notification retry flows.

### 2. Runbooks & Monitoring

- Update `docs/RUNBOOK_TABLETOP_PLAN.md` and `docs/OBSERVABILITY_GAPS.md` once
  real telemetry integrated.
- Configure Supabase log drains or Sentry DSN to capture Edge Function errors.

**Status:** Pending – blocked on env instrumentation.

### 3. Deployment Smoke Checklist

- Apply migrations in staging, deploy Edge Functions (`flow-exchange`,
  `wa-webhook`, `ocr-processor`).
- Validate template sends against sandbox numbers.
- Trigger OCR job manually via profiling worker.

**Status:** Pending.
