# Rolling Deploy Smoke — Reminders & Notifications

Use this checklist during staging/prod promotion for the reminder workers and
notification retry API.

## Pre-Deployment

- Ensure latest migrations applied (`notifications` triggers, `order_events`
  sync, `settings` quiet hours).
- Confirm environment variables configured:
  - `ORDER_PENDING_REMINDER_MINUTES`, `ORDER_PENDING_REMINDER_CRON_ENABLED`
  - `CART_REMINDER_MINUTES`, `CART_REMINDER_CRON_ENABLED`
  - `ALERT_WEBHOOK_URL`
  - `NEXT_PUBLIC_WHATSAPP_SEND_ENDPOINT` (for retry UI feedback)

## Staging Smoke

1. **Vendor Pending Reminder**
   - Seed a pending order > threshold.
   - Invoke `supabase/functions/order-pending-reminder` HTTP endpoint.
   - Verify `notifications` row queued and `order_events` contains
     `vendor_nudge`.

2. **Cart Reminder**
   - Seed open cart > threshold with WhatsApp profile.
   - Hit `supabase/functions/cart-reminder` HTTP endpoint.
   - Confirm notification queued; ensure quiet-hours window skip works by
     adjusting `CART_REMINDER_MINUTES`.

3. **Retry API**
   - Mark notification `status='failed'`.
   - Call `/api/notifications/retry` with ID.
   - Check response `queued`, UI toast, and audit entry.

4. **Alert Hook**
   - Temporarily revoke bar numbers or set invalid MSISDN to trigger worker
     failure; confirm webhook receives alert.

## Production Rollout

- Deploy Supabase functions (`order-pending-reminder`, `cart-reminder`,
  `notification-worker` if updated).
- Enable cron flags and monitor for first success run.
- Run `/api/notifications/retry` with a known safe notification to validate
  credentials.
- Monitor Grafana panels for queue depth/backoff metrics.

## Rollback

- Disable cron env flags to stop workers.
- Revert admin app deployment or feature toggle if retry API misbehaves.
- Restore previous env backups (quiet hours, thresholds) if adjustments fail.
