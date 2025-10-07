# Runbook Tabletop Plan

This tabletop exercise prepares the ops team to respond to failures across the
new reminder workers and notification retry flow.

## Scenarios & Signal Playbook

### 1. Vendor Pending Reminder Failing

- **Trigger:** `ORDER_PENDING_REMINDER_ERROR` alert or missing `vendor_nudge`
  events for >30 minutes.
- **Detection:**
  - Supabase log drain feed (Grafana/Loki) surfaces repeated
    `order-pending-reminder.error` entries.
  - `notification-worker` metrics panel shows `queued` count rising without
    matching `sent` increase.
- **Response:**
  1. Hit `supabase/functions/order-pending-reminder` HTTP endpoint to rerun the
     batch manually.
  2. Check `/api/orders/events` for fresh `vendor_nudge` entries.
  3. Review alert payload and trace ID from log drain; if vendor contact data
     missing, update
     `bar_numbers`/`staff_number` in Supabase.
  4. Capture timeline in incident sheet; open follow-up to adjust thresholds via
     `ORDER_PENDING_REMINDER_MINUTES` env.

### 2. Cart Reminder Quiet-Hour Violation

- **Trigger:** Ops reports customers receiving nudges during quiet hours.
- **Detection:**
  - `CART_REMINDER_QUIET_HOURS` structured logs absent in the log drain.
  - `cart_reminder_customer` notifications timestamped within quiet window.
- **Response:**
  1. Verify `settings` table row `quiet_hours.rw`; correct start/end values.
  2. Inspect `supabase/functions/cart-reminder` logs; confirm
     `ORDER_PENDING_REMINDER_CRON_ENABLED` alignment.
  3. Pause cron (`CART_REMINDER_CRON_ENABLED=false`) via Supabase Dashboard if immediate stop is
     needed; re-enable after fix.
  4. Document incident and schedule a quiet-hours regression test run.

### 3. Notification Retry Regression

- **Trigger:** `/api/notifications/retry` returning degraded status or empty
  `queued` array unexpectedly.
- **Detection:**
  - Admin UI toast shows policy block for expected retriable notifications.
  - Audit log lacks `notification_retry` entries for attempted retries.
- **Response:**
  1. Review API response payload (`blocked` reasons).
  2. If policy causes block, confirm quiet hours / opt-out list entries are
     correct; adjust if false positive.
  3. For Supabase errors, inspect `notifications_retry_update_failed` log lines
     in the log drain and rerun API call with single ID to isolate.
  4. Capture log snippet + API payload for follow-up.

### 4. Edge Function Deploy Drift

- **Trigger:** Admin panel or simulator begins returning `404`/`401` responses
  after a deployment.
- **Detection:**
  - `supabase functions list --project-ref <ref>` shows stale `UPDATED_AT`
    timestamps for `flow-exchange`, `admin-*`, or `ocr-processor`.
  - `scripts/health-check.mjs` fails against
    `https://<project>.functions.supabase.co/admin-health`.
- **Response:**
  1. Re-run `bash easymo/tools/deploy_supabase_functions.sh --no-verify-jwt`.
  2. Verify `scripts/health-check.mjs` passes with `VITE_ADMIN_TOKEN` set.
  3. Spot-check critical endpoints (`admin-settings`, `flow-exchange`) with a
     200 response before clearing the incident.

## Pre-Exercise Checklist

- Ensure alert webhook configured (`ALERT_WEBHOOK_URL`).
- Confirm Supabase cron status for pending/cart reminders in dashboard.
- Export `SUPABASE_ACCESS_TOKEN` and run
  `bash easymo/tools/deploy_supabase_functions.sh --no-verify-jwt --dry-run`
  to ensure the runner can reach Supabase.
- Validate the `admin-health` probe locally with
  `npm run health -- --url https://<project>.functions.supabase.co/admin-health`
  and a valid `VITE_ADMIN_TOKEN`.
- Keep mock data fixtures (`tests/e2e/admin-flows.test.ts`) in sync with prod
  schema to reuse during tabletop simulations.

## Post-Exercise Actions

- Update incident template with any new checklists discovered.
- File tickets for missing metrics (see `docs/OBSERVABILITY_GAPS.md`).
- Add UI regression tests if manual steps highlighted gaps.
- Capture the Supabase function versions post-incident (`functions list` output)
  for historical tracking.
