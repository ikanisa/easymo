BEGIN;

-- =====================================================
-- MARKETPLACE AI AGENT TABLES
-- =====================================================
-- Tables for the conversational marketplace AI agent:
-- - marketplace_listings: Individual seller product/service listings
-- - marketplace_buyer_intents: What buyers are looking for
-- - marketplace_conversations: AI agent conversation state
-- - marketplace_matches: Buyer-seller connections
-- =====================================================

-- 1. Product/Service Listings (for individual sellers)
CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Seller Info
  seller_phone TEXT NOT NULL,           -- WhatsApp number
  seller_name TEXT,                     -- Optional name
  
  -- Product/Service Info
  listing_type TEXT NOT NULL DEFAULT 'product' CHECK (listing_type IN ('product', 'service')),
  title TEXT NOT NULL,                  -- "Wooden Dining Table with 6 Chairs"
  description TEXT,                     -- Free-form description
  product_name TEXT NOT NULL,           -- "dining table" (searchable)
  attributes JSONB DEFAULT '{}',        -- {"material": "wood", "seats": 6, "condition": "good"}
  
  -- Pricing
  price NUMERIC,
  price_negotiable BOOLEAN DEFAULT true,
  currency TEXT DEFAULT 'RWF',
  
  -- Location (for proximity matching)
  lat NUMERIC,
  lng NUMERIC,
  location_text TEXT,                   -- "Kigali, Kimironko"
  
  -- Media
  photos TEXT[] DEFAULT '{}',           -- Array of image URLs
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'expired', 'draft')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

-- Create search vector column
ALTER TABLE public.marketplace_listings 
  ADD COLUMN IF NOT EXISTS search_vector TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(product_name, '') || ' ' || COALESCE(description, ''))
  ) STORED;

-- 2. Buyer Intents (what users are looking for)
CREATE TABLE IF NOT EXISTS public.marketplace_buyer_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  buyer_phone TEXT NOT NULL,
  looking_for TEXT NOT NULL,            -- "dining table", "pharmacy", "plumber"
  intent_type TEXT NOT NULL DEFAULT 'product' CHECK (intent_type IN ('product', 'service', 'business')),
  
  -- Location preference
  lat NUMERIC,
  lng NUMERIC,
  max_radius_km NUMERIC DEFAULT 10,
  
  -- Price range
  max_price NUMERIC,
  min_price NUMERIC,
  
  -- Matching
  matched_listing_ids UUID[] DEFAULT '{}', -- Listings already shown
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'fulfilled', 'expired')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

