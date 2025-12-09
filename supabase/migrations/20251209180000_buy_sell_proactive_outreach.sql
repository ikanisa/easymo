-- =====================================================
-- Buy & Sell AI Agent - Proactive Vendor Outreach System
-- =====================================================
-- This migration adds support for the AI agent to proactively
-- contact vendors on behalf of users and collect verified availability

BEGIN;

-- =====================================================
-- TABLE: agent_outreach_sessions
-- =====================================================
-- Tracks each proactive outreach session where the agent
-- contacts vendors on behalf of a user

CREATE TABLE IF NOT EXISTS public.agent_outreach_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_phone TEXT NOT NULL,
  agent_type TEXT NOT NULL DEFAULT 'buy_and_sell',
  request_summary TEXT NOT NULL,
  items_requested JSONB NOT NULL DEFAULT '[]',
  user_location JSONB,
  status TEXT NOT NULL DEFAULT 'gathering_info' 
    CHECK (status IN ('gathering_info', 'awaiting_user_consent', 'contacting_vendors', 
                      'collecting_responses', 'completed', 'expired', 'cancelled')),
  vendors_contacted UUID[] DEFAULT '{}',
  vendor_responses JSONB DEFAULT '[]',
  response_deadline TIMESTAMPTZ,
  final_recommendations JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_outreach_sessions_user_phone 
  ON public.agent_outreach_sessions(user_phone);
CREATE INDEX IF NOT EXISTS idx_agent_outreach_sessions_status 
  ON public.agent_outreach_sessions(status);
CREATE INDEX IF NOT EXISTS idx_agent_outreach_sessions_deadline 
  ON public.agent_outreach_sessions(response_deadline) 
  WHERE response_deadline IS NOT NULL;

ALTER TABLE public.agent_outreach_sessions ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "service_role_full_access_outreach_sessions" 
  ON public.agent_outreach_sessions 
  FOR ALL 
  USING (auth.role() = 'service_role');

-- =====================================================
-- TABLE: agent_vendor_messages
-- =====================================================
-- Tracks individual messages sent to vendors and their responses

CREATE TABLE IF NOT EXISTS public.agent_vendor_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outreach_session_id UUID REFERENCES public.agent_outreach_sessions(id) ON DELETE CASCADE,
  vendor_id UUID,
  vendor_phone TEXT NOT NULL,
  message_sent TEXT NOT NULL,
  message_sent_at TIMESTAMPTZ DEFAULT NOW(),
  response_received TEXT,
  response_received_at TIMESTAMPTZ,
  has_items BOOLEAN,
  price_quoted JSONB,
  availability_details TEXT,
  response_status TEXT DEFAULT 'pending' 
    CHECK (response_status IN ('pending', 'received', 'timeout', 'declined'))
);

CREATE INDEX IF NOT EXISTS idx_agent_vendor_messages_session 
  ON public.agent_vendor_messages(outreach_session_id);
CREATE INDEX IF NOT EXISTS idx_agent_vendor_messages_vendor_phone 
  ON public.agent_vendor_messages(vendor_phone);
CREATE INDEX IF NOT EXISTS idx_agent_vendor_messages_status 
  ON public.agent_vendor_messages(response_status);

ALTER TABLE public.agent_vendor_messages ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "service_role_full_access_vendor_messages" 
  ON public.agent_vendor_messages 
  FOR ALL 
  USING (auth.role() = 'service_role');

-- =====================================================
-- TABLE: agent_user_memory
-- =====================================================
-- Stores learned preferences and context about users

CREATE TABLE IF NOT EXISTS public.agent_user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_phone TEXT NOT NULL,
  memory_type TEXT NOT NULL CHECK (memory_type IN (
    'preference', 'past_order', 'favorite_vendor', 'location', 'medical_info', 'feedback'
  )),
  memory_key TEXT NOT NULL,
  memory_value JSONB NOT NULL,
  confidence FLOAT DEFAULT 1.0,
  source TEXT DEFAULT 'inferred',
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  use_count INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(user_phone, memory_type, memory_key)
);

