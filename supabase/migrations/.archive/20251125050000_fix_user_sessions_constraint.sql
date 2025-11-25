-- Add unique constraint to user_sessions.phone_number to support ON CONFLICT upserts
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
