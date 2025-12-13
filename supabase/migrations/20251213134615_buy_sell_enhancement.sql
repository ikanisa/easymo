BEGIN;

-- Migration: Buy & Sell Agent Enhancement
-- Purpose: Add comprehensive vendor outreach, sourcing workflow, and conversation management
-- Date: 2025-12-13
-- 
-- New tables for:
-- - Vendor management with opt-in tracking
-- - WhatsApp broadcast tracking
-- - Vendor replies and opt-outs
-- - Sourcing requests and candidate vendors
-- - Job queue for async processing
-- - Conversation state management
-- - Inbound message audit trail

-- ============================================================
-- 1. VENDORS TABLE (IF NOT EXISTS)
-- ============================================================

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
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendors_phone ON public.vendors(phone);
CREATE INDEX IF NOT EXISTS idx_vendors_opted_in ON public.vendors(is_opted_in) WHERE is_opted_in = true;
CREATE INDEX IF NOT EXISTS idx_vendors_tags ON public.vendors USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_vendors_rating ON public.vendors(average_rating DESC) WHERE is_opted_in = true;

-- Enable RLS
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vendors' AND policyname = 'service_role_manage_vendors') THEN
        CREATE POLICY "service_role_manage_vendors" ON public.vendors 
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vendors' AND policyname = 'vendors_public_read') THEN
        CREATE POLICY "vendors_public_read" ON public.vendors 
            FOR SELECT USING (true);
    END IF;
END $$;

COMMENT ON TABLE public.vendors IS 'Vendor directory with opt-in status for WhatsApp outreach';

-- ============================================================
-- 2. WHATSAPP BROADCAST TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_broadcast_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id TEXT UNIQUE NOT NULL,
    user_location_label TEXT,
    need_description TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_requests_status ON public.whatsapp_broadcast_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_requests_request_id ON public.whatsapp_broadcast_requests(request_id);

ALTER TABLE public.whatsapp_broadcast_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_broadcast_requests' AND policyname = 'service_role_manage_broadcast_requests') THEN
        CREATE POLICY "service_role_manage_broadcast_requests" ON public.whatsapp_broadcast_requests 
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

COMMENT ON TABLE public.whatsapp_broadcast_requests IS 'Track WhatsApp broadcast campaigns to vendors';

