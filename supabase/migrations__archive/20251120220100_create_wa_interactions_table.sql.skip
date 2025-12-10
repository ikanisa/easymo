BEGIN;

-- =====================================================
-- CREATE WA_INTERACTIONS TABLE FOR HEALTH CHECKS
-- =====================================================
-- This table is used by wa-webhook health checks
-- to verify database connectivity
-- =====================================================

CREATE TABLE IF NOT EXISTS public.wa_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- WhatsApp identifiers
  wa_id TEXT,
  phone_number TEXT,
  message_id TEXT,
  conversation_id TEXT,
  
  -- Interaction details
  interaction_type TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for wa_interactions
CREATE INDEX IF NOT EXISTS idx_wa_interactions_wa_id ON public.wa_interactions(wa_id);
CREATE INDEX IF NOT EXISTS idx_wa_interactions_message_id ON public.wa_interactions(message_id);
CREATE INDEX IF NOT EXISTS idx_wa_interactions_created_at ON public.wa_interactions(created_at DESC);

-- Enable RLS
ALTER TABLE public.wa_interactions ENABLE ROW LEVEL SECURITY;

-- Service role policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'wa_interactions' 
    AND policyname = 'svc_rw_wa_interactions'
  ) THEN
    CREATE POLICY svc_rw_wa_interactions ON public.wa_interactions
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
  END IF;
END $$;

-- Grants
GRANT ALL ON TABLE public.wa_interactions TO postgres, anon, authenticated, service_role;

-- Comments
COMMENT ON TABLE public.wa_interactions IS 'WhatsApp user interactions for health checks and tracking';

COMMIT;
