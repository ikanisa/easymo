# WhatsApp Webhook Runbook

This runbook covers day‑to‑day operations for the `wa-webhook` edge function.

## 1. Least-Privilege Supabase Role

Create a dedicated PostgreSQL role with the minimal privileges required by the
webhook. Run the following SQL in the project database (adjust role name,
password, and schema prefix if you are not using `public`):

```sql
-- 1. Create the role and login key
create role wa_edge_role login password 'REPLACE_WITH_LONG_RANDOM_PASSWORD';

-- 2. Allow access to the tables the webhook reads/writes
grant usage on schema public to wa_edge_role;
grant select, insert, update on public.profiles to wa_edge_role;
grant select, insert, update, delete on public.chat_state to wa_edge_role;
grant select, insert, delete on public.wa_events to wa_edge_role;
grant select, insert, delete on public.webhook_logs to wa_edge_role;
grant select, insert, update on public.notifications to wa_edge_role;

-- 3. Allow execution of the Supabase RPCs invoked by the flows
grant execute on function public.basket_list_mine(uuid) to wa_edge_role;
grant execute on function public.basket_discover_nearby(uuid, double precision, double precision, integer) to wa_edge_role;
grant execute on function public.basket_create(uuid, text, text, boolean, bigint) to wa_edge_role;
grant execute on function public.basket_join_by_code(uuid, text, text) to wa_edge_role;
grant execute on function public.basket_detail(uuid, uuid) to wa_edge_role;
grant execute on function public.basket_generate_qr(uuid, uuid) to wa_edge_role;
grant execute on function public.basket_close(uuid, uuid) to wa_edge_role;
grant execute on function public.basket_leave(uuid, uuid) to wa_edge_role;
-- add any additional RPCs your custom flows call (e.g. marketplace, mobility).

-- 4. Lock down default privileges for new tables created in public schema
alter default privileges in schema public grant select, insert, update, delete on tables to wa_edge_role;
alter default privileges in schema public grant execute on functions to wa_edge_role;
```

After the role is created:

1. Generate a new service API key in the Supabase dashboard for
   `wa_edge_role`.
2. Set `WA_SUPABASE_SERVICE_ROLE_KEY` to that key in the hosting secret store as well
   as `.env.local` / `.env.production.local`.
3. Remove the older all‑access service key from the environment once the new
   key is deployed.

## 2. Queue Drain & Message Failures

1. **Monitor** the `notifications` table for rows stuck in `queued` /
   `failed`.
   ```sql
   select status, count(*) from public.notifications group by 1;
   ```
2. **Drain** retries manually by setting `status='queued'`,
   `next_attempt_at=now()` on failed rows once the upstream issue is resolved:
   ```sql
   update public.notifications
   set status = 'queued',
       next_attempt_at = now(),
       retry_count = greatest(retry_count, 0)
   where status = 'failed';
   ```
3. Verify that the background notifier is running by watching for the
   structured event `NOTIFY_SEND_OK` and the metric `wa_message_processed`.

## 3. Idempotency & Log Retention

Retention runs automatically after webhook requests. To confirm:

1. Check the structured logs `RETENTION_WA_EVENTS_PURGED` and
   `RETENTION_WEBHOOK_LOGS_PURGED`.
2. Inspect counts directly, if necessary:
   ```sql
   select count(*) from public.wa_events;
   select count(*) from public.webhook_logs;
   ```
   If retention lags, run the purge jobs manually:
   ```sql
   call public.wa_retention_purge(); -- optional stored procedure if you add one
   ```

## 4. Metrics & Alerting

- `wa_webhook_request_ms` – latency per webhook request.
- `wa_message_processed` / `wa_message_failed` – success versus failures inside
  `handleMessage`.
- `wa_message_invalid_sender` – count of messages dropped due to invalid
  numbers; investigate spikes (likely spam).
- Ensure `ALERT_WEBHOOK_URL` and `ALERT_WEBHOOK_TIMEOUT_MS` are set in the
  environment so critical failures (OCR, notification delivery, etc.) trigger
  downstream alerts.

## 5. Debugging Guidelines

- Leave `WA_INBOUND_LOG_SAMPLE_RATE` at `0` in production. Enable snapshots
  (`WA_INBOUND_DEBUG_SNAPSHOT=true` and `WA_INBOUND_LOG_SAMPLE_RATE=0.01`) only
  during short debugging windows and roll back afterwards.
- When debugging message flow, use the `webhook_logs` table with a short TTL
  and mask sample payloads before sharing.

## 6. Manual Cleanup

- To reset the chat state for a user:
  ```sql
  delete from public.chat_state where user_id = '<profile_id>';
  ```
- To unblock idempotency on a specific message (e.g. failed processing):
  ```sql
  delete from public.wa_events where wa_message_id = '<wa_message_id>';
  ```

Document any additional project-specific flows here as they are added (e.g.
insurance onboarding, marketplace integrations).