-- ============================================================
-- 3. WHATSAPP BROADCAST TARGETS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_broadcast_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcast_id UUID REFERENCES public.whatsapp_broadcast_requests(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    business_phone TEXT NOT NULL,
    country_code TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
    twilio_message_sid TEXT, -- Kept for compatibility, stores WhatsApp message ID
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_targets_broadcast ON public.whatsapp_broadcast_targets(broadcast_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_targets_phone ON public.whatsapp_broadcast_targets(business_phone);
CREATE INDEX IF NOT EXISTS idx_broadcast_targets_status ON public.whatsapp_broadcast_targets(status);

ALTER TABLE public.whatsapp_broadcast_targets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_broadcast_targets' AND policyname = 'service_role_manage_broadcast_targets') THEN
        CREATE POLICY "service_role_manage_broadcast_targets" ON public.whatsapp_broadcast_targets 
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

COMMENT ON TABLE public.whatsapp_broadcast_targets IS 'Individual vendor targets for broadcast campaigns';

-- ============================================================
-- 4. OPT-OUT COMPLIANCE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_opt_outs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_phone TEXT UNIQUE NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opt_outs_phone ON public.whatsapp_opt_outs(business_phone);

ALTER TABLE public.whatsapp_opt_outs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_opt_outs' AND policyname = 'service_role_manage_opt_outs') THEN
        CREATE POLICY "service_role_manage_opt_outs" ON public.whatsapp_opt_outs 
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

COMMENT ON TABLE public.whatsapp_opt_outs IS 'Track vendors who opted out of WhatsApp messages';

-- ============================================================
-- 5. VENDOR REPLIES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_business_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_phone TEXT NOT NULL,
    raw_body TEXT NOT NULL,
    action TEXT CHECK (action IN ('HAVE_IT', 'NO_STOCK', 'STOP_MESSAGES')),
    has_stock BOOLEAN,
    broadcast_target_id UUID REFERENCES public.whatsapp_broadcast_targets(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_replies_phone ON public.whatsapp_business_replies(business_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_replies_action ON public.whatsapp_business_replies(action) WHERE action IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_business_replies_broadcast ON public.whatsapp_business_replies(broadcast_target_id) WHERE broadcast_target_id IS NOT NULL;

ALTER TABLE public.whatsapp_business_replies ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_business_replies' AND policyname = 'service_role_manage_business_replies') THEN
        CREATE POLICY "service_role_manage_business_replies" ON public.whatsapp_business_replies 
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

COMMENT ON TABLE public.whatsapp_business_replies IS 'Vendor replies to broadcast messages';

-- ============================================================
-- 6. SOURCING WORKFLOW
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sourcing_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    intent_json JSONB NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sourcing_requests_user ON public.sourcing_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sourcing_requests_status ON public.sourcing_requests(status, created_at DESC);

ALTER TABLE public.sourcing_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sourcing_requests' AND policyname = 'users_view_own_sourcing') THEN
        CREATE POLICY "users_view_own_sourcing" ON public.sourcing_requests 
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sourcing_requests' AND policyname = 'service_role_manage_sourcing') THEN
        CREATE POLICY "service_role_manage_sourcing" ON public.sourcing_requests 
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

COMMENT ON TABLE public.sourcing_requests IS 'User requests for AI-powered vendor sourcing';

-- ============================================================
-- 7. CANDIDATE VENDORS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.candidate_vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES public.sourcing_requests(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    place_id TEXT,
    source TEXT CHECK (source IN ('google_search', 'google_maps', 'existing_vendor')),
    is_onboarded BOOLEAN DEFAULT false,
    score NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_vendors_request ON public.candidate_vendors(request_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_candidate_vendors_source ON public.candidate_vendors(source);

ALTER TABLE public.candidate_vendors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'candidate_vendors' AND policyname = 'service_role_manage_candidates') THEN
        CREATE POLICY "service_role_manage_candidates" ON public.candidate_vendors 
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

COMMENT ON TABLE public.candidate_vendors IS 'Candidate vendors discovered through AI search';

-- ============================================================
-- 8. JOB QUEUE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    payload_json JSONB NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status, created_at ASC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_jobs_user ON public.jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON public.jobs(type, created_at DESC);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'jobs' AND policyname = 'service_role_manage_jobs') THEN
        CREATE POLICY "service_role_manage_jobs" ON public.jobs 
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

COMMENT ON TABLE public.jobs IS 'Background job queue for async message processing';

-- ============================================================
-- 9. CONVERSATION STATE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    state_json JSONB DEFAULT '{"step": "COLLECT_INTENT"}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user ON public.conversations(user_id);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'users_view_own_conversation') THEN
        CREATE POLICY "users_view_own_conversation" ON public.conversations 
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'service_role_manage_conversations') THEN
        CREATE POLICY "service_role_manage_conversations" ON public.conversations 
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

COMMENT ON TABLE public.conversations IS 'Track user conversation state for multi-turn dialogs';

-- ============================================================
-- 10. INBOUND MESSAGES AUDIT
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inbound_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    type TEXT,
    text TEXT,
    media_url TEXT,
    wa_message_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbound_messages_user ON public.inbound_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_messages_wa_id ON public.inbound_messages(wa_message_id);

ALTER TABLE public.inbound_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inbound_messages' AND policyname = 'service_role_manage_inbound') THEN
        CREATE POLICY "service_role_manage_inbound" ON public.inbound_messages 
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

COMMENT ON TABLE public.inbound_messages IS 'Audit trail of all inbound WhatsApp messages';

-- ============================================================
-- 11. HELPER FUNCTIONS
-- ============================================================

-- Increment positive response count for vendor
CREATE OR REPLACE FUNCTION public.increment_positive_response(phone_input TEXT)
RETURNS void AS $$
BEGIN
    UPDATE public.vendors 
    SET positive_response_count = positive_response_count + 1,
        updated_at = now()
    WHERE phone = phone_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.increment_positive_response(TEXT) TO authenticated;

COMMENT ON FUNCTION public.increment_positive_response(TEXT) IS 'Increment positive response count for a vendor';

-- Get next pending job (with row-level locking)
CREATE OR REPLACE FUNCTION public.get_next_job()
RETURNS SETOF public.jobs AS $$
BEGIN
    RETURN QUERY
    UPDATE public.jobs
    SET status = 'processing', updated_at = now()
    WHERE id = (
        SELECT id FROM public.jobs 
        WHERE status = 'pending' 
        ORDER BY created_at ASC 
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_next_job() TO authenticated;

COMMENT ON FUNCTION public.get_next_job() IS 'Get next pending job from queue with atomic lock';

-- Update vendor timestamp trigger
CREATE OR REPLACE FUNCTION public.update_vendors_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vendors_updated ON public.vendors;
CREATE TRIGGER trg_vendors_updated
BEFORE UPDATE ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public.update_vendors_timestamp();

-- Update conversation timestamp trigger
CREATE OR REPLACE FUNCTION public.update_conversations_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_conversations_updated ON public.conversations;
CREATE TRIGGER trg_conversations_updated
BEFORE UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_conversations_timestamp();

-- ============================================================
-- 12. GRANTS
-- ============================================================

GRANT SELECT ON public.vendors TO authenticated;
GRANT SELECT ON public.whatsapp_broadcast_requests TO authenticated;
GRANT SELECT ON public.whatsapp_broadcast_targets TO authenticated;
GRANT SELECT ON public.whatsapp_opt_outs TO authenticated;
GRANT SELECT ON public.whatsapp_business_replies TO authenticated;
GRANT SELECT ON public.sourcing_requests TO authenticated;
GRANT SELECT ON public.candidate_vendors TO authenticated;
GRANT SELECT ON public.jobs TO authenticated;
GRANT SELECT ON public.conversations TO authenticated;
GRANT SELECT ON public.inbound_messages TO authenticated;

COMMIT;
