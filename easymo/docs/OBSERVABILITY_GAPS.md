# Observability Gaps

This ledger records what is still missing after the Phase 6 telemetry uplift.
Edge functions now emit structured JSON to the Supabase log drain feeding
Grafana/Loki, and the `admin-health` probe plus `scripts/health-check.mjs`
provide a cheap liveness check. The items below remain outstanding.

## Reminder Workers

- **Run Status Dashboard:** We still need a Grafana panel that plots the last
  run time + processed/skipped counts for `order-pending-reminder` and
  `cart-reminder`. Data source: `order-pending-reminder.response` and
  `cart-reminder.response` structured logs now flowing through the drain.
- **PagerDuty Routing:** `ORDER_PENDING_REMINDER_ERROR` and `CART_REMINDER_*`
  alerts hit the shared webhook, but PagerDuty does not differentiate partial vs
  total failures yet. Configure routing rules based on `payload.severity`.
- **Quiet-Hours Regression Test:** Add a scheduled check that calls
  `cart-reminder` with mocked quiet-hours windows and asserts the worker logs a
  block. Prevents accidental flag drift.

## Notification Retry API

- **Audit Dashboard:** Build a Grafana/Looker tile aggregating
  `notification_retry` vs `notification_retry_blocked` events per day so ops can
  monitor policy fallout.
- **Latency Metric:** Add `logStructuredEvent("NOTIFICATION_RETRY_LATENCY", …)`
  (or Sentry span) capturing duration buckets; surface P95 in the ops board.
- **Client Telemetry:** Instrument the admin panel retry modal with
  `performance.mark` + Supabase log ingestion so we can correlate UI failures to
  API responses.

## OCR Jobs

- **Processing Duration:** `ocr_jobs` still lacks a dedicated `completed_at`
  column; dashboards must derive from `updated_at - created_at`. Add the column
  and backfill runtime to simplify SLA charts.
- **Failure Sampling:** Pipe error payloads into `ibimina-ocr.error` structured
  logs so support can download anonymised samples during incidents.

## Monitoring Follow-ups

- Add synthetic checks for `/admin-health`, `/admin-settings`, and
  `/flow-exchange` (with signed payload) using the monitoring stack so that
  auth/config regressions surface before customers complain.
- Extend `tools/sql/data_quality_checks.sql` with reminder-specific guardrails
  (e.g., pending orders older than 30 minutes, carts created during quiet hours)
  and schedule it via Supabase cron.
