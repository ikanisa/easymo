-- =====================================================================
-- USER INTENTS SYSTEM - STRUCTURED INTENT RECORDING & MATCHING
-- =====================================================================
-- Complete system for recording user intents from voice calls,
-- matching them with available options, and sending WhatsApp notifications
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. USER INTENTS TABLE - Structured Storage
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.user_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  
  -- Intent classification
  intent_type TEXT NOT NULL CHECK (intent_type IN (
    'job_seeker',
    'job_poster',
    'property_seeker',
    'property_lister',
    'farmer_seller',
    'farmer_buyer',
    'ride_request',
    'insurance_inquiry',
    'legal_inquiry',
    'pharmacy_inquiry',
    'marketplace_seller',
    'marketplace_buyer',
    'vendor_inquiry',
    'general_inquiry'
  )),
  
  -- Location (MANDATORY)
  location_text TEXT NOT NULL,
  location_coords JSONB,  -- {lat: number, lng: number}
  
  -- Intent-specific details
  details JSONB NOT NULL DEFAULT '{}',
  
  -- Priority & timing
  urgency TEXT DEFAULT 'flexible' CHECK (urgency IN ('immediate', 'within_week', 'flexible')),
  language TEXT DEFAULT 'en',
  
  -- Status tracking
  status TEXT DEFAULT 'pending_match' CHECK (status IN (
    'pending_match',
    'matching',
    'matched',
    'notified',
    'completed',
    'expired',
    'cancelled'
  )),
  
  -- Source tracking
  source TEXT DEFAULT 'voice_call' CHECK (source IN ('voice_call', 'text_chat', 'app', 'web')),
  call_id TEXT,  -- Reference to original call
  
  -- Timestamps
  matched_at TIMESTAMPTZ,
  notified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_intents_type ON public.user_intents(intent_type);
CREATE INDEX IF NOT EXISTS idx_user_intents_status ON public.user_intents(status);
CREATE INDEX IF NOT EXISTS idx_user_intents_location ON public.user_intents USING gin(to_tsvector('english', location_text));
CREATE INDEX IF NOT EXISTS idx_user_intents_phone ON public.user_intents(phone_number);
CREATE INDEX IF NOT EXISTS idx_user_intents_pending ON public.user_intents(status) WHERE status = 'pending_match';
CREATE INDEX IF NOT EXISTS idx_user_intents_profile ON public.user_intents(profile_id);
CREATE INDEX IF NOT EXISTS idx_user_intents_call ON public.user_intents(call_id);

-- Auto-update timestamp
DROP TRIGGER IF EXISTS update_user_intents_updated_at ON public.user_intents;
CREATE TRIGGER update_user_intents_updated_at
  BEFORE UPDATE ON public.user_intents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- 2. INTENT PROCESSING QUEUE - Background Processing
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.intent_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID NOT NULL REFERENCES public.user_intents(id) ON DELETE CASCADE,
  intent_type TEXT NOT NULL,
  
  -- Queue status
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 3,  -- 1=immediate, 2=within_week, 3=flexible
  
  -- Retry logic
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  last_error TEXT,
  
  -- Timestamps
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intent_queue_status ON public.intent_processing_queue(status, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_intent_queue_intent ON public.intent_processing_queue(intent_id);

-- =====================================================================
-- 3. INTENT MATCHES - Matching Results
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.intent_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID NOT NULL REFERENCES public.user_intents(id) ON DELETE CASCADE,
  
  -- Match details
  match_type TEXT NOT NULL,  -- 'job_listing', 'property_listing', 'farmer_product', etc.
  match_id UUID NOT NULL,    -- Reference to the matched entity
  match_score NUMERIC(3,2) DEFAULT 0.80,  -- 0.00 to 1.00 relevance score
  match_details JSONB,       -- Summary of the match for notification
  
  -- Notification status
  notified BOOLEAN DEFAULT FALSE,
  notification_sent_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intent_matches_intent ON public.intent_matches(intent_id);
CREATE INDEX IF NOT EXISTS idx_intent_matches_pending ON public.intent_matches(notified) WHERE notified = FALSE;
CREATE INDEX IF NOT EXISTS idx_intent_matches_type ON public.intent_matches(match_type, match_id);

-- =====================================================================
-- 4. RLS POLICIES
-- =====================================================================

ALTER TABLE public.user_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intent_processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intent_matches ENABLE ROW LEVEL SECURITY;

-- Service role has full access
DROP POLICY IF EXISTS "Service role has full access to user_intents" ON public.user_intents;
CREATE POLICY "Service role has full access to user_intents"
  ON public.user_intents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role has full access to intent_processing_queue" ON public.intent_processing_queue;
CREATE POLICY "Service role has full access to intent_processing_queue"
  ON public.intent_processing_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role has full access to intent_matches" ON public.intent_matches;
CREATE POLICY "Service role has full access to intent_matches"
  ON public.intent_matches
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can view their own intents
DROP POLICY IF EXISTS "Users can view their own intents" ON public.user_intents;
CREATE POLICY "Users can view their own intents"
  ON public.user_intents
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

-- =====================================================================
-- 5. HELPER FUNCTIONS
-- =====================================================================

-- Function to automatically queue new intents for processing
CREATE OR REPLACE FUNCTION public.queue_new_intent()
RETURNS TRIGGER AS $$
BEGIN
  -- Queue the intent for processing
  INSERT INTO public.intent_processing_queue (
    intent_id,
    intent_type,
    priority
  ) VALUES (
    NEW.id,
    NEW.intent_type,
    CASE NEW.urgency
      WHEN 'immediate' THEN 1
      WHEN 'within_week' THEN 2
      ELSE 3
    END
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-queue intents
CREATE TRIGGER auto_queue_intent
  AFTER INSERT ON public.user_intents
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_new_intent();

-- Function to mark expired intents
CREATE OR REPLACE FUNCTION public.mark_expired_intents()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE public.user_intents
  SET status = 'expired'
  WHERE status IN ('pending_match', 'matching')
    AND expires_at < now();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
