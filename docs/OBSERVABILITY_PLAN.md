# Observability & Alerting Plan — Baskets Module

> **Note**: For comprehensive observability guidelines and utilities applicable to all modules, see [GROUND_RULES.md](GROUND_RULES.md).
>
> **Key Utilities**:
> - Structured logging: `logStructuredEvent()` in `supabase/functions/_shared/observability.ts`
> - Metrics: `recordMetric()`, `recordDurationMetric()`, `recordGauge()`
> - Request tracking: `logRequest()`, `logResponse()` with correlation IDs
> - PII masking: `maskPII()`

## Targets
- **Allocations**: throughput, duplicates, unmatched backlog, allocator failures.
- **Loans**: committee queue size, endorsement throughput, LTV violations, SACCO decision latency.
- **Reminders**: queued/sent counts, blocked reason distribution, cron heartbeat, throttle hits.
- **Notifications**: delivery time, retry depth, WhatsApp errors, template mismatches.

## Dashboards (Grafana / Supabase Insights)
1. **Allocator Health**
   - `momo_sms_inbox` backlog (`processed_at IS NULL`).
   - `momo_unmatched` open count + reasons.
   - Allocations/minute: `contributions_ledger` (source `sms`).
   - Errors: `momo_allocator.*` log counts.
2. **Loan Funnel**
   - Count by `sacco_loans.status`.
   - Committee pending votes per role.
   - Time from `created_at` → `committee_completed_at` → `sacco_decision_at`.
   - LTV ratio histogram vs `saccos.ltv_min_ratio`.
3. **Reminder Engine**
   - `baskets_reminders` status distribution.
   - Blocked reasons (quiet_hours, throttled, template_missing).
   - Cron heartbeat (last `REMINDER_WORKER_DONE`).
   - Notifications pushed (`notifications` table filter type `baskets_reminder`).
4. **KYC/OCR**
   - Documents by status, confidence distribution.
   - Failures from `ibimina_ocr.*` logs.
5. **Notification Worker**
   - Queue depth (`notifications` status queued/sending).
   - Retry/backoff metrics (`retry_count`, `next_attempt_at`).
   - WhatsApp API error rates.

## Alerts
- **Allocator**
  - Inbox backlog > 25 for 10 minutes.
  - Unmatched open > 10 or any row older than 60 minutes.
  - `momo_allocator` error log bursts (>5 in 5 min).
- **Loans**
  - `BKT_LTV_EXCEEDED` trigger more than twice per hour.
  - Committee pending > 5 loans for same SACCO.
  - Loan pending > 24h without committee completion.
- **Reminders**
  - Worker success count = 0 for >15 minutes while reminders scheduled.
  - >30% of reminders blocked for quiet_hours outside configured window.
  - Throttle blocks sustained for >30 minutes.
- **Notifications**
  - WhatsApp API 5xx rate > 5%.
  - `notification-worker` cron disabled or heartbeat gap > 5 minutes.
- **OCR/KYC**
  - OCR failures (HTTP 5xx) > 3 consecutive.
  - Pending KYC > threshold for >48 hours.

## Runbooks
- Link alerts to respective runbooks: allocator (`docs/ALLOCATION_RUNBOOK.md`), loans (new addendum), reminders (add section describing worker toggles), notifications.
- Include playbooks for enabling/disabling cron envs (`BASKETS_REMINDER_CRON_ENABLED`, `NOTIFICATION_WORKER_CRON_ENABLED`).

## Telemetry Implementation Notes
- Structured logs already emitted (e.g., `REMINDER_WORKER_*`, `sacco_loan_update_*`, `ibimina_ocr.*`).
- Use dashboard panels to surface latest log entries for quick triage.
- Ensure Supabase Log Drains/Datadog ingestion enabled before go-live.
- Persist metrics via SQL views for dashboards (`SELECT COUNT(*) FROM baskets_reminders WHERE status='blocked' ...`).
