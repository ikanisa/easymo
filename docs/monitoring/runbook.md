# Monitoring & Operations Runbook

This runbook aggregates the Phase 4 readiness items: log inspection, cron verification, notifications, and rotating admin credentials.

## 1. Vercel Runtime Logs

- **Admin app**: `vercel logs easymo-admin --scope ikanisa`
- **Frontend app**: `vercel logs easymo --scope ikanisa`
  - The CLI requires an active deployment; if the default alias fails, use the deployment URL returned by `vercel projects ls`.
  - Logs include Supabase function invocations; errors bubble up as 4xx/5xx.

## 2. Supabase Edge Function Smoke Tests

Use the provided script:

```bash
SUPABASE_URL="https://lhbowpbcpwoiparwnwgt.supabase.co" \
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

Ensure the schedule matches the environment variables in Supabase/Vercel (`CART_REMINDER_CRON`, `ORDER_PENDING_REMINDER_CRON`, etc.).

## 4. Admin Token Rollovers

Secrets set in Supabase (now aligned):

```
EASYMO_ADMIN_TOKEN
ADMIN_TOKEN
```

Update Vercel env vars and redeploy after rotating the token. All admin edge functions rely on this value for `x-admin-token` / `x-api-key` headers.

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
- Vercel offers log drains and analytics; enable if production monitoring is required.

