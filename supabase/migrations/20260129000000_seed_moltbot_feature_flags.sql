-- =============================================================================
-- Moltbot Feature Flags Seed
-- Workflow 12: Phase A - Backbone verification flags
-- =============================================================================

BEGIN;

-- Insert Moltbot-specific feature flags (default: disabled)
INSERT INTO feature_flags (name, enabled, rollout_percentage, description) VALUES
  ('AI_CONCIERGE_ENABLED', false, 0, 'Master switch for Moltbot AI concierge'),
  ('OCR_ENABLED', false, 0, 'Enable OCR processing for images/documents'),
  ('CALLING_ENABLED', false, 0, 'Enable WhatsApp calling functionality')
ON CONFLICT (name) DO NOTHING;

-- Create allowlist table for pilot phones
CREATE TABLE IF NOT EXISTS public.moltbot_allowlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.moltbot_allowlist ENABLE ROW LEVEL SECURITY;

-- Service role full access
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'moltbot_allowlist' 
    AND policyname = 'service_role_full_moltbot_allowlist'
  ) THEN
    CREATE POLICY "service_role_full_moltbot_allowlist"
      ON public.moltbot_allowlist
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Create updated_at trigger
DROP TRIGGER IF EXISTS trigger_moltbot_allowlist_updated_at ON public.moltbot_allowlist;
CREATE TRIGGER trigger_moltbot_allowlist_updated_at
  BEFORE UPDATE ON public.moltbot_allowlist
  FOR EACH ROW
  EXECUTE FUNCTION public.moltbot_set_updated_at();

-- Grant access
GRANT ALL ON public.moltbot_allowlist TO service_role;

-- Add comments
COMMENT ON TABLE public.moltbot_allowlist IS 'Allowlisted phone numbers for Moltbot AI pilot';

COMMIT;
