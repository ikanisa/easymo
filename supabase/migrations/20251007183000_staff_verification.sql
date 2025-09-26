-- Session role extensions for vendor staff verification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'session_role'
      AND e.enumlabel = 'vendor_manager'
  ) THEN
    ALTER TYPE public.session_role ADD VALUE 'vendor_manager';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'session_role'
      AND e.enumlabel = 'vendor_staff'
  ) THEN
    ALTER TYPE public.session_role ADD VALUE 'vendor_staff';
  END IF;
END $$;

ALTER TABLE public.bar_numbers
  ADD COLUMN IF NOT EXISTS verification_code_hash text,
  ADD COLUMN IF NOT EXISTS verification_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invited_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_bar_numbers_token_lookup
  ON public.bar_numbers (number_e164, bar_id)
  WHERE verification_code_hash IS NOT NULL;
