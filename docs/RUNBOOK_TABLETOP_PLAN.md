# Runbook Tabletop Plan

This tabletop exercise prepares the ops team to respond to failures across the
new reminder workers and notification retry flow.

## Scenarios

### 1. Vendor Pending Reminder Failing

- **Trigger:** `ORDER_PENDING_REMINDER_ERROR` alert or missing `vendor_nudge`
  events for >30 minutes.
- **Detection:**
  - Grafana notification queue panel spikes in `queued` count without matching
    `sent` increase.
  - Edge function logs show repeated `order-pending-reminder.error` entries.
- **Response:**
  1. Hit `supabase/functions/order-pending-reminder` HTTP endpoint to rerun the
     batch manually.
  2. Check `/api/orders/events` for fresh `vendor_nudge` entries.
  3. Review alert payload; if vendor contact data missing, update
     `bar_numbers`/`staff_number` in Supabase.
  4. Capture timeline in incident sheet; open follow-up to adjust thresholds via
     `ORDER_PENDING_REMINDER_MINUTES` env.

### 2. Cart Reminder Quiet-Hour Violation

- **Trigger:** Ops reports customers receiving nudges during quiet hours.
- **Detection:**
  - `CART_REMINDER_QUIET_HOURS` log entries absent or disabled.
  - `cart_reminder_customer` notifications timestamped within quiet window.
- **Response:**
  1. Verify `settings` table row `quiet_hours.rw`; correct start/end values.
  2. Inspect `supabase/functions/cart-reminder` logs; confirm
     `ORDER_PENDING_REMINDER_CRON_ENABLED` alignment.
  3. Pause cron (`CART_REMINDER_CRON_ENABLED=false`) if immediate stop is
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
     and rerun API call with single ID to isolate.
  4. Capture log snippet + API payload for follow-up.

## Pre-Exercise Checklist

- Ensure alert webhook configured (`ALERT_WEBHOOK_URL`).
- Confirm Supabase cron status for pending/cart reminders in dashboard.
- Keep mock data fixtures (`tests/e2e/admin-flows.test.ts`) in sync with prod
  schema to reuse during tabletop simulations.
- Verify `INSURANCE_OCR_METRICS_WEBHOOK_URL` is routed to observability sink so
  queue depth signals surface during exercises.

## Post-Exercise Actions

- Update incident template with any new checklists discovered.
- File tickets for missing metrics (see `docs/OBSERVABILITY_GAPS.md`).
- Add UI regression tests if manual steps highlighted gaps.
