BEGIN;

-- =====================================================
-- WA_EVENTS TABLE - WhatsApp Event Logging
-- =====================================================
-- Critical table for WhatsApp webhook event tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS public.wa_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event identification
  event_type TEXT NOT NULL,
  correlation_id TEXT,
  
  -- WhatsApp identifiers
  wa_id TEXT,
  phone_number TEXT,
  message_id TEXT,
  conversation_id TEXT,
  
  -- Event data
  payload JSONB DEFAULT '{}'::jsonb,
  
  -- Metadata
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  status TEXT,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  
  -- Additional context
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for wa_events
CREATE INDEX IF NOT EXISTS idx_wa_events_event_type ON public.wa_events(event_type);
CREATE INDEX IF NOT EXISTS idx_wa_events_wa_id ON public.wa_events(wa_id);
CREATE INDEX IF NOT EXISTS idx_wa_events_message_id ON public.wa_events(message_id);
CREATE INDEX IF NOT EXISTS idx_wa_events_correlation_id ON public.wa_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_wa_events_created_at ON public.wa_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_events_phone_number ON public.wa_events(phone_number);
CREATE INDEX IF NOT EXISTS idx_wa_events_conversation_id ON public.wa_events(conversation_id);

-- Enable RLS
ALTER TABLE public.wa_events ENABLE ROW LEVEL SECURITY;

-- Service role policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'wa_events' 
    AND policyname = 'svc_rw_wa_events'
  ) THEN
    CREATE POLICY svc_rw_wa_events ON public.wa_events
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
  END IF;
END $$;

-- Grants
GRANT ALL ON TABLE public.wa_events TO postgres, anon, authenticated, service_role;

-- Comments
COMMENT ON TABLE public.wa_events IS 'WhatsApp event logging for webhook tracking and debugging';
COMMENT ON COLUMN public.wa_events.event_type IS 'Type of WhatsApp event (message, status, etc.)';
COMMENT ON COLUMN public.wa_events.correlation_id IS 'Request correlation ID for tracing';
COMMENT ON COLUMN public.wa_events.payload IS 'Full event payload from WhatsApp';

COMMIT;
