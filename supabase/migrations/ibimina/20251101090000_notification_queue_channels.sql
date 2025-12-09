-- Notification queue channel support and delivery telemetry
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'notification_channel'
  ) THEN
    CREATE TYPE public.notification_channel AS ENUM ('WHATSAPP', 'EMAIL');
  END IF;
END
$$;

ALTER TABLE public.notification_queue
  ADD COLUMN IF NOT EXISTS channel public.notification_channel NOT NULL DEFAULT 'WHATSAPP',
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retry_after TIMESTAMPTZ;

-- Ensure existing rows have a concrete channel value
UPDATE public.notification_queue
SET channel = COALESCE(channel, 'WHATSAPP'::public.notification_channel);
