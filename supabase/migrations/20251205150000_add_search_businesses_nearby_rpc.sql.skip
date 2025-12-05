-- =====================================================================
-- ADD SEARCH_BUSINESSES_NEARBY RPC FUNCTION
-- =====================================================================
-- This migration adds the missing search_businesses_nearby function
-- that is required by the buy_and_sell agent and wa-webhook-buy-sell
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. ENSURE HAVERSINE FUNCTION EXISTS
-- =====================================================================

CREATE OR REPLACE FUNCTION public.haversine_km(
  lat1 double precision, 
  lng1 double precision, 
  lat2 double precision, 
  lng2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 2 * 6371 * asin(
    sqrt(
      pow(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) * pow(sin(radians(lng2 - lng1) / 2), 2)
    )
  );
$$;

-- =====================================================================
-- 2. ENSURE BUSINESS_DIRECTORY TABLE HAS REQUIRED COLUMNS
-- =====================================================================

-- Add geolocation columns if they don't exist
ALTER TABLE public.business_directory 
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

-- Add category column if it doesn't exist
ALTER TABLE public.business_directory 
  ADD COLUMN IF NOT EXISTS category text;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_business_directory_category 
  ON public.business_directory (category);

CREATE INDEX IF NOT EXISTS idx_business_directory_lat_lng 
  ON public.business_directory (lat, lng) 
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_directory_status_active 
  ON public.business_directory (status) 
  WHERE status != 'DO_NOT_CALL' OR status IS NULL;

-- =====================================================================
-- 3. CREATE SEARCH_BUSINESSES_NEARBY FUNCTION
-- =====================================================================

CREATE OR REPLACE FUNCTION public.search_businesses_nearby(
  search_term text,
  user_lat double precision,
  user_lng double precision,
  radius_km double precision DEFAULT 10,
  result_limit integer DEFAULT 9
)
RETURNS TABLE(
  id uuid,
  name text,
  category text,
  city text,
  address text,
  phone text,
  rating double precision,
  distance_km double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    b.id,
    b.name,
    b.category,
    b.city,
    b.address,
    b.phone,
    b.rating,
    CASE
      WHEN b.lat IS NULL OR b.lng IS NULL THEN NULL
      ELSE public.haversine_km(b.lat, b.lng, user_lat, user_lng)
    END AS distance_km
  FROM public.business_directory b
  WHERE 
    -- Status filter: exclude DO_NOT_CALL
    (b.status IS NULL OR b.status != 'DO_NOT_CALL')
    -- Search term filter: match name, category, or city
    AND (
      search_term IS NULL 
      OR search_term = ''
      OR lower(coalesce(b.name, '')) LIKE lower('%' || search_term || '%')
      OR lower(coalesce(b.category, '')) LIKE lower('%' || search_term || '%')
      OR lower(coalesce(b.city, '')) LIKE lower('%' || search_term || '%')
    )
    -- Radius filter: only if coordinates are provided
    AND (
      user_lat IS NULL 
      OR user_lng IS NULL
      OR b.lat IS NULL 
      OR b.lng IS NULL
      OR public.haversine_km(b.lat, b.lng, user_lat, user_lng) <= radius_km
    )
  ORDER BY 
    -- Sort by distance first (nulls last)
    CASE
      WHEN b.lat IS NULL OR b.lng IS NULL THEN 999999
      ELSE public.haversine_km(b.lat, b.lng, user_lat, user_lng)
    END ASC,
    -- Then by rating (nulls last)
    b.rating DESC NULLS LAST,
    -- Then by name
    b.name ASC
  LIMIT result_limit;
$$;

-- Grant execute permission to service role and authenticated users
GRANT EXECUTE ON FUNCTION public.search_businesses_nearby(text, double precision, double precision, double precision, integer) 
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_businesses_nearby(text, double precision, double precision, double precision, integer) 
  TO service_role;

-- =====================================================================
-- 4. CREATE SEARCH_MARKETPLACE_LISTINGS_NEARBY FUNCTION
-- =====================================================================

-- Ensure marketplace_listings table exists with required columns
CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_phone text NOT NULL,
  seller_name text,
  listing_type text DEFAULT 'product',
  title text NOT NULL,
  product_name text,
  description text,
  price numeric,
  price_negotiable boolean DEFAULT true,
  currency text DEFAULT 'RWF',
  lat double precision,
  lng double precision,
  location_text text,
  photos text[],
  attributes jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status 
  ON public.marketplace_listings (status) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller 
  ON public.marketplace_listings (seller_phone);

CREATE OR REPLACE FUNCTION public.search_marketplace_listings_nearby(
  search_term text,
  user_lat double precision,
  user_lng double precision,
  radius_km double precision DEFAULT 10,
  result_limit integer DEFAULT 9
)
RETURNS TABLE(
  id uuid,
  title text,
  product_name text,
  description text,
  price numeric,
  currency text,
  seller_phone text,
  distance_km double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    l.id,
    l.title,
    l.product_name,
    l.description,
    l.price,
    l.currency,
    l.seller_phone,
    CASE
      WHEN l.lat IS NULL OR l.lng IS NULL THEN NULL
      ELSE public.haversine_km(l.lat, l.lng, user_lat, user_lng)
    END AS distance_km
  FROM public.marketplace_listings l
  WHERE 
    l.status = 'active'
    AND (
      search_term IS NULL 
      OR search_term = ''
      OR lower(coalesce(l.title, '')) LIKE lower('%' || search_term || '%')
      OR lower(coalesce(l.product_name, '')) LIKE lower('%' || search_term || '%')
      OR lower(coalesce(l.description, '')) LIKE lower('%' || search_term || '%')
    )
    AND (
      user_lat IS NULL 
      OR user_lng IS NULL
      OR l.lat IS NULL 
      OR l.lng IS NULL
      OR public.haversine_km(l.lat, l.lng, user_lat, user_lng) <= radius_km
    )
  ORDER BY 
    CASE
      WHEN l.lat IS NULL OR l.lng IS NULL THEN 999999
      ELSE public.haversine_km(l.lat, l.lng, user_lat, user_lng)
    END ASC,
    l.price ASC NULLS LAST,
    l.created_at DESC
  LIMIT result_limit;
$$;

GRANT EXECUTE ON FUNCTION public.search_marketplace_listings_nearby(text, double precision, double precision, double precision, integer) 
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_marketplace_listings_nearby(text, double precision, double precision, double precision, integer) 
  TO service_role;

-- =====================================================================
-- 5. CREATE MARKETPLACE_CONVERSATIONS TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.marketplace_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text UNIQUE NOT NULL,
  flow_type text,
  flow_step text,
  collected_data jsonb DEFAULT '{}'::jsonb,
  conversation_history jsonb DEFAULT '[]'::jsonb,
  last_ai_response text,
  current_listing_id uuid,
  current_intent_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_conversations_phone 
  ON public.marketplace_conversations (phone);

-- =====================================================================
-- 6. CREATE MARKETPLACE_BUYER_INTENTS TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.marketplace_buyer_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_phone text NOT NULL,
  looking_for text NOT NULL,
  intent_type text DEFAULT 'product',
  lat double precision,
  lng double precision,
  max_radius_km double precision DEFAULT 10,
  max_price numeric,
  min_price numeric,
  matched_listing_ids uuid[],
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_buyer_intents_phone 
  ON public.marketplace_buyer_intents (buyer_phone);

CREATE INDEX IF NOT EXISTS idx_marketplace_buyer_intents_status 
  ON public.marketplace_buyer_intents (status);

-- =====================================================================
-- 7. CREATE MARKETPLACE_MATCHES TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.marketplace_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  buyer_phone text NOT NULL,
  seller_phone text NOT NULL,
  distance_km double precision,
  match_score double precision,
  status text DEFAULT 'suggested',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_matches_listing 
  ON public.marketplace_matches (listing_id);

CREATE INDEX IF NOT EXISTS idx_marketplace_matches_buyer 
  ON public.marketplace_matches (buyer_phone);

CREATE INDEX IF NOT EXISTS idx_marketplace_matches_status 
  ON public.marketplace_matches (status);

-- =====================================================================
-- 8. CREATE FIND_MATCHING_MARKETPLACE_BUYERS FUNCTION
-- =====================================================================

CREATE OR REPLACE FUNCTION public.find_matching_marketplace_buyers(
  p_listing_id uuid
)
RETURNS TABLE(
  buyer_phone text,
  distance_km double precision,
  match_score double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    i.buyer_phone,
    CASE
      WHEN l.lat IS NULL OR l.lng IS NULL OR i.lat IS NULL OR i.lng IS NULL THEN NULL
      ELSE public.haversine_km(l.lat, l.lng, i.lat, i.lng)
    END AS distance_km,
    -- Simple match score based on distance and text similarity
    CASE
      WHEN l.lat IS NULL OR l.lng IS NULL OR i.lat IS NULL OR i.lng IS NULL THEN 0.5
      ELSE 1.0 - LEAST(public.haversine_km(l.lat, l.lng, i.lat, i.lng) / 10.0, 1.0)
    END AS match_score
  FROM public.marketplace_listings l
  CROSS JOIN public.marketplace_buyer_intents i
  WHERE 
    l.id = p_listing_id
    AND l.status = 'active'
    AND i.status = 'active'
    -- Text matching
    AND (
      lower(coalesce(l.title, '')) LIKE lower('%' || i.looking_for || '%')
      OR lower(coalesce(l.product_name, '')) LIKE lower('%' || i.looking_for || '%')
      OR lower(coalesce(l.description, '')) LIKE lower('%' || i.looking_for || '%')
    )
    -- Distance check (if both have coordinates)
    AND (
      l.lat IS NULL 
      OR l.lng IS NULL 
      OR i.lat IS NULL 
      OR i.lng IS NULL
      OR public.haversine_km(l.lat, l.lng, i.lat, i.lng) <= COALESCE(i.max_radius_km, 10)
    )
  ORDER BY match_score DESC
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION public.find_matching_marketplace_buyers(uuid) 
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_matching_marketplace_buyers(uuid) 
  TO service_role;

-- =====================================================================
-- 9. ADD BUSINESS CATEGORIES (for 9 main categories)
-- =====================================================================

-- Create business_categories table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.business_categories (
  id serial PRIMARY KEY,
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  icon text NOT NULL,
  description text,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Insert 9 main business categories
INSERT INTO public.business_categories (code, name, icon, description, display_order) VALUES
  ('pharmacy', 'Pharmacies', '💊', 'Pharmacies and medical supplies', 1),
  ('salon', 'Salons & Barbers', '💇', 'Hair salons, barber shops, beauty services', 2),
  ('restaurant', 'Restaurants', '🍽️', 'Restaurants, cafes, and food services', 3),
  ('supermarket', 'Supermarkets', '🛒', 'Supermarkets and grocery stores', 4),
  ('hardware', 'Hardware Stores', '🔧', 'Hardware stores and construction supplies', 5),
  ('bank', 'Banks & Finance', '🏦', 'Banks, microfinance, and mobile money', 6),
  ('hospital', 'Hospitals & Clinics', '🏥', 'Hospitals, clinics, and health centers', 7),
  ('hotel', 'Hotels & Lodging', '🏨', 'Hotels, guesthouses, and accommodations', 8),
  ('transport', 'Transport & Logistics', '🚗', 'Transport services, taxis, and delivery', 9)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = true;

-- =====================================================================
-- 10. RLS POLICIES
-- =====================================================================

-- Enable RLS on new tables
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_buyer_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow authenticated read on marketplace_listings" ON public.marketplace_listings;
DROP POLICY IF EXISTS "Allow authenticated insert on marketplace_listings" ON public.marketplace_listings;
DROP POLICY IF EXISTS "Allow service role full access on marketplace_listings" ON public.marketplace_listings;
DROP POLICY IF EXISTS "Allow service role full access on marketplace_conversations" ON public.marketplace_conversations;
DROP POLICY IF EXISTS "Allow service role full access on marketplace_buyer_intents" ON public.marketplace_buyer_intents;
DROP POLICY IF EXISTS "Allow service role full access on marketplace_matches" ON public.marketplace_matches;
DROP POLICY IF EXISTS "Allow authenticated read on business_categories" ON public.business_categories;

-- Create policies
CREATE POLICY "Allow authenticated read on marketplace_listings" 
  ON public.marketplace_listings FOR SELECT 
  TO authenticated 
  USING (status = 'active');

CREATE POLICY "Allow authenticated insert on marketplace_listings" 
  ON public.marketplace_listings FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Allow service role full access on marketplace_listings" 
  ON public.marketplace_listings FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Allow service role full access on marketplace_conversations" 
  ON public.marketplace_conversations FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Allow service role full access on marketplace_buyer_intents" 
  ON public.marketplace_buyer_intents FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Allow service role full access on marketplace_matches" 
  ON public.marketplace_matches FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Allow authenticated read on business_categories" 
  ON public.business_categories FOR SELECT 
  TO authenticated 
  USING (is_active = true);

-- Allow anon access to read business_categories for menu display
DROP POLICY IF EXISTS "Allow anon read on business_categories" ON public.business_categories;
CREATE POLICY "Allow anon read on business_categories" 
  ON public.business_categories FOR SELECT 
  TO anon 
  USING (is_active = true);

COMMIT;
