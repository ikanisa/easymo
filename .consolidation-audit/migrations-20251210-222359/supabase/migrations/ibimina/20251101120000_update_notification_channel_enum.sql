-- Update notification_channel enum and enforce explicit channel selection
ALTER TYPE public.notification_channel
  ADD VALUE IF NOT EXISTS 'IN_APP';

-- Align existing queue entries with the new in-app channel option
UPDATE public.notification_queue
SET channel = 'IN_APP'::public.notification_channel
WHERE channel = 'WHATSAPP'::public.notification_channel;

-- Require callers to provide a channel explicitly going forward
ALTER TABLE public.notification_queue
  ALTER COLUMN channel DROP DEFAULT;
