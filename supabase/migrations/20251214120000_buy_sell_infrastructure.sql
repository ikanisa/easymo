BEGIN;

-- ============================================================================
-- BUY & SELL INFRASTRUCTURE MIGRATION
-- Generated: 2025-12-14T12:00:00Z
-- Purpose: Create tables for Buy & Sell agent with vendor outreach capabilities
-- ============================================================================

-- ============================================================================
-- 1. VENDORS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  lat NUMERIC,
  lng NUMERIC,
  is_opted_in BOOLEAN DEFAULT false,
  is_onboarded BOOLEAN DEFAULT false,
  average_rating NUMERIC DEFAULT 0,
  positive_response_count INTEGER DEFAULT 0,
  tags TEXT[],
  country_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vendors_phone ON public.vendors(phone);
CREATE INDEX IF NOT EXISTS idx_vendors_country_code ON public.vendors(country_code);
CREATE INDEX IF NOT EXISTS idx_vendors_opted_in ON public.vendors(is_opted_in) WHERE is_opted_in = true;
CREATE INDEX IF NOT EXISTS idx_vendors_location ON public.vendors(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Enable RLS
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- Service role policy
CREATE POLICY "service_role_manage_vendors" ON public.vendors
  FOR ALL USING (auth.role() = 'service_role');

-- Read policy for authenticated users
CREATE POLICY "authenticated_read_vendors" ON public.vendors
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================================
-- 2. WHATSAPP BROADCAST REQUESTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_broadcast_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT UNIQUE NOT NULL,
  user_location_label TEXT,
  need_description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_broadcast_requests_request_id 
  ON public.whatsapp_broadcast_requests(request_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_broadcast_requests_status 
  ON public.whatsapp_broadcast_requests(status);

-- Enable RLS
ALTER TABLE public.whatsapp_broadcast_requests ENABLE ROW LEVEL SECURITY;

-- Service role policy
CREATE POLICY "service_role_manage_whatsapp_broadcast_requests" ON public.whatsapp_broadcast_requests
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 3. WHATSAPP BROADCAST TARGETS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_broadcast_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id UUID REFERENCES public.whatsapp_broadcast_requests(id) ON DELETE CASCADE,
  business_name TEXT,
  business_phone TEXT,
  country_code TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
  message_sid TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_broadcast_targets_broadcast_id 
  ON public.whatsapp_broadcast_targets(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_broadcast_targets_business_phone 
  ON public.whatsapp_broadcast_targets(business_phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_broadcast_targets_status 
  ON public.whatsapp_broadcast_targets(status);

-- Enable RLS
ALTER TABLE public.whatsapp_broadcast_targets ENABLE ROW LEVEL SECURITY;

-- Service role policy
CREATE POLICY "service_role_manage_whatsapp_broadcast_targets" ON public.whatsapp_broadcast_targets
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 4. WHATSAPP OPT-OUTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_opt_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_phone TEXT UNIQUE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_opt_outs_business_phone 
  ON public.whatsapp_opt_outs(business_phone);

-- Enable RLS
ALTER TABLE public.whatsapp_opt_outs ENABLE ROW LEVEL SECURITY;

-- Service role policy
CREATE POLICY "service_role_manage_whatsapp_opt_outs" ON public.whatsapp_opt_outs
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 5. WHATSAPP BUSINESS REPLIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_business_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_phone TEXT NOT NULL,
  raw_body TEXT,
  action TEXT CHECK (action IN ('HAVE_IT', 'NO_STOCK', 'STOP_MESSAGES', 'UNKNOWN')),
  has_stock BOOLEAN,
  broadcast_target_id UUID REFERENCES public.whatsapp_broadcast_targets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_business_replies_business_phone 
  ON public.whatsapp_business_replies(business_phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_business_replies_broadcast_target_id 
  ON public.whatsapp_business_replies(broadcast_target_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_business_replies_action 
  ON public.whatsapp_business_replies(action);

-- Enable RLS
ALTER TABLE public.whatsapp_business_replies ENABLE ROW LEVEL SECURITY;

-- Service role policy
CREATE POLICY "service_role_manage_whatsapp_business_replies" ON public.whatsapp_business_replies
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 6. SOURCING REQUESTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sourcing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  intent_json JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sourcing_requests_user_id 
  ON public.sourcing_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_requests_status 
  ON public.sourcing_requests(status);

-- Enable RLS
ALTER TABLE public.sourcing_requests ENABLE ROW LEVEL SECURITY;

-- Service role policy
CREATE POLICY "service_role_manage_sourcing_requests" ON public.sourcing_requests
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 7. CANDIDATE VENDORS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.candidate_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.sourcing_requests(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  place_id TEXT,
  source TEXT,
  is_onboarded BOOLEAN DEFAULT false,
  score NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_candidate_vendors_request_id 
  ON public.candidate_vendors(request_id);
CREATE INDEX IF NOT EXISTS idx_candidate_vendors_phone 
  ON public.candidate_vendors(phone);

-- Enable RLS
ALTER TABLE public.candidate_vendors ENABLE ROW LEVEL SECURITY;

-- Service role policy
CREATE POLICY "service_role_manage_candidate_vendors" ON public.candidate_vendors
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 8. JOBS TABLE (Background Processing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  type TEXT NOT NULL,
  payload_json JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON public.jobs(type);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs(created_at DESC);

-- Enable RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Service role policy
CREATE POLICY "service_role_manage_jobs" ON public.jobs
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 9. CONVERSATIONS TABLE (State Management)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE,
  state_json JSONB DEFAULT '{"step": "COLLECT_INTENT"}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Service role policy
CREATE POLICY "service_role_manage_conversations" ON public.conversations
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 10. INBOUND MESSAGES (Audit Log)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inbound_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  type TEXT,
  text TEXT,
  media_url TEXT,
  wa_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inbound_messages_user_id ON public.inbound_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_inbound_messages_wa_message_id ON public.inbound_messages(wa_message_id);
CREATE INDEX IF NOT EXISTS idx_inbound_messages_created_at ON public.inbound_messages(created_at DESC);

-- Enable RLS
ALTER TABLE public.inbound_messages ENABLE ROW LEVEL SECURITY;

-- Service role policy
CREATE POLICY "service_role_manage_inbound_messages" ON public.inbound_messages
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 11. USER LOCATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  lat NUMERIC,
  lng NUMERIC,
  label TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_locations_user_id ON public.user_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_expires_at ON public.user_locations(expires_at);

-- Enable RLS
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- Service role policy
CREATE POLICY "service_role_manage_user_locations" ON public.user_locations
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 12. RPC FUNCTIONS
-- ============================================================================

-- Get next job for processing (with locking)
CREATE OR REPLACE FUNCTION public.get_next_job()
RETURNS SETOF public.jobs AS $$
BEGIN
  RETURN QUERY
  UPDATE jobs 
  SET status = 'processing', updated_at = now()
  WHERE id = (
    SELECT id FROM jobs 
    WHERE status = 'pending' 
    ORDER BY created_at ASC 
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_next_job() TO service_role;

-- Increment positive response count for vendor
CREATE OR REPLACE FUNCTION public.increment_positive_response(phone_input TEXT)
RETURNS void AS $$
BEGIN
  UPDATE vendors 
  SET positive_response_count = positive_response_count + 1,
      updated_at = now()
  WHERE phone = phone_input;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.increment_positive_response(TEXT) TO service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.vendors IS 'Business vendors for Buy & Sell marketplace';
COMMENT ON TABLE public.whatsapp_broadcast_requests IS 'WhatsApp broadcast campaign requests';
COMMENT ON TABLE public.whatsapp_broadcast_targets IS 'Individual broadcast message targets';
COMMENT ON TABLE public.whatsapp_opt_outs IS 'Vendors who opted out of broadcasts';
COMMENT ON TABLE public.whatsapp_business_replies IS 'Vendor replies to broadcast messages';
COMMENT ON TABLE public.sourcing_requests IS 'User sourcing requests with intent';
COMMENT ON TABLE public.candidate_vendors IS 'Candidate vendors found during sourcing';
COMMENT ON TABLE public.jobs IS 'Background job queue for async processing';
COMMENT ON TABLE public.conversations IS 'Conversation state management for Buy & Sell agent';
COMMENT ON TABLE public.inbound_messages IS 'Audit log of inbound WhatsApp messages';
COMMENT ON TABLE public.user_locations IS 'User location data with expiration';

COMMIT;
