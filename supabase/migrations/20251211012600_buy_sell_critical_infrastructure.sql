BEGIN;

-- Migration: Buy & Sell System - Critical Infrastructure
-- Purpose: Add idempotency, vendor outreach, and marketplace inquiry tracking
-- Date: 2025-12-11

-- ============================================================
-- 1. AGENT IDEMPOTENCY TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.agent_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT UNIQUE NOT NULL,
  agent_slug TEXT NOT NULL,
  request_payload JSONB NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX IF NOT EXISTS idx_agent_requests_key ON public.agent_requests(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_agent_requests_expires ON public.agent_requests(expires_at);

-- Enable RLS
ALTER TABLE public.agent_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role only
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_requests' AND policyname = 'service_role_manage_agent_requests') THEN
        CREATE POLICY "service_role_manage_agent_requests" ON public.agent_requests 
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

-- Cleanup function for expired requests
CREATE OR REPLACE FUNCTION public.cleanup_expired_agent_requests()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.agent_requests
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON TABLE public.agent_requests IS 'Idempotency cache for AI agent requests to prevent duplicate processing';
COMMENT ON FUNCTION public.cleanup_expired_agent_requests IS 'Deletes expired agent request cache entries (older than 24 hours)';

-- ============================================================
-- 2. MARKETPLACE INQUIRIES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.marketplace_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_phone TEXT NOT NULL,
  buyer_profile_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  request_summary TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('product', 'service', 'medicine', 'general')),
  business_ids UUID[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'completed', 'failed', 'cancelled')),
  vendors_contacted INTEGER NOT NULL DEFAULT 0,
  vendors_responded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_inquiries_buyer ON public.marketplace_inquiries(buyer_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON public.marketplace_inquiries(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_profile ON public.marketplace_inquiries(buyer_profile_id) WHERE buyer_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inquiries_expires ON public.marketplace_inquiries(expires_at);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_marketplace_inquiry_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_marketplace_inquiries_updated ON public.marketplace_inquiries;
CREATE TRIGGER trg_marketplace_inquiries_updated
BEFORE UPDATE ON public.marketplace_inquiries
FOR EACH ROW
EXECUTE FUNCTION public.update_marketplace_inquiry_timestamp();

-- Enable RLS
ALTER TABLE public.marketplace_inquiries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marketplace_inquiries' AND policyname = 'users_view_own_inquiries') THEN
        CREATE POLICY "users_view_own_inquiries" ON public.marketplace_inquiries 
            FOR SELECT USING (buyer_profile_id = auth.uid());
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marketplace_inquiries' AND policyname = 'service_role_manage_inquiries') THEN
        CREATE POLICY "service_role_manage_inquiries" ON public.marketplace_inquiries 
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

COMMENT ON TABLE public.marketplace_inquiries IS 'Buyer requests sent to vendors for products/services';

-- ============================================================
-- 3. VENDOR OUTREACH LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vendor_outreach_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES public.marketplace_inquiries(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  business_phone TEXT,
  message_sent TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('sent', 'delivered', 'read', 'responded', 'failed')),
  response_text TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_inquiry ON public.vendor_outreach_log(inquiry_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_business ON public.vendor_outreach_log(business_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_status ON public.vendor_outreach_log(status, sent_at DESC);

-- Enable RLS
ALTER TABLE public.vendor_outreach_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vendor_outreach_log' AND policyname = 'service_role_manage_outreach') THEN
        CREATE POLICY "service_role_manage_outreach" ON public.vendor_outreach_log 
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

COMMENT ON TABLE public.vendor_outreach_log IS 'Log of WhatsApp messages sent to vendors for buyer inquiries';

-- ============================================================
-- 4. RATE LIMITING TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.message_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  domain TEXT NOT NULL, -- 'buy_sell', 'mobility', etc.
  message_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_phone_domain ON public.message_rate_limits(phone, domain, window_start DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON public.message_rate_limits(window_start);

-- Enable RLS
ALTER TABLE public.message_rate_limits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'message_rate_limits' AND policyname = 'service_role_manage_rate_limits') THEN
        CREATE POLICY "service_role_manage_rate_limits" ON public.message_rate_limits 
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

-- Rate limit check function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_phone TEXT,
  p_domain TEXT,
  p_limit INTEGER DEFAULT 20,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_window_start TIMESTAMPTZ;
BEGIN
  v_window_start := NOW() - (p_window_seconds || ' seconds')::INTERVAL;
  
  -- Count messages in window
  SELECT COALESCE(SUM(message_count), 0)::INTEGER INTO v_count
  FROM public.message_rate_limits
  WHERE phone = p_phone
    AND domain = p_domain
    AND window_start > v_window_start;
  
  -- Check if over limit
  IF v_count >= p_limit THEN
    RETURN false;
  END IF;
  
  -- Record this message
  INSERT INTO public.message_rate_limits (phone, domain, message_count, window_start)
  VALUES (p_phone, p_domain, 1, NOW())
  ON CONFLICT DO NOTHING;
  
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) IS 'Check if user is within rate limit and record message';

-- ============================================================
-- 5. HELPER FUNCTIONS
-- ============================================================

-- Get inquiry status for buyer
CREATE OR REPLACE FUNCTION public.get_inquiry_status(
  p_buyer_phone TEXT,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE(
  inquiry_id UUID,
  request_summary TEXT,
  request_type TEXT,
  status TEXT,
  vendors_contacted INTEGER,
  vendors_responded INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    request_summary,
    request_type,
    status,
    vendors_contacted,
    vendors_responded,
    created_at
  FROM public.marketplace_inquiries
  WHERE buyer_phone = p_buyer_phone
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT p_limit;
$$;

-- Get vendor outreach for inquiry
CREATE OR REPLACE FUNCTION public.get_inquiry_outreach(
  p_inquiry_id UUID
)
RETURNS TABLE(
  business_name TEXT,
  sent_at TIMESTAMPTZ,
  status TEXT,
  responded_at TIMESTAMPTZ,
  response_text TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    business_name,
    sent_at,
    status,
    responded_at,
    response_text
  FROM public.vendor_outreach_log
  WHERE inquiry_id = p_inquiry_id
  ORDER BY sent_at DESC;
$$;

-- ============================================================
-- 6. GRANTS
-- ============================================================

GRANT SELECT ON public.agent_requests TO authenticated;
GRANT SELECT ON public.marketplace_inquiries TO authenticated;
GRANT SELECT ON public.vendor_outreach_log TO authenticated;
GRANT SELECT ON public.message_rate_limits TO authenticated;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_agent_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_inquiry_status(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_inquiry_outreach(UUID) TO authenticated;

COMMIT;