CREATE INDEX IF NOT EXISTS idx_agent_user_memory_user 
  ON public.agent_user_memory(user_phone, memory_type);
CREATE INDEX IF NOT EXISTS idx_agent_user_memory_expires 
  ON public.agent_user_memory(expires_at) 
  WHERE expires_at IS NOT NULL;

ALTER TABLE public.agent_user_memory ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "service_role_full_access_user_memory" 
  ON public.agent_user_memory 
  FOR ALL 
  USING (auth.role() = 'service_role');

-- =====================================================
-- TABLE: agent_vendor_reliability
-- =====================================================
-- Tracks vendor response rates and reliability metrics

CREATE TABLE IF NOT EXISTS public.agent_vendor_reliability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID UNIQUE,
  vendor_phone TEXT UNIQUE NOT NULL,
  total_inquiries INT DEFAULT 0,
  responses_received INT DEFAULT 0,
  avg_response_time_seconds INT,
  accuracy_score FLOAT DEFAULT 0.5,
  last_inquiry_at TIMESTAMPTZ,
  last_response_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add computed column for reliability_score
ALTER TABLE public.agent_vendor_reliability 
  ADD COLUMN IF NOT EXISTS reliability_score FLOAT GENERATED ALWAYS AS (
    CASE WHEN total_inquiries = 0 THEN 0.5
    ELSE (responses_received::FLOAT / total_inquiries) * 0.6 + accuracy_score * 0.4
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_agent_vendor_reliability_vendor_id 
  ON public.agent_vendor_reliability(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_vendor_reliability_vendor_phone 
  ON public.agent_vendor_reliability(vendor_phone);
CREATE INDEX IF NOT EXISTS idx_agent_vendor_reliability_score 
  ON public.agent_vendor_reliability(reliability_score);

ALTER TABLE public.agent_vendor_reliability ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "service_role_full_access_vendor_reliability" 
  ON public.agent_vendor_reliability 
  FOR ALL 
  USING (auth.role() = 'service_role');

-- =====================================================
-- UPDATE: business table
-- =====================================================
-- Add columns to track vendor inquiry preferences

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'business') THEN
    
    -- Add accepts_agent_inquiries column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'business' 
                   AND column_name = 'accepts_agent_inquiries') THEN
      ALTER TABLE public.business 
        ADD COLUMN accepts_agent_inquiries BOOLEAN DEFAULT true;
    END IF;
    
    -- Add agent_inquiry_phone column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'business' 
                   AND column_name = 'agent_inquiry_phone') THEN
      ALTER TABLE public.business 
        ADD COLUMN agent_inquiry_phone TEXT;
    END IF;
    
    -- Add avg_response_time_minutes column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'business' 
                   AND column_name = 'avg_response_time_minutes') THEN
      ALTER TABLE public.business 
        ADD COLUMN avg_response_time_minutes INT;
    END IF;
  END IF;
  
  -- Also check businesses table (might be the actual table name)
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'businesses') THEN
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'businesses' 
                   AND column_name = 'accepts_agent_inquiries') THEN
      ALTER TABLE public.businesses 
        ADD COLUMN accepts_agent_inquiries BOOLEAN DEFAULT true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'businesses' 
                   AND column_name = 'agent_inquiry_phone') THEN
      ALTER TABLE public.businesses 
        ADD COLUMN agent_inquiry_phone TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'businesses' 
                   AND column_name = 'avg_response_time_minutes') THEN
      ALTER TABLE public.businesses 
        ADD COLUMN avg_response_time_minutes INT;
    END IF;
  END IF;
END $$;

-- =====================================================
-- TRIGGERS: Update updated_at timestamp
-- =====================================================

