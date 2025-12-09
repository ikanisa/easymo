BEGIN;

-- ==================================================================
-- Buy & Sell Concierge Schema
-- ==================================================================
-- 
-- Purpose: Enable AI-powered vendor outreach for the Buy & Sell agent.
-- 
-- Changes:
-- 1. Add `tags` and `metadata` columns to businesses table for semantic search
-- 2. Create vendor inquiry tables to track outreach on user's behalf
-- 3. Add vendor performance tracking fields
-- 4. Create optimized search function with tags/metadata support
--
-- Per docs/GROUND_RULES.md: Wrapped in BEGIN/COMMIT
-- ==================================================================

-- ==================================================================
-- 1. Enhance businesses table with tags and metadata
-- ==================================================================

-- Add tags array for semantic search (e.g. ["laptop", "hp", "used-laptops"])
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'businesses' 
    AND column_name = 'tags'
  ) THEN
    ALTER TABLE public.businesses ADD COLUMN tags text[] DEFAULT '{}'::text[];
  END IF;
END $$;

-- Add metadata JSONB for flexible attributes
-- Examples:
--   Electronics: {"brands": ["HP", "Dell"], "price_band": "mid", "services": ["repairs"]}
--   Pharmacy: {"open_24h": true, "has_delivery": true, "services": ["prescription", "otc"]}
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'businesses' 
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.businesses ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add vendor performance metrics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'businesses' 
    AND column_name = 'response_time_avg_sec'
  ) THEN
    ALTER TABLE public.businesses ADD COLUMN response_time_avg_sec integer;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'businesses' 
    AND column_name = 'response_rate'
  ) THEN
    ALTER TABLE public.businesses ADD COLUMN response_rate numeric(5,4);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'businesses' 
    AND column_name = 'confirmation_accuracy'
  ) THEN
    ALTER TABLE public.businesses ADD COLUMN confirmation_accuracy numeric(5,4);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'businesses' 
    AND column_name = 'inquiry_count'
  ) THEN
    ALTER TABLE public.businesses ADD COLUMN inquiry_count integer DEFAULT 0;
  END IF;
END $$;

-- Create GIN index for tags array search
CREATE INDEX IF NOT EXISTS idx_businesses_tags ON public.businesses USING gin(tags);

-- Create GIN index for metadata JSONB search  
CREATE INDEX IF NOT EXISTS idx_businesses_metadata ON public.businesses USING gin(metadata jsonb_path_ops);

-- ==================================================================
-- 2. Create vendor inquiry tables
-- ==================================================================

