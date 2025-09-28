# Observability Notes

## Logging
- Inbound WhatsApp payloads stored via `logInbound` into `webhook_logs` (`endpoint = 'wa_inbound'`).
- Domain events use `logEvent(scope, payload)` with scopes `MOBILITY_MATCH`, `OCR_STATUS`, `WALLET_ADJUST`, `ADMIN_ACTION`, `MOMO_QR`.
- Insurance uploads log via `logOcrStatus`, MoMo QR via `logEvent('MOMO_QR', …)`, admin commands via `logAdminAction`.

## Metrics TODO
- Add Supabase function instrumentation for basket RPC latencies.
- Publish queue depth for `insurance_media_queue` to monitoring dashboard.

## Dashboards (Phase 4)
- **Notification Health** — Supabase log drain → Grafana dashboard tracking `notifications.status` counts (`tests/sql/claim_notifications.sql` mirrors queue behaviour).
- **Mobility Matching** — Materialized view `mv_trip_match_latency` (see `docs/refactor/phase2/test_plan.md`) feeding pickup/dropoff latency charts.
- **Data Quality** — Daily job runs `tools/sql/data_quality_checks.sql` (see below) and exports anomalies to Slack.

### Data Quality Queries
Store the following snippet as `tools/sql/data_quality_checks.sql` and schedule via Supabase cron or GitHub Actions:

```sql
SELECT 'notifications_stuck', count(*)
FROM public.notifications
WHERE status = 'queued'
  AND created_at < timezone('utc', now()) - interval '2 hours';

SELECT 'menus_without_items', count(*)
FROM public.menus m
LEFT JOIN public.items i ON i.menu_id = m.id
WHERE m.status = 'published'
GROUP BY m.id
HAVING count(i.id) = 0;
```

Feed the output into Grafana/Looker as threshold panels (CI job `db` ensures queries stay green).

## Alerts
- Admin alerts toggled with `/sub` commands should propagate to `admin_alert_prefs`; integrate with Ops channel in Phase C follow-up.
