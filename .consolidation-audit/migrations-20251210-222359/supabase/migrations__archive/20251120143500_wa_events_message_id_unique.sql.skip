BEGIN;

-- Ensure wa_events.message_id is unique to support ON CONFLICT upserts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.wa_events'::regclass
      AND contype = 'u'
      AND conname = 'wa_events_message_id_key'
  ) THEN
    ALTER TABLE public.wa_events
      ADD CONSTRAINT wa_events_message_id_key UNIQUE (message_id);
  END IF;
END $$;

COMMIT;

