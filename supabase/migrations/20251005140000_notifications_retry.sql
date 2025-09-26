ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;

