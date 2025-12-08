-- =====================================================================
-- FIX BUY & SELL SCHEMA (CONSOLIDATED MIGRATION - v2)
-- =====================================================================
-- This migration fixes the schema for Buy & Sell.
-- CRITICAL FIX: It detects if 'marketplace_listings' is a VIEW and drops it,
-- replacing it with a concrete TABLE as required by the application logic.
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. CLEANUP (Handle View/Table Conflicts)
-- =====================================================================

DO $$
BEGIN
  -- Check if business_directory is a view and drop it
  IF EXISTS (
    SELECT 1 FROM pg_views WHERE viewname = 'business_directory' AND schemaname = 'public'
  ) THEN
    DROP VIEW public.business_directory CASCADE;
  END IF;

  -- Check if marketplace_listings is a view and drop it
  IF EXISTS (
    SELECT 1 FROM pg_views WHERE viewname = 'marketplace_listings' AND schemaname = 'public'
  ) THEN
    DROP VIEW public.marketplace_listings CASCADE;
  END IF;
  
  -- Also drop functions if they exist with wrong signatures (CASCADE handles dependencies)
  DROP FUNCTION IF EXISTS public.search_businesses_nearby(TEXT, FLOAT, FLOAT, FLOAT, INT);
  DROP FUNCTION IF EXISTS public.search_marketplace_listings_nearby(TEXT, NUMERIC, NUMERIC, NUMERIC, INTEGER);
  DROP FUNCTION IF EXISTS public.find_matching_marketplace_buyers(UUID);
END $$;

-- =====================================================================
-- 2. BUSINESS DIRECTORY TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.business_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  city TEXT,
  address TEXT,
  country TEXT DEFAULT 'Rwanda',
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  phone TEXT,
  website TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'CONTACTED', 'QUALIFIED', 'DO_NOT_CALL')),
  rating DECIMAL(2, 1) DEFAULT 0.0,
  review_count INTEGER DEFAULT 0,
  notes TEXT,
  google_maps_url TEXT,
  place_id TEXT,
  business_type TEXT,
  operating_hours JSONB,
  last_checked TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'easymoai',
  import_batch_id UUID,
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_business_directory_search_composite 
  ON public.business_directory (category, country, status);

-- RLS
ALTER TABLE public.business_directory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access" ON public.business_directory;
DROP POLICY IF EXISTS "Public read access" ON public.business_directory;
CREATE POLICY "Public read access" ON public.business_directory FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service write access" ON public.business_directory;
DROP POLICY IF EXISTS "Service write access" ON public.business_directory;
CREATE POLICY "Service write access" ON public.business_directory FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================================
-- 3. MARKETPLACE LISTINGS TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_phone TEXT NOT NULL,
  listing_type TEXT DEFAULT 'product',
  title TEXT NOT NULL,
  product_name TEXT,
  description TEXT,
  price NUMERIC,
  currency TEXT DEFAULT 'RWF',
  location_text TEXT,
  lat NUMERIC,
  lng NUMERIC,
  attributes JSONB DEFAULT '{}',
  images TEXT[],
  status TEXT DEFAULT 'active',
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  country_code TEXT DEFAULT 'RW'
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_search_composite
  ON public.marketplace_listings (status, country_code);

-- RLS
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access" ON public.marketplace_listings;
DROP POLICY IF EXISTS "Public read access" ON public.marketplace_listings;
CREATE POLICY "Public read access" ON public.marketplace_listings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public write access" ON public.marketplace_listings;
DROP POLICY IF EXISTS "Public write access" ON public.marketplace_listings;
CREATE POLICY "Public write access" ON public.marketplace_listings FOR INSERT WITH CHECK (true);

