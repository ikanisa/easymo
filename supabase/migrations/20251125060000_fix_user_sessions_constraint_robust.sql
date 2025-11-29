-- Transaction wrapper for production safety
BEGIN;

-- 1. Clean up duplicate sessions first (keep the most recently updated one)
DELETE FROM public.user_sessions a USING (
  SELECT min(ctid) as ctid, phone_number
  FROM public.user_sessions 
  GROUP BY phone_number HAVING COUNT(*) > 1
) b
WHERE a.phone_number = b.phone_number 
AND a.ctid <> b.ctid;

-- 2. Drop the constraint if it exists (to be safe and ensure we can re-add it correctly)
ALTER TABLE public.user_sessions DROP CONSTRAINT IF EXISTS user_sessions_phone_number_key;

-- 3. Add the unique constraint explicitly
ALTER TABLE public.user_sessions 
ADD CONSTRAINT user_sessions_phone_number_key UNIQUE (phone_number);

-- 4. Verify the index exists (implicitly created by UNIQUE constraint, but good to be sure)
-- This is just a comment, the above command does it.

COMMIT;