-- Main inquiry tracking table
CREATE TABLE IF NOT EXISTS public.market_vendor_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_phone text NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('product', 'service', 'medicine')),
  request_summary text NOT NULL,
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Status: pending (just created), partial (some replies), complete (all replied/timeout), expired, cancelled
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'complete', 'expired', 'cancelled')),
  -- User location at time of request
  user_lat double precision,
  user_lng double precision,
  -- Tracking
  vendor_count integer DEFAULT 0,
  replied_count integer DEFAULT 0,
  confirmed_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '2 minutes')
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_market_vendor_inquiries_user ON public.market_vendor_inquiries(user_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_vendor_inquiries_status ON public.market_vendor_inquiries(status, created_at DESC);

-- Individual vendor messages within an inquiry
CREATE TABLE IF NOT EXISTS public.market_vendor_inquiry_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL REFERENCES public.market_vendor_inquiries(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  business_phone text NOT NULL,
  business_name text,
  -- Direction: outbound = we sent to vendor, inbound = vendor replied
  direction text NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  -- WhatsApp message ID for tracking
  whatsapp_message_id text,
  body text NOT NULL,
  -- Parsed response (for inbound): yes, no, other
  parsed_status text CHECK (parsed_status IS NULL OR parsed_status IN ('yes', 'no', 'other')),
  -- Extracted data from positive responses
  price numeric(12,2),
  quantity integer,
  notes text,
  -- Timing
  created_at timestamptz DEFAULT now(),
  -- Response time in seconds (calculated for inbound from last outbound)
  response_time_sec integer
);

-- Indexes for message lookups
CREATE INDEX IF NOT EXISTS idx_market_vendor_inquiry_messages_inquiry ON public.market_vendor_inquiry_messages(inquiry_id, created_at);
CREATE INDEX IF NOT EXISTS idx_market_vendor_inquiry_messages_business ON public.market_vendor_inquiry_messages(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_vendor_inquiry_messages_wa ON public.market_vendor_inquiry_messages(whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL;

-- User feedback on vendor accuracy
CREATE TABLE IF NOT EXISTS public.market_vendor_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid REFERENCES public.market_vendor_inquiries(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.market_vendor_inquiry_messages(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  user_phone text NOT NULL,
  -- Feedback type: accurate (they had it), inaccurate (they didn't), cancelled, complaint
  feedback_type text NOT NULL CHECK (feedback_type IN ('accurate', 'inaccurate', 'cancelled', 'complaint')),
  rating integer CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  comment text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_vendor_feedback_business ON public.market_vendor_feedback(business_id, created_at DESC);

-- ==================================================================
-- 3. RLS Policies
-- ==================================================================

ALTER TABLE public.market_vendor_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_vendor_inquiry_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_vendor_feedback ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "service_role_full_access_inquiries" ON public.market_vendor_inquiries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access_messages" ON public.market_vendor_inquiry_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access_feedback" ON public.market_vendor_feedback
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users can view their own inquiries
CREATE POLICY "users_view_own_inquiries" ON public.market_vendor_inquiries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ==================================================================
-- 4. Enhanced search function with tags and metadata
-- ==================================================================

-- Drop existing function variants to avoid conflicts
DROP FUNCTION IF EXISTS public.search_businesses_with_tags(text, text[], text, double precision, double precision, double precision, integer);

-- Create enhanced search function
CREATE OR REPLACE FUNCTION public.search_businesses_with_tags(
  p_query_text text DEFAULT NULL,
  p_tags text[] DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_radius_km double precision DEFAULT 10,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  name text,
  category text,
  address text,
  phone text,
  owner_whatsapp text,
  tags text[],
  metadata jsonb,
  latitude double precision,
  longitude double precision,
  distance_km double precision,
  relevance_score numeric,
  response_rate numeric,
  response_time_avg_sec integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_has_location boolean;
BEGIN
  v_has_location := p_latitude IS NOT NULL AND p_longitude IS NOT NULL;
  
  RETURN QUERY
  WITH scored_businesses AS (
    SELECT
      b.id,
      b.name,
      b.category,
      b.address,
      b.phone,
      b.owner_whatsapp,
      b.tags,
      b.metadata,
      b.lat,
      b.lng,
      b.response_rate,
      b.response_time_avg_sec,
      -- Calculate distance if location provided
      CASE 
        WHEN v_has_location AND b.lat IS NOT NULL AND b.lng IS NOT NULL THEN
          6371 * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians(p_latitude)) * 
              cos(radians(b.lat)) * 
              cos(radians(b.lng) - radians(p_longitude)) + 
              sin(radians(p_latitude)) * 
              sin(radians(b.lat))
            ))
          )
        ELSE NULL
      END AS calc_distance_km,
      -- Calculate relevance score
      (
        -- Tag overlap score (0-40 points)
        CASE 
          WHEN p_tags IS NOT NULL AND b.tags IS NOT NULL THEN
            LEAST(40, (SELECT COUNT(*) FROM unnest(p_tags) t WHERE t = ANY(b.tags)) * 10)
          ELSE 0
        END
        +
        -- Category match (0-20 points)
        CASE WHEN p_category IS NOT NULL AND b.category = p_category THEN 20 ELSE 0 END
        +
        -- Text match in name (0-20 points)
        CASE 
          WHEN p_query_text IS NOT NULL AND b.name ILIKE '%' || p_query_text || '%' THEN 20
          ELSE 0
        END
        +
        -- Vendor quality score (0-20 points)
        COALESCE(b.response_rate * 20, 0)
      )::numeric AS relevance
    FROM public.businesses b
    WHERE 
      -- Category filter
      (p_category IS NULL OR b.category = p_category)
      -- Location bounding box filter for performance
      AND (
        NOT v_has_location 
        OR b.lat IS NULL 
        OR b.lng IS NULL
        OR (
          b.lat BETWEEN (p_latitude - (p_radius_km / 111.0)) AND (p_latitude + (p_radius_km / 111.0))
          AND b.lng BETWEEN (p_longitude - (p_radius_km / (111.0 * COALESCE(cos(radians(p_latitude)), 1)))) 
                        AND (p_longitude + (p_radius_km / (111.0 * COALESCE(cos(radians(p_latitude)), 1))))
        )
      )
      -- Tag filter (if provided, must have at least one matching tag)
      AND (
        p_tags IS NULL 
        OR b.tags && p_tags
      )
  )
  SELECT 
    sb.id,
    sb.name,
    sb.category,
    sb.address,
    sb.phone,
    sb.owner_whatsapp,
    sb.tags,
    sb.metadata,
    sb.lat AS latitude,
    sb.lng AS longitude,
    sb.calc_distance_km AS distance_km,
    sb.relevance AS relevance_score,
    sb.response_rate,
    sb.response_time_avg_sec
  FROM scored_businesses sb
  WHERE 
    -- Final distance filter
    (NOT v_has_location OR sb.calc_distance_km IS NULL OR sb.calc_distance_km <= p_radius_km)
  ORDER BY
    -- Sort by relevance first, then distance
    sb.relevance DESC NULLS LAST,
    sb.calc_distance_km ASC NULLS LAST
  LIMIT p_limit;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.search_businesses_with_tags(text, text[], text, double precision, double precision, double precision, integer) 
TO authenticated, anon, service_role;

-- ==================================================================
-- 5. Helper function to update vendor metrics
-- ==================================================================

CREATE OR REPLACE FUNCTION public.update_vendor_metrics(p_business_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_outbound integer;
  v_total_inbound integer;
  v_avg_response_time integer;
  v_accuracy_count integer;
  v_feedback_count integer;
BEGIN
  -- Count outbound messages to this vendor
  SELECT COUNT(*) INTO v_total_outbound
  FROM public.market_vendor_inquiry_messages
  WHERE business_id = p_business_id AND direction = 'outbound';
  
  -- Count inbound responses from this vendor
  SELECT COUNT(*), AVG(response_time_sec)::integer
  INTO v_total_inbound, v_avg_response_time
  FROM public.market_vendor_inquiry_messages
  WHERE business_id = p_business_id AND direction = 'inbound';
  
  -- Count feedback
  SELECT 
    COUNT(*) FILTER (WHERE feedback_type = 'accurate'),
    COUNT(*)
  INTO v_accuracy_count, v_feedback_count
  FROM public.market_vendor_feedback
  WHERE business_id = p_business_id;
  
  -- Update business metrics
  UPDATE public.businesses
  SET 
    inquiry_count = v_total_outbound,
    response_rate = CASE WHEN v_total_outbound > 0 THEN v_total_inbound::numeric / v_total_outbound ELSE NULL END,
    response_time_avg_sec = v_avg_response_time,
    confirmation_accuracy = CASE WHEN v_feedback_count > 0 THEN v_accuracy_count::numeric / v_feedback_count ELSE NULL END
  WHERE id = p_business_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_vendor_metrics(uuid) TO service_role;

COMMIT;
