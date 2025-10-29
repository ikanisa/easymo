# Monitoring & Operations Runbook

This runbook aggregates the Phase 4 readiness items: log inspection, cron verification, notifications, and rotating admin credentials.

## 1. Runtime Logs

- **Admin app**: `kubectl logs deployment/admin-app -n easymo` (or use the Grafana Loki dashboard).
- **Frontend app**: `kubectl logs deployment/frontend-app -n easymo`.
  - The CLI requires the appropriate kubeconfig/permissions; otherwise, use the observability portal described in `ops/observability/README.md`.
  - Logs include Supabase function invocations; errors bubble up as 4xx/5xx.

## 2. Supabase Edge Function Smoke Tests

Use the provided script:

```bash
SUPABASE_URL="https://vacltfdslodqybxojytc.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service-role>" \
EASYMO_ADMIN_TOKEN="<admin-token>" \
bash scripts/test-functions.sh
```

Expected HTTP 200 responses for `admin-health`, `admin-settings`, `admin-stats`, `admin-users`, `admin-subscriptions`, `admin-trips`, and `campaign-dispatch?action=status`.

## 3. Cron Verification

There is no `supabase cron list` command yet. Verify schedules in **Supabase Dashboard → Project → Scheduled jobs** for:

- `cart-reminder`
- `order-pending-reminder`
- `baskets-reminder`
- `notification-worker`

Ensure the schedule matches the environment variables in Supabase and the release pipeline (`CART_REMINDER_CRON`, `ORDER_PENDING_REMINDER_CRON`, etc.).

## 4. Admin Token Rollovers

Secrets set in Supabase (now aligned):

```
EASYMO_ADMIN_TOKEN
ADMIN_TOKEN
```

Update local environment variables and restart the application after rotating the token. All admin edge functions rely on this value for `x-admin-token` / `x-api-key` headers.

## 5. Data Checks

Sample counts after `pnpm seed:remote`:

| Table | Count |
|-------|------:|
| bars | 2 |
| petrol_stations | 1 |
| vouchers | 1 |
| campaigns | 2 |
| campaign_recipients | 1 |
| notifications | 1 |
| orders | 1 |
| profiles | 6 |
| trips | 3 |
| subscriptions | 2 |
| driver_presence | 1 |

Use these as a baseline when validating dashboards.

## 6. Alerts

- Set `ALERT_WEBHOOK_URL` if you want Supabase functions to POST incident notifications.
- Configure `LOG_DRAIN_URL` and `METRICS_DRAIN_URL` if you want to forward logs and metrics to external monitoring services (optional).

## 7. Grafana Dashboards

- Import the Phase 4 dashboards:
  - `dashboards/phase4/voice_bridge.json`
  - `dashboards/phase4/messaging_overview.json`
- Assign the Prometheus datasource used by the Agent-Core stack. Panels expect metrics from voice-bridge, sip-ingress, broker-orchestrator, and wallet/ranking services.
- Verify `voice.contact.events` and `broker.outbound` topic lag panels remain below alerting thresholds during smoke tests.

## 8. Kafka Topics

- Apply the manifest in `infrastructure/kafka/topics.yaml` via the provided helper script or your Kafka admin tooling.
- Required topics:
  - `voice.contact.events`, `voice.media.events`, `voice.sip.events`
  - `whatsapp.inbound`, `whatsapp.outbound`
  - `broker.outbound`, `broker.retry`
- Review retention policies (`cleanup.policy`, `retention.ms`) before production rollout. Update dashboards if you adjust partition counts.

## 9. GitHub Synthetic Checks Secrets

- Populate the following repository secrets so `.github/workflows/synthetic-checks.yml` can exercise staging/prod endpoints:
  - `ADMIN_BASE_URL`
  - `ADMIN_API_TOKEN`
  - `SUPABASE_API_BASE`
  - `EASYMO_ADMIN_TOKEN`
- The workflow skips steps when these are unset or malformed (non-HTTP URL). After updating secrets, re-run “Synthetic Checks” to confirm the probes succeed.
