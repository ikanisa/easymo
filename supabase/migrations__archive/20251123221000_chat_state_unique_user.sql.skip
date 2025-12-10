-- Ensure single chat_state row per user and clean duplicates
BEGIN;

-- Remove duplicate chat_state rows, keep the most recent per user_id
WITH ranked AS (
  SELECT ctid, user_id,
         row_number() OVER (PARTITION BY user_id ORDER BY last_updated DESC NULLS LAST, created_at DESC NULLS LAST) AS rn
  FROM public.chat_state
  WHERE user_id IS NOT NULL
)
DELETE FROM public.chat_state cs
USING ranked r
WHERE cs.ctid = r.ctid AND r.rn > 1;

-- Add a unique constraint on user_id to support ON CONFLICT upserts
DO $$ BEGIN
  ALTER TABLE public.chat_state
    ADD CONSTRAINT chat_state_user_id_unique UNIQUE (user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;

