BEGIN;

DROP TRIGGER IF EXISTS order_events_sync_admin_columns ON public.order_events;
DROP FUNCTION IF EXISTS public.order_events_sync_admin_columns();

DROP POLICY IF EXISTS notifications_role_select ON public.notifications;
CREATE POLICY notifications_role_select ON public.notifications
  FOR SELECT USING (
    public.auth_role() = 'customer' AND public.auth_wa_id() = notifications.to_wa_id
  );

ALTER TABLE IF EXISTS public.notifications
    DROP CONSTRAINT IF EXISTS notifications_order_id_fkey;

ALTER TABLE IF EXISTS public.notifications
    DROP COLUMN IF EXISTS order_id,
    DROP COLUMN IF EXISTS template_name,
    DROP COLUMN IF EXISTS channel;

DROP TYPE IF EXISTS public.notification_channel;

ALTER TABLE IF EXISTS public.bar_settings
    DROP COLUMN IF EXISTS order_auto_ack,
    DROP COLUMN IF EXISTS default_prep_minutes,
    DROP COLUMN IF EXISTS service_charge_pct,
    DROP COLUMN IF EXISTS payment_instructions;

ALTER TABLE IF EXISTS public.send_logs
    DROP CONSTRAINT IF EXISTS send_logs_campaign_id_fkey,
    DROP COLUMN IF EXISTS campaign_id;

ALTER TABLE IF EXISTS public.send_queue
    DROP CONSTRAINT IF EXISTS send_queue_campaign_id_fkey,
    DROP COLUMN IF EXISTS campaign_id;

ALTER TABLE IF EXISTS public.vouchers
    DROP COLUMN IF EXISTS campaign_id;

ALTER TABLE IF EXISTS public.voice_calls
    DROP COLUMN IF EXISTS campaign_tags;

DROP TABLE IF EXISTS public.order_events CASCADE;
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP SEQUENCE IF EXISTS public.order_code_seq;

DROP TYPE IF EXISTS public.order_event_type;
DROP TYPE IF EXISTS public.order_event_actor;
DROP TYPE IF EXISTS public.order_status;

DROP TABLE IF EXISTS public.campaign_recipients CASCADE;
DROP TABLE IF EXISTS public.campaign_targets CASCADE;
DROP TABLE IF EXISTS public.campaigns CASCADE;
DROP SEQUENCE IF EXISTS public.campaign_recipients_id_seq;
DROP SEQUENCE IF EXISTS public.campaigns_legacy_id_seq;

DROP TABLE IF EXISTS public.templates CASCADE;
DROP SEQUENCE IF EXISTS public.templates_id_seq;

DROP FUNCTION IF EXISTS public.generate_order_code();

COMMIT;