-- 3. Conversation Context (AI agent memory)
CREATE TABLE IF NOT EXISTS public.marketplace_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  
  -- Current flow state
  flow_type TEXT CHECK (flow_type IS NULL OR flow_type IN ('selling', 'buying', 'inquiry')),
  flow_step TEXT,                       -- 'asking_price', 'asking_location', 'confirming', etc.
  
  -- Collected data (progressively filled)
  collected_data JSONB DEFAULT '{}',
  
  -- AI context
  conversation_history JSONB DEFAULT '[]',
  last_ai_response TEXT,
  
  -- References
  current_listing_id UUID REFERENCES public.marketplace_listings(id) ON DELETE SET NULL,
  current_intent_id UUID REFERENCES public.marketplace_buyer_intents(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Matches/Connections (buyer-seller connections)
CREATE TABLE IF NOT EXISTS public.marketplace_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  listing_id UUID REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  buyer_phone TEXT NOT NULL,
  seller_phone TEXT NOT NULL,
  
  -- Match quality
  distance_km NUMERIC,
  match_score NUMERIC,                  -- AI-computed relevance
  
  -- Status
  status TEXT DEFAULT 'suggested' CHECK (status IN ('suggested', 'contacted', 'completed', 'rejected')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Listings indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_search ON public.marketplace_listings USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON public.marketplace_listings(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller ON public.marketplace_listings(seller_phone);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_created ON public.marketplace_listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_product ON public.marketplace_listings(product_name);

-- Buyer intents indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_buyer_intents_active ON public.marketplace_buyer_intents(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_marketplace_buyer_intents_buyer ON public.marketplace_buyer_intents(buyer_phone);
CREATE INDEX IF NOT EXISTS idx_marketplace_buyer_intents_looking ON public.marketplace_buyer_intents(looking_for);

-- Conversations indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_conversations_phone ON public.marketplace_conversations(phone);
CREATE INDEX IF NOT EXISTS idx_marketplace_conversations_updated ON public.marketplace_conversations(updated_at DESC);

-- Matches indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_matches_listing ON public.marketplace_matches(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_matches_buyer ON public.marketplace_matches(buyer_phone);
CREATE INDEX IF NOT EXISTS idx_marketplace_matches_status ON public.marketplace_matches(status);

-- =====================================================
-- LOCATION-BASED INDEXES (PostGIS)
-- =====================================================
-- Note: Using conditional creation to avoid errors if PostGIS not installed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    -- Create geography indexes for proximity search (using dollar quoting)
    EXECUTE $exec$CREATE INDEX IF NOT EXISTS idx_marketplace_listings_geo ON public.marketplace_listings USING GIST(ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) WHERE lat IS NOT NULL AND lng IS NOT NULL$exec$;
    
    EXECUTE $exec$CREATE INDEX IF NOT EXISTS idx_marketplace_buyer_intents_geo ON public.marketplace_buyer_intents USING GIST(ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) WHERE lat IS NOT NULL AND lng IS NOT NULL$exec$;
  END IF;
END
$$;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_buyer_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_matches ENABLE ROW LEVEL SECURITY;

-- Service role full access
DO $$
BEGIN
  -- Listings
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marketplace_listings' AND policyname = 'marketplace_listings_service_all') THEN
    CREATE POLICY "marketplace_listings_service_all" ON public.marketplace_listings FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  
  -- Buyer intents
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marketplace_buyer_intents' AND policyname = 'marketplace_buyer_intents_service_all') THEN
    CREATE POLICY "marketplace_buyer_intents_service_all" ON public.marketplace_buyer_intents FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  
  -- Conversations
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marketplace_conversations' AND policyname = 'marketplace_conversations_service_all') THEN
    CREATE POLICY "marketplace_conversations_service_all" ON public.marketplace_conversations FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  
  -- Matches
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marketplace_matches' AND policyname = 'marketplace_matches_service_all') THEN
    CREATE POLICY "marketplace_matches_service_all" ON public.marketplace_matches FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Anon read access for active listings
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marketplace_listings' AND policyname = 'marketplace_listings_anon_read') THEN
    CREATE POLICY "marketplace_listings_anon_read" ON public.marketplace_listings FOR SELECT TO anon USING (status = 'active');
  END IF;
END $$;

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================

-- Update trigger function
CREATE OR REPLACE FUNCTION public.update_marketplace_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS trigger_marketplace_listings_updated ON public.marketplace_listings;
CREATE TRIGGER trigger_marketplace_listings_updated
  BEFORE UPDATE ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_marketplace_updated_at();

DROP TRIGGER IF EXISTS trigger_marketplace_buyer_intents_updated ON public.marketplace_buyer_intents;
CREATE TRIGGER trigger_marketplace_buyer_intents_updated
  BEFORE UPDATE ON public.marketplace_buyer_intents
  FOR EACH ROW EXECUTE FUNCTION public.update_marketplace_updated_at();

DROP TRIGGER IF EXISTS trigger_marketplace_conversations_updated ON public.marketplace_conversations;
CREATE TRIGGER trigger_marketplace_conversations_updated
  BEFORE UPDATE ON public.marketplace_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_marketplace_updated_at();

DROP TRIGGER IF EXISTS trigger_marketplace_matches_updated ON public.marketplace_matches;
CREATE TRIGGER trigger_marketplace_matches_updated
  BEFORE UPDATE ON public.marketplace_matches
  FOR EACH ROW EXECUTE FUNCTION public.update_marketplace_updated_at();

-- =====================================================
-- RPC FUNCTIONS FOR PROXIMITY SEARCH
-- =====================================================

-- Function to search listings by proximity (with fallback for non-PostGIS)
CREATE OR REPLACE FUNCTION public.search_marketplace_listings_nearby(
  search_term TEXT,
  user_lat NUMERIC,
  user_lng NUMERIC,
  radius_km NUMERIC DEFAULT 10,
  result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  seller_phone TEXT,
  seller_name TEXT,
  title TEXT,
  product_name TEXT,
  description TEXT,
  price NUMERIC,
  price_negotiable BOOLEAN,
  currency TEXT,
  location_text TEXT,
  photos TEXT[],
  attributes JSONB,
  distance_km NUMERIC,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Check if PostGIS is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    -- Use PostGIS for accurate distance calculation
    RETURN QUERY
    SELECT 
      l.id,
      l.seller_phone,
      l.seller_name,
      l.title,
      l.product_name,
      l.description,
      l.price,
      l.price_negotiable,
      l.currency,
      l.location_text,
      l.photos,
      l.attributes,
      (ST_Distance(
        ST_SetSRID(ST_MakePoint(l.lng, l.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
      ) / 1000)::NUMERIC(10,2) AS distance_km,
      l.created_at
    FROM public.marketplace_listings l
    WHERE l.status = 'active'
      AND l.lat IS NOT NULL
      AND l.lng IS NOT NULL
      AND l.search_vector @@ plainto_tsquery('english', search_term)
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(l.lng, l.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
        radius_km * 1000
      )
    ORDER BY distance_km ASC
    LIMIT result_limit;
  ELSE
    -- Fallback: Haversine formula approximation
    RETURN QUERY
    SELECT 
      l.id,
      l.seller_phone,
      l.seller_name,
      l.title,
      l.product_name,
      l.description,
      l.price,
      l.price_negotiable,
      l.currency,
      l.location_text,
      l.photos,
      l.attributes,
      (6371 * acos(
        cos(radians(user_lat)) * cos(radians(l.lat)) * 
        cos(radians(l.lng) - radians(user_lng)) + 
        sin(radians(user_lat)) * sin(radians(l.lat))
      ))::NUMERIC(10,2) AS distance_km,
      l.created_at
    FROM public.marketplace_listings l
    WHERE l.status = 'active'
      AND l.lat IS NOT NULL
      AND l.lng IS NOT NULL
      AND l.search_vector @@ plainto_tsquery('english', search_term)
      AND (6371 * acos(
        cos(radians(user_lat)) * cos(radians(l.lat)) * 
        cos(radians(l.lng) - radians(user_lng)) + 
        sin(radians(user_lat)) * sin(radians(l.lat))
      )) <= radius_km
    ORDER BY distance_km ASC
    LIMIT result_limit;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search business directory by proximity
CREATE OR REPLACE FUNCTION public.search_businesses_nearby(
  search_term TEXT,
  user_lat NUMERIC,
  user_lng NUMERIC,
  radius_km NUMERIC DEFAULT 10,
  result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT,
  city TEXT,
  address TEXT,
  phone TEXT,
  rating NUMERIC,
  distance_km NUMERIC
) AS $$
BEGIN
  -- Check if PostGIS is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    RETURN QUERY
    SELECT 
      b.id,
      b.name,
      b.category,
      b.city,
      b.address,
      b.phone,
      b.rating::NUMERIC,
      (ST_Distance(
        ST_SetSRID(ST_MakePoint(b.lng, b.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
      ) / 1000)::NUMERIC(10,2) AS distance_km
    FROM public.business_directory b
    WHERE b.status != 'DO_NOT_CALL'
      AND b.lat IS NOT NULL
      AND b.lng IS NOT NULL
      AND (
        b.name ILIKE '%' || search_term || '%'
        OR b.category ILIKE '%' || search_term || '%'
      )
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(b.lng, b.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
        radius_km * 1000
      )
    ORDER BY distance_km ASC
    LIMIT result_limit;
  ELSE
    RETURN QUERY
    SELECT 
      b.id,
      b.name,
      b.category,
      b.city,
      b.address,
      b.phone,
      b.rating::NUMERIC,
      (6371 * acos(
        cos(radians(user_lat)) * cos(radians(b.lat)) * 
        cos(radians(b.lng) - radians(user_lng)) + 
        sin(radians(user_lat)) * sin(radians(b.lat))
      ))::NUMERIC(10,2) AS distance_km
    FROM public.business_directory b
    WHERE b.status != 'DO_NOT_CALL'
      AND b.lat IS NOT NULL
      AND b.lng IS NOT NULL
      AND (
        b.name ILIKE '%' || search_term || '%'
        OR b.category ILIKE '%' || search_term || '%'
      )
      AND (6371 * acos(
        cos(radians(user_lat)) * cos(radians(b.lat)) * 
        cos(radians(b.lng) - radians(user_lng)) + 
        sin(radians(user_lat)) * sin(radians(b.lat))
      )) <= radius_km
    ORDER BY distance_km ASC
    LIMIT result_limit;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to find matching buyers for a new listing
CREATE OR REPLACE FUNCTION public.find_matching_marketplace_buyers(
  p_listing_id UUID
)
RETURNS TABLE (
  buyer_phone TEXT,
  looking_for TEXT,
  distance_km NUMERIC,
  match_score NUMERIC
) AS $$
DECLARE
  listing RECORD;
BEGIN
  SELECT * INTO listing FROM public.marketplace_listings WHERE id = p_listing_id;
  
  IF listing IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    bi.buyer_phone,
    bi.looking_for,
    CASE 
      WHEN listing.lat IS NOT NULL AND listing.lng IS NOT NULL AND bi.lat IS NOT NULL AND bi.lng IS NOT NULL THEN
        (6371 * acos(
          cos(radians(listing.lat)) * cos(radians(bi.lat)) * 
          cos(radians(bi.lng) - radians(listing.lng)) + 
          sin(radians(listing.lat)) * sin(radians(bi.lat))
        ))::NUMERIC(10,2)
      ELSE NULL
    END AS distance_km,
    -- Simple match score based on text similarity
    (ts_rank(
      to_tsvector('english', listing.product_name || ' ' || COALESCE(listing.description, '')), 
      plainto_tsquery('english', bi.looking_for)
    ) * 100)::NUMERIC(10,2) AS match_score
  FROM public.marketplace_buyer_intents bi
  WHERE bi.status = 'active'
    AND to_tsvector('english', listing.product_name || ' ' || COALESCE(listing.description, '')) 
        @@ plainto_tsquery('english', bi.looking_for)
    AND (
      bi.lat IS NULL 
      OR listing.lat IS NULL 
      OR (6371 * acos(
        cos(radians(listing.lat)) * cos(radians(bi.lat)) * 
        cos(radians(bi.lng) - radians(listing.lng)) + 
        sin(radians(listing.lat)) * sin(radians(bi.lat))
      )) <= bi.max_radius_km
    )
  ORDER BY match_score DESC, distance_km ASC NULLS LAST
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.marketplace_listings IS 'Product and service listings for the conversational marketplace (individual sellers)';
COMMENT ON TABLE public.marketplace_buyer_intents IS 'What buyers are actively looking for in the marketplace';
COMMENT ON TABLE public.marketplace_conversations IS 'AI agent conversation state and history for marketplace interactions';
COMMENT ON TABLE public.marketplace_matches IS 'Buyer-seller connection records and match quality metrics';

COMMENT ON FUNCTION public.search_marketplace_listings_nearby IS 'Search active listings by text query and proximity to user location';
COMMENT ON FUNCTION public.search_businesses_nearby IS 'Search business directory by text query and proximity to user location';
COMMENT ON FUNCTION public.find_matching_marketplace_buyers IS 'Find active buyer intents that match a given listing';

COMMIT;
