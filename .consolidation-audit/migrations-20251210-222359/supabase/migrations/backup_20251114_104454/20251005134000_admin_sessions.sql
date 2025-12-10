-- Admin session and PIN scaffolding

BEGIN;
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  wa_id text PRIMARY KEY,
  pin_ok_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_admin_sessions_updated'
  ) THEN
    CREATE TRIGGER trg_admin_sessions_updated
      BEFORE UPDATE ON public.admin_sessions
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

ALTER TABLE public.app_config
  ADD COLUMN IF NOT EXISTS admin_pin_hash text;

COMMIT;
