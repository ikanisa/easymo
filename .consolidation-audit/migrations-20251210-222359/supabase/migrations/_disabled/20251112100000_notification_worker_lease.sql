-- Ensure notification worker uses a cross-instance lease backed by Postgres state
BEGIN;

CREATE TABLE IF NOT EXISTS public.notification_worker_state (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  worker_id uuid,
  locked_at timestamptz,
  expires_at timestamptz
);

INSERT INTO public.notification_worker_state (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.claim_notification_worker(
  _worker uuid,
  _ttl_seconds integer DEFAULT 300
) RETURNS TABLE (granted boolean, holder uuid, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  _now timestamptz := timezone('utc', now());
  _ttl integer := GREATEST(COALESCE(_ttl_seconds, 300), 60);
BEGIN
  UPDATE public.notification_worker_state s
     SET worker_id = _worker,
         locked_at = _now,
         expires_at = _now + make_interval(secs => _ttl)
   WHERE s.id = 1
     AND (s.worker_id = _worker OR s.expires_at IS NULL OR s.expires_at <= _now)
  RETURNING TRUE, s.worker_id, s.expires_at
    INTO claim_notification_worker;

  IF FOUND THEN
    RETURN;
  END IF;

  SELECT FALSE, s.worker_id, s.expires_at
    INTO claim_notification_worker
    FROM public.notification_worker_state s
    WHERE s.id = 1;

  RETURN;
END;
$$;

COMMENT ON FUNCTION public.claim_notification_worker(uuid, integer) IS
  'Acquire or renew the notification worker lease for up to _ttl_seconds.';

CREATE OR REPLACE FUNCTION public.release_notification_worker(
  _worker uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  UPDATE public.notification_worker_state
     SET worker_id = NULL,
         locked_at = NULL,
         expires_at = NULL
   WHERE id = 1 AND worker_id = _worker;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.release_notification_worker(uuid) IS
  'Release the notification worker lease when the owning instance completes.';

COMMIT;
