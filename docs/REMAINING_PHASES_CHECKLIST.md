# Remaining Phases Checklist

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

- Tabletop scenarios updated in `docs/RUNBOOK_TABLETOP_PLAN.md` (synthetic check
  failure, metrics drain outage) with pre-flight steps for log/metrics drains.
- `docs/OBSERVABILITY_GAPS.md` and `docs/observability.md` document
  `LOG_DRAIN_URL`, `METRICS_DRAIN_URL`, and Sentry DSN wiring.
- `docs/monitoring/runbook.md` captures Grafana imports and Kafka topic
  provisioning; `.env.example` / `docs/env/env.sample` include the new variables.
- GitHub Action `Synthetic Admin Checks` scheduled with `ADMIN_BASE_URL`,
  `ADMIN_API_TOKEN` secrets.

**Status:** Complete — runbooks, env templates, and monitoring hooks are updated for Phase 6 telemetry.

### 3. Deployment Smoke Checklist

- Deployment verification steps captured in
  `docs/deployment/phase6-smoke-checklist.md` (migrations, seeds, function
  deploys, template dry-runs, OCR job).
- Grafana/Kafka validation included alongside synthetic check reruns.

**Status:** Complete — use `docs/deployment/phase6-smoke-checklist.md` for every staging/production promote.
