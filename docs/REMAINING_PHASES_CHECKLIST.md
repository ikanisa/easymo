# Remaining Phases Checklist

## Phase 5 – Operational Enhancements (Optional / Deferred)

### 1. Vendor Pending Reminder (WhatsApp Template)

- Scheduled Supabase function (cron) to scan `orders` with status `pending`
  exceeding threshold (e.g., 15 minutes).
- Use existing notification helper to send `order_pending_vendor` template to
  active bar numbers.
- Insert `order_events` entry (`vendor_nudge`) for audit.
- Configurable threshold via `platform_settings` table (future).

**Status:** Pending — implement once reminder policy confirmed.

### 2. Cart Reminder

- Scheduled job to find `carts` with status `open` older than X minutes.
- Send `cart_reminder_customer` template to customer WA ID.
- Respect quiet hours (reuse policy evaluation).

**Status:** Deferred — run after quiet-hours policy is finalised.

### 3. Admin Notification Retry API

- Add Next.js API route `/api/notifications/retry`.
- Verify failure status, resend via notification helper, update row.

**Status:** Pending — implement alongside admin UI actions.

## Phase 6 – QA & Runbooks

### 1. End-to-End Test Scripts

- Build Postman/Vitest scripts covering customer order flow, vendor status
  updates, and notification side-effects.
- Validate OCR pipeline by uploading sample PDF via `wa-webhook` endpoint.

**Status:** Pending.

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
