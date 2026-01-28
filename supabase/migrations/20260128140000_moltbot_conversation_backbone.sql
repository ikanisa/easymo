-- =============================================================================
-- Moltbot Conversation Backbone + Request State Machine
-- Workflow 02: Rock-solid, auditable backbone for WhatsApp concierge
-- =============================================================================

BEGIN;

-- =============================================================================
-- SECTION 1: State Machine Enums
-- =============================================================================

-- Request lifecycle states (client-facing)
DO $$ BEGIN
  CREATE TYPE public.moltbot_request_state AS ENUM (
    'collecting_requirements',
    'ocr_processing',
    'vendor_outreach',
    'awaiting_vendor_replies',
    'shortlist_ready',
    'handed_off',
    'closed',
    'error'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Vendor outreach states (per vendor)
DO $$ BEGIN
  CREATE TYPE public.moltbot_vendor_outreach_state AS ENUM (
    'queued',
    'sent',
    'replied',
    'no_response',
    'failed',
    'excluded'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Call consent states
DO $$ BEGIN
  CREATE TYPE public.moltbot_call_consent_state AS ENUM (
    'not_requested',
    'requested',
    'granted',
    'denied',
    'expired'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- SECTION 2: Conversations Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.moltbot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Channel identification
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  client_phone TEXT NOT NULL,
  
  -- Conversation metadata
  language TEXT NOT NULL DEFAULT 'en',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ
);

-- Indexes for lookup performance
CREATE INDEX IF NOT EXISTS idx_moltbot_conversations_client_phone 
  ON public.moltbot_conversations(client_phone);
CREATE INDEX IF NOT EXISTS idx_moltbot_conversations_status 
  ON public.moltbot_conversations(status, created_at DESC);

-- =============================================================================
-- SECTION 3: Conversation Messages Table (Idempotent Ingestion)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.moltbot_conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.moltbot_conversations(id) ON DELETE CASCADE,
  
  -- Provider message ID for deduplication (UNIQUE constraint ensures idempotency)
  provider_message_id TEXT NOT NULL UNIQUE,
  
  -- Message content
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'audio', 'video', 'location', 'interactive', 'template')),
  body TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_moltbot_messages_conversation 
  ON public.moltbot_conversation_messages(conversation_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_moltbot_messages_provider_id 
  ON public.moltbot_conversation_messages(provider_message_id);

-- =============================================================================
-- SECTION 4: Marketplace Requests Table (State Machine)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.moltbot_marketplace_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.moltbot_conversations(id) ON DELETE CASCADE,
  
  -- State machine
  state public.moltbot_request_state NOT NULL DEFAULT 'collecting_requirements',
  
  -- Requirements (structured data from user + OCR)
  requirements JSONB DEFAULT '{}',
  
  -- Shortlist result (after vendor replies)
  shortlist JSONB DEFAULT '[]',
  
  -- Error tracking
  error_reason TEXT,
  fallback_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moltbot_requests_conversation 
  ON public.moltbot_marketplace_requests(conversation_id);
CREATE INDEX IF NOT EXISTS idx_moltbot_requests_state 
  ON public.moltbot_marketplace_requests(state, created_at DESC);

-- =============================================================================
-- SECTION 5: OCR Jobs Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.moltbot_ocr_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.moltbot_marketplace_requests(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.moltbot_conversation_messages(id) ON DELETE SET NULL,
  
  -- OCR processing
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  provider TEXT DEFAULT 'gemini',
  
  -- Input
  media_url TEXT NOT NULL,
  media_type TEXT,
  
  -- Output
  extracted JSONB DEFAULT '{}',
  confidence DOUBLE PRECISION,
  raw_response JSONB,
  
  -- Error tracking
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_moltbot_ocr_request 
  ON public.moltbot_ocr_jobs(request_id);
CREATE INDEX IF NOT EXISTS idx_moltbot_ocr_status 
  ON public.moltbot_ocr_jobs(status, created_at DESC);

-- =============================================================================
-- SECTION 6: Vendor Outreach Table (Linked to Requests)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.moltbot_vendor_outreach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.moltbot_marketplace_requests(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  
  -- State machine
  state public.moltbot_vendor_outreach_state NOT NULL DEFAULT 'queued',
  
  -- Outreach details
  outreach_message TEXT,
  outreach_sent_at TIMESTAMPTZ,
  
  -- Response tracking
  response_message TEXT,
  response_received_at TIMESTAMPTZ,
  response_data JSONB DEFAULT '{}',
  
  -- Attempts and errors
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- UNIQUE constraint for idempotency (one outreach per vendor per request)
  UNIQUE(request_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_moltbot_outreach_request 
  ON public.moltbot_vendor_outreach(request_id);
CREATE INDEX IF NOT EXISTS idx_moltbot_outreach_vendor 
  ON public.moltbot_vendor_outreach(vendor_id);
CREATE INDEX IF NOT EXISTS idx_moltbot_outreach_state 
  ON public.moltbot_vendor_outreach(state, created_at DESC);

-- =============================================================================
-- SECTION 7: Call Consents Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.moltbot_call_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.moltbot_conversations(id) ON DELETE CASCADE,
  
  -- Consent state
  state public.moltbot_call_consent_state NOT NULL DEFAULT 'not_requested',
  
  -- Scope (what the call is for)
  scope TEXT DEFAULT 'concierge',
  
  -- Consent tracking
  requested_at TIMESTAMPTZ,
  granted_at TIMESTAMPTZ,
  denied_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moltbot_call_consents_conversation 
  ON public.moltbot_call_consents(conversation_id);
CREATE INDEX IF NOT EXISTS idx_moltbot_call_consents_state 
  ON public.moltbot_call_consents(state);

-- =============================================================================
-- SECTION 8: Call Attempts Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.moltbot_call_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id UUID NOT NULL REFERENCES public.moltbot_call_consents(id) ON DELETE CASCADE,
  
  -- Call tracking
  provider_call_id TEXT,
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'answered', 'completed', 'failed', 'no_answer', 'busy')),
  
  -- Call details
  duration_seconds INT,
  recording_url TEXT,
  
  -- Error tracking
  error_message TEXT,
  
  -- Timestamps
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moltbot_call_attempts_consent 
  ON public.moltbot_call_attempts(consent_id);
CREATE INDEX IF NOT EXISTS idx_moltbot_call_attempts_status 
  ON public.moltbot_call_attempts(status, initiated_at DESC);

-- =============================================================================
-- SECTION 9: Updated_at Triggers
-- =============================================================================

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION public.moltbot_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables with updated_at
DO $$ 
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'moltbot_conversations',
    'moltbot_marketplace_requests',
    'moltbot_ocr_jobs',
    'moltbot_vendor_outreach',
    'moltbot_call_consents'
  ]
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trigger_set_updated_at ON public.%I;
      CREATE TRIGGER trigger_set_updated_at
        BEFORE UPDATE ON public.%I
        FOR EACH ROW
        EXECUTE FUNCTION public.moltbot_set_updated_at();
    ', t, t);
  END LOOP;
END $$;

-- =============================================================================
-- SECTION 10: RLS Policies (Service Role Only)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.moltbot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moltbot_conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moltbot_marketplace_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moltbot_ocr_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moltbot_vendor_outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moltbot_call_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moltbot_call_attempts ENABLE ROW LEVEL SECURITY;

-- Service role full access policies
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'moltbot_conversations',
    'moltbot_conversation_messages',
    'moltbot_marketplace_requests',
    'moltbot_ocr_jobs',
    'moltbot_vendor_outreach',
    'moltbot_call_consents',
    'moltbot_call_attempts'
  ]
  LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS "service_role_full_%s" ON public.%I;
      CREATE POLICY "service_role_full_%s"
        ON public.%I FOR ALL
        USING (auth.role() = ''service_role'');
    ', t, t, t, t);
  END LOOP;
END $$;

-- =============================================================================
-- SECTION 11: Grants
-- =============================================================================

GRANT ALL ON public.moltbot_conversations TO service_role;
GRANT ALL ON public.moltbot_conversation_messages TO service_role;
GRANT ALL ON public.moltbot_marketplace_requests TO service_role;
GRANT ALL ON public.moltbot_ocr_jobs TO service_role;
GRANT ALL ON public.moltbot_vendor_outreach TO service_role;
GRANT ALL ON public.moltbot_call_consents TO service_role;
GRANT ALL ON public.moltbot_call_attempts TO service_role;

COMMIT;
