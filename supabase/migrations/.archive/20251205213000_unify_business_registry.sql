-- =====================================================================
-- UNIFY BUSINESS REGISTRY
-- =====================================================================
-- Goal: Consolidate 'business_directory' (legacy/scraped) into the 
-- main 'businesses' table (source of truth).
-- =====================================================================

BEGIN;

-- 1. Upgrade 'businesses' table with missing columns
--    (If they already exist, these are no-ops or harmless)

-- First, handle profile_id constraint for data migration
ALTER TABLE public.businesses ALTER COLUMN profile_id DROP NOT NULL;

ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS external_id TEXT UNIQUE;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Rwanda';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS lat DECIMAL(10, 8);
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS lng DECIMAL(11, 8);
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS rating DECIMAL(2, 1) DEFAULT 0.0;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS operating_hours JSONB;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS owner_whatsapp TEXT; -- Often used in 'create' logic
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS check_count INTEGER DEFAULT 0;

-- 2. Migrate Data from 'business_directory' to 'businesses'
--    Only migrate if 'business_directory' exists and has data.
--    We use ON CONFLICT DO NOTHING to avoid duplicates if external_id matches.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'business_directory') THEN
    INSERT INTO public.businesses (
      name, category, city, address, country, lat, lng, phone, 
      status, rating, external_id, created_at
    )
    SELECT 
      name, category, city, address, country, lat, lng, phone, 
      status, rating, external_id, created_at
    FROM public.business_directory
    ON CONFLICT (external_id) DO NOTHING;
    
    -- Now DROP the legacy table
    DROP TABLE public.business_directory CASCADE;
  END IF;
END $$;

-- 3. Cleanup Deprecated Marketplace Tables
--    As per user request: "remove references to marketplace"

DROP TABLE IF EXISTS public.marketplace_listings CASCADE;
DROP TABLE IF EXISTS public.marketplace_matches CASCADE;
DROP TABLE IF EXISTS public.marketplace_conversations CASCADE;
DROP TABLE IF EXISTS public.marketplace_transactions CASCADE;
DROP TABLE IF EXISTS public.marketplace_buyer_intents CASCADE;

-- 4. Update References / Search Functions
--    Re-create search RPC to point to 'businesses'

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
    b.id,
    b.name,
    b.category,
    b.city,
    b.address,
    b.phone,
    b.rating,
    b.lat,
    b.lng,
    (
      6371 * acos(
        cos(radians(user_lat)) * cos(radians(b.lat)) *
        cos(radians(b.lng) - radians(user_lng)) +
        sin(radians(user_lat)) * sin(radians(b.lat))
      )
    )::FLOAT AS distance_km
  FROM public.businesses b
  WHERE 
    status = 'active'
    AND b.lat IS NOT NULL 
    AND b.lng IS NOT NULL
    AND (
      search_term IS NULL 
      OR b.name ILIKE '%' || search_term || '%' 
      OR b.category ILIKE '%' || search_term || '%'
    )
    AND (
      6371 * acos(
        cos(radians(user_lat)) * cos(radians(b.lat)) *
        cos(radians(b.lng) - radians(user_lng)) +
        sin(radians(user_lat)) * sin(radians(b.lat))
      )
    ) <= radius_km
  ORDER BY distance_km ASC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Create Indexes for new columns on 'businesses' because it's now the heavy lifter
CREATE INDEX IF NOT EXISTS idx_businesses_location ON public.businesses (lat, lng);
CREATE INDEX IF NOT EXISTS idx_businesses_search_composite ON public.businesses (category, country, status);

COMMIT;