DO $$
BEGIN
  -- Drop existing triggers if they exist
  DROP TRIGGER IF EXISTS set_updated_at_agent_outreach_sessions 
    ON public.agent_outreach_sessions;
  DROP TRIGGER IF EXISTS set_updated_at_agent_user_memory 
    ON public.agent_user_memory;
  DROP TRIGGER IF EXISTS set_updated_at_agent_vendor_reliability 
    ON public.agent_vendor_reliability;
  
  -- Create triggers using existing update_updated_at_column function
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE TRIGGER set_updated_at_agent_outreach_sessions
      BEFORE UPDATE ON public.agent_outreach_sessions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
      
    CREATE TRIGGER set_updated_at_agent_user_memory
      BEFORE UPDATE ON public.agent_user_memory
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
      
    CREATE TRIGGER set_updated_at_agent_vendor_reliability
      BEFORE UPDATE ON public.agent_vendor_reliability
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to update vendor reliability after receiving a response
CREATE OR REPLACE FUNCTION public.update_vendor_reliability(
  p_vendor_phone TEXT,
  p_vendor_id UUID,
  p_has_response BOOLEAN,
  p_response_time_seconds INT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.agent_vendor_reliability (
    vendor_phone,
    vendor_id,
    total_inquiries,
    responses_received,
    avg_response_time_seconds,
    last_inquiry_at,
    last_response_at
  )
  VALUES (
    p_vendor_phone,
    p_vendor_id,
    1,
    CASE WHEN p_has_response THEN 1 ELSE 0 END,
    CASE WHEN p_has_response THEN p_response_time_seconds ELSE NULL END,
    NOW(),
    CASE WHEN p_has_response THEN NOW() ELSE NULL END
  )
  ON CONFLICT (vendor_phone) DO UPDATE SET
    total_inquiries = agent_vendor_reliability.total_inquiries + 1,
    responses_received = agent_vendor_reliability.responses_received + 
      CASE WHEN p_has_response THEN 1 ELSE 0 END,
    avg_response_time_seconds = 
      CASE WHEN p_has_response THEN
        COALESCE(
          (agent_vendor_reliability.avg_response_time_seconds * 
           agent_vendor_reliability.responses_received + p_response_time_seconds) / 
          (agent_vendor_reliability.responses_received + 1),
          p_response_time_seconds
        )
      ELSE agent_vendor_reliability.avg_response_time_seconds
      END,
    last_inquiry_at = NOW(),
    last_response_at = CASE WHEN p_has_response THEN NOW() 
                       ELSE agent_vendor_reliability.last_response_at END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record user memory
CREATE OR REPLACE FUNCTION public.upsert_agent_user_memory(
  p_user_phone TEXT,
  p_memory_type TEXT,
  p_memory_key TEXT,
  p_memory_value JSONB,
  p_confidence FLOAT DEFAULT 1.0,
  p_source TEXT DEFAULT 'inferred',
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_memory_id UUID;
BEGIN
  INSERT INTO public.agent_user_memory (
    user_phone,
    memory_type,
    memory_key,
    memory_value,
    confidence,
    source,
    expires_at,
    last_used_at,
    use_count
  )
  VALUES (
    p_user_phone,
    p_memory_type,
    p_memory_key,
    p_memory_value,
    p_confidence,
    p_source,
    p_expires_at,
    NOW(),
    1
  )
  ON CONFLICT (user_phone, memory_type, memory_key) DO UPDATE SET
    memory_value = p_memory_value,
    confidence = p_confidence,
    source = p_source,
    expires_at = COALESCE(p_expires_at, agent_user_memory.expires_at),
    last_used_at = NOW(),
    use_count = agent_user_memory.use_count + 1,
    updated_at = NOW()
  RETURNING id INTO v_memory_id;
  
  RETURN v_memory_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active user memories
CREATE OR REPLACE FUNCTION public.get_user_memories(
  p_user_phone TEXT,
  p_memory_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  memory_type TEXT,
  memory_key TEXT,
  memory_value JSONB,
  confidence FLOAT,
  use_count INT,
  last_used_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.memory_type,
    m.memory_key,
    m.memory_value,
    m.confidence,
    m.use_count,
    m.last_used_at
  FROM public.agent_user_memory m
  WHERE m.user_phone = p_user_phone
    AND (p_memory_types IS NULL OR m.memory_type = ANY(p_memory_types))
    AND (m.expires_at IS NULL OR m.expires_at > NOW())
  ORDER BY m.use_count DESC, m.last_used_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
