-- Ensure phone_number is unique in user_sessions to support ON CONFLICT upserts
BEGIN;

-- Check if constraint exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_sessions_phone_number_key'
    ) THEN
        ALTER TABLE public.user_sessions
        ADD CONSTRAINT user_sessions_phone_number_key UNIQUE (phone_number);
    END IF;
END $$;

COMMIT;
