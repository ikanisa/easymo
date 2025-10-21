# Notification Worker Cron Monitoring

## Environment Flags

- `NOTIFICATION_WORKER_CRON_ENABLED=true` – enables the built-in cron schedule
  inside the `notification-worker` Edge Function. When enabled, the function
  registers a cron job with Supabase (`*/1 * * * *`).
- `ALERT_WEBHOOK_URL` – optional HTTP endpoint that will receive JSON alerts
  when the cron fails, is disabled, or is not supported by the runtime.

## Verifying

1. Deploy `notification-worker` after setting the env var.
2. Call the function manually:
   ```bash
   deno run --allow-env --allow-net tools/check_notification_worker.ts \
     https://<project-ref>.supabase.co/functions/v1/notification-worker
   ```
   The JSON response includes `cronEnabled` to confirm the flag.
3. Review structured logs (`NOTIFY_CRON_STATUS`, `NOTIFY_CRON_FAIL`) or your
   alert webhook for ongoing health signals.

## Supabase Dashboard

Ensure a cron trigger exists in the Supabase UI pointing to
`/notification-worker`. The Edge Function logs and alerts will surface if the
cron is disabled or unsupported.
