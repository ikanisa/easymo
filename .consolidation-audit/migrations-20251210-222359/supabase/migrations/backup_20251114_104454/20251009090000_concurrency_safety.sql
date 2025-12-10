-- Strengthen notification worker concurrency controls
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
      AND column_name = 'locked_at'
  ) THEN
    ALTER TABLE public.notifications
      ADD COLUMN locked_at timestamptz;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.claim_notifications(_limit integer DEFAULT 10)
RETURNS SETOF public.notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  _now timestamptz := timezone('utc', now());
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT id
    FROM public.notifications
    WHERE status = 'queued'
      AND (locked_at IS NULL OR locked_at < _now - interval '15 minutes')
      AND (next_attempt_at IS NULL OR next_attempt_at <= _now)
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT COALESCE(_limit, 10)
  )
  UPDATE public.notifications n
     SET locked_at = _now,
         retry_count = COALESCE(n.retry_count, 0),
         next_attempt_at = NULL
  FROM candidate
  WHERE n.id = candidate.id
  RETURNING n.*;
END;
$$;

COMMENT ON FUNCTION public.claim_notifications(integer) IS
  'Atomically locks and returns up to _limit queued notifications for delivery.';
COMMIT;
