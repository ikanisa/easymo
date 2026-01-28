# Phase 7 – Web & WhatsApp Notifications

This doc records the delivery guarantees for Workflow WEB-1, Step 7 (notifications).

## Goals
- Keep Moltbot in control: it queues notifications via `web_notifications` and this service dispatches them without new UI verbs.
- In-app visibility: every post's `notifications panel` subscribes to `web_notifications` and shows `status`, `sent time`, and errors.
- Multi-channel delivery: the dispatcher targets `web`, `email`, and `whatsapp`. `email` is still a stub; `whatsapp` reuses the existing WhatsApp send endpoint.

## Components
1. **Supabase table**: `web_notifications` gained `delivered_at`, `error_message`, and an index on `status`. Writes still occur only via service role.
2. **Dispatcher**: `src/web/notificationDispatcher.ts` (exported to `tools/web/dispatchNotifications.ts`) pulls queued rows, tries to send WhatsApp channels through `WHATSAPP_SEND_ENDPOINT`, then marks `status` as `sent`/`failed`, records `delivered_at`, and tracks exceptions via `audit_events` (`web_notification.dispatch`).
3. **PWA panel**: The `NotificationsList` component now surfaces delivery info. `App.tsx` subscribes to Supabase realtime on `web_notifications`, `match_suggestions`, and `external_feed_items`, so the notification inbox updates instantly without manual refreshes.

## WhatsApp delivery rules
- WhatsApp notifications require `payload.message` plus a phone (`payload.whatsapp_number`, `payload.phone`, or `payload.target_phone`). The dispatcher refuses to send if that info is missing and logs the failure.
- The dispatcher posts to `WHATSAPP_SEND_ENDPOINT` (should point to `wa-webhook-core` or an approved WhatsApp bridge) with a text message payload. Circuit breaker / compliance logic stays inside the existing WhatsApp endpoint.
- Business-only requirement: we rely on the same WhatsApp endpoint the rest of the stack uses, so any pre-checks (opt-in, templates, privacy) continue to apply.

## In-app experience
- The UI banner explains if the feature flag is off.
- The notifications panel shows the channel, target, queue status, send time, and any failure messages so users can understand whether Moltbot succeeded in notifying the top 10.
- Real-time Supabase channels ensure newly queued rows, status changes, and new matches appear instantly.

## Operational notes
- Run `pnpm tsx ./src/tools/web/dispatchNotifications.ts` (or wire into a cron/scheduled worker) every ~30 seconds to keep the queue flowing.
- Enable `WHATSAPP_SEND_ENDPOINT` + valid Meta credentials in production; skip dispatch in development by leaving it unset (the dispatcher will fail fast and log the reason).
- When the queue errors, the `error_message` column records the failure so the admin panel and Moltbot audit logs can triage.