-- =====================================================================
-- 4. MARKETPLACE SUPPORT TABLES
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.marketplace_conversations (
  phone TEXT PRIMARY KEY,
  flow_type TEXT,
  flow_step TEXT,
  collected_data JSONB DEFAULT '{}',
  conversation_history JSONB DEFAULT '[]',
  last_ai_response TEXT,
  current_listing_id UUID REFERENCES public.marketplace_listings(id) ON DELETE SET NULL,
  current_intent_id UUID,
  location JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.marketplace_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public all access" ON public.marketplace_conversations;
DROP POLICY IF EXISTS "Public all access" ON public.marketplace_conversations;
CREATE POLICY "Public all access" ON public.marketplace_conversations FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.marketplace_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  buyer_phone TEXT NOT NULL,
  seller_phone TEXT NOT NULL,
  distance_km NUMERIC,
  match_score NUMERIC,
  status TEXT DEFAULT 'suggested',
  buyer_notified_at TIMESTAMPTZ,
  seller_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.marketplace_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public all access" ON public.marketplace_matches;
DROP POLICY IF EXISTS "Public all access" ON public.marketplace_matches;
CREATE POLICY "Public all access" ON public.marketplace_matches FOR ALL USING (true) WITH CHECK (true);

-- =====================================================================
-- 5. RPC FUNCTIONS (Haversine)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.search_businesses_nearby(
  search_term TEXT,
  user_lat FLOAT,
  user_lng FLOAT,
  radius_km FLOAT DEFAULT 50,
  result_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT,
  city TEXT,
  address TEXT,
  phone TEXT,
  rating NUMERIC,
  lat DECIMAL(10,8),
  lng DECIMAL(11,8),
  distance_km FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bd.id,
    bd.name,
    bd.category,
    bd.city,
    bd.address,
    bd.phone,
    bd.rating,
    bd.lat,
    bd.lng,
    (
      6371 * acos(
        cos(radians(user_lat)) * cos(radians(bd.lat)) *
        cos(radians(bd.lng) - radians(user_lng)) +
        sin(radians(user_lat)) * sin(radians(bd.lat))
      )
    )::FLOAT AS distance_km
  FROM public.business_directory bd
  WHERE 
    (search_term IS NULL OR bd.name ILIKE '%' || search_term || '%' OR bd.category ILIKE '%' || search_term || '%')
    AND bd.lat IS NOT NULL 
    AND bd.lng IS NOT NULL
    AND (
      6371 * acos(
        cos(radians(user_lat)) * cos(radians(bd.lat)) *
        cos(radians(bd.lng) - radians(user_lng)) +
        sin(radians(user_lat)) * sin(radians(bd.lat))
      )
    ) <= radius_km
  ORDER BY distance_km ASC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.search_marketplace_listings_nearby(
  search_term TEXT,
  user_lat NUMERIC,
  user_lng NUMERIC,
  radius_km NUMERIC DEFAULT 10,
  result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  price NUMERIC,
  currency TEXT,
  seller_phone TEXT,
  distance_km NUMERIC,
  location_text TEXT,
  images TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.title,
    l.description,
    l.price,
    l.currency,
    l.seller_phone,
    (
      6371 * acos(
        cos(radians(user_lat)) * cos(radians(l.lat)) *
        cos(radians(l.lng) - radians(user_lng)) +
        sin(radians(user_lat)) * sin(radians(l.lat))
      )
    )::NUMERIC AS distance_km,
    l.location_text,
    l.images
  FROM public.marketplace_listings l
  WHERE l.status = 'active'
    AND l.lat IS NOT NULL
    AND l.lng IS NOT NULL
    AND (
      l.title ILIKE '%' || search_term || '%'
      OR l.product_name ILIKE '%' || search_term || '%'
      OR l.description ILIKE '%' || search_term || '%'
    )
    AND (
      6371 * acos(
        cos(radians(user_lat)) * cos(radians(l.lat)) *
        cos(radians(l.lng) - radians(user_lng)) +
        sin(radians(user_lat)) * sin(radians(l.lat))
      )
    ) <= radius_km
  ORDER BY distance_km ASC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.find_matching_marketplace_buyers(
  p_listing_id UUID
)
RETURNS TABLE (
  buyer_phone TEXT,
  distance_km NUMERIC,
  match_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT NULL::TEXT, 0::NUMERIC, 0::NUMERIC WHERE 1=0;
END;
$$ LANGUAGE plpgsql STABLE;

COMMIT;
