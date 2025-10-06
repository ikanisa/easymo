# Observability Gaps

This document tracks missing telemetry and follow-up work introduced by the new
reminder jobs and notification retry API.

## Reminder Workers

- **Metric:** Queue depth and processed count for `order-pending-reminder` and
  `cart-reminder` functions. Currently only structured logs exist.
  - *Action:* Expose `summary` counters via Prometheus-compatible endpoint or
    push to Grafana using Supabase log drain.
- **Alert:** `CART_REMINDER_ERROR` is emitted but not wired to PagerDuty. Ensure
  webhook routing differentiates partial vs total failures (`PARTIAL`,
  `FAILURE`).
- **Run Status Dashboard:** No single pane showing last successful run,
  processed count, or skipped reason. Add panel using `logStructuredEvent`
  counts.

## Notification Retry API

- **Audit Dashboard:** While audits capture `notification_retry`, there is no
  chart aggregating retry success rate. Create looker/Grafana view on
  `audit_log` filtering `notification_retry` vs `notification_retry_blocked`.
- **Latency Metric:** API timing not tracked—add `recordMetric` for duration and
  surface 95th percentile in ops dashboard.
- **UI Telemetry:** Integrate client-side tracing when retry modal opens/fails
  to correlate user actions with API calls.

## OCR Jobs

- **Processing Duration:** `ocr_jobs` table lacks explicit end time; difficult
  to chart SLA adherence. Add `completed_at` column or derive via
  `updated_at - created_at` and surface as histogram.
- **Failure Sampling:** When status becomes `error`, capture sample payload in
  structured log for debugging.

## Monitoring Follow-ups

- Add synthetic checks hitting `/api/orders`, `/api/ocr/jobs`, and
  `/api/notifications/retry` to detect auth/config regressions.
- Expand `tools/sql/data_quality_checks.sql` with reminder-specific guard
  (queued pending orders older than 30 minutes).
