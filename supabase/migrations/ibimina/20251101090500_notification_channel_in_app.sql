-- Extend notification_channel enum with IN_APP and require explicit values on notification_queue
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'notification_channel'
      AND pg_type.typnamespace = 'public'::regnamespace
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum
      WHERE enumtypid = 'public.notification_channel'::regtype
        AND enumlabel = 'IN_APP'
    ) THEN
      ALTER TYPE public.notification_channel ADD VALUE 'IN_APP';
    END IF;
  END IF;
END;
$$;

ALTER TABLE public.notification_queue
  ALTER COLUMN channel DROP DEFAULT;
