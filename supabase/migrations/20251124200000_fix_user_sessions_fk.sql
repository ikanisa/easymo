-- Fix user_sessions foreign key to reference profiles instead of users
BEGIN;

-- First, ensure the user_id column exists (it should, based on the error)
-- If it doesn't exist in the migration but exists in DB, we might need to be careful.
-- We'll try to drop the constraint if it exists.

ALTER TABLE public.user_sessions 
DROP CONSTRAINT IF EXISTS user_sessions_user_id_fkey;

-- We also need to check if we should add the column if it's missing from our understanding
-- but the error says it exists.

-- Now add the correct constraint referencing profiles
ALTER TABLE public.user_sessions
ADD CONSTRAINT user_sessions_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

COMMIT;
