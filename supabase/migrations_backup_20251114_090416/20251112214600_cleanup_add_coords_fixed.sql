-- Migration: Cleanup duplicates and add geolocation coordinates
-- Date: 2025-11-12
-- Description: Remove duplicate entries from bars and business tables, add lat/lng columns to bars, and extract coordinates from Google Maps URLs

BEGIN;

-- =====================================================
-- STEP 1: Add lat/lng columns to bars table if they don't exist
-- =====================================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'bars' 
                 AND column_name = 'lat') THEN
    ALTER TABLE public.bars ADD COLUMN lat DOUBLE PRECISION;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'bars' 
                 AND column_name = 'lng') THEN
    ALTER TABLE public.bars ADD COLUMN lng DOUBLE PRECISION;
  END IF;
END $$;

-- Add index for geospatial queries
CREATE INDEX IF NOT EXISTS idx_bars_lat_lng ON public.bars(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- =====================================================
-- STEP 2: Clean up duplicates from bars table
-- =====================================================

-- Backup current data
CREATE TEMP TABLE bars_backup AS SELECT * FROM public.bars;

-- Check for duplicates
DO $$
DECLARE
  total_count INT;
  unique_count INT;
  duplicate_count INT;
BEGIN
  SELECT COUNT(*) INTO total_count FROM bars_backup;
  SELECT COUNT(DISTINCT slug) INTO unique_count FROM bars_backup;
  duplicate_count := total_count - unique_count;
  
  RAISE NOTICE 'Bars table: Total records: %, Unique: %, Duplicates to remove: %', 
    total_count, unique_count, duplicate_count;
END $$;

-- Remove all and reinsert unique records (keeping the newest by created_at)
TRUNCATE TABLE public.bars CASCADE;

INSERT INTO public.bars
SELECT DISTINCT ON (slug) *
FROM bars_backup
ORDER BY slug, created_at DESC;

-- =====================================================
-- STEP 3: Clean up duplicates from business table
-- =====================================================

-- Backup current data
CREATE TEMP TABLE business_backup AS SELECT * FROM public.business;

-- Check for duplicates
DO $$
DECLARE
  total_count INT;
  unique_count INT;
  duplicate_count INT;
BEGIN
  SELECT COUNT(*) INTO total_count FROM business_backup;
  SELECT COUNT(DISTINCT name) INTO unique_count FROM business_backup;
  duplicate_count := total_count - unique_count;
  
  RAISE NOTICE 'Business table: Total records: %, Unique: %, Duplicates to remove: %', 
    total_count, unique_count, duplicate_count;
END $$;

-- Remove all and reinsert unique records (keeping the newest by created_at)
TRUNCATE TABLE public.business CASCADE;

INSERT INTO public.business
SELECT DISTINCT ON (name) *
FROM business_backup
ORDER BY name, created_at DESC;

-- =====================================================
-- STEP 4: Create function to extract coordinates from Google Maps URLs
-- =====================================================

CREATE OR REPLACE FUNCTION public.extract_coordinates_from_google_maps_url(url TEXT)
RETURNS TABLE (lat DOUBLE PRECISION, lng DOUBLE PRECISION)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  coord_pattern TEXT := '@(-?\d+\.?\d*),(-?\d+\.?\d*)';
  query_pattern TEXT := 'query=([^&]+)';
  matches TEXT[];
BEGIN
  -- Try to extract from @lat,lng format
  matches := regexp_matches(url, coord_pattern);
  IF array_length(matches, 1) = 2 THEN
    RETURN QUERY SELECT matches[1]::DOUBLE PRECISION, matches[2]::DOUBLE PRECISION;
    RETURN;
  END IF;
  
  -- No coordinates found
  RETURN QUERY SELECT NULL::DOUBLE PRECISION, NULL::DOUBLE PRECISION;
END;
$$;

-- Create function to parse plus code coordinates (e.g., "24F3+WVC")
CREATE OR REPLACE FUNCTION public.parse_plus_code_coordinates(plus_code TEXT)
RETURNS TABLE (lat DOUBLE PRECISION, lng DOUBLE PRECISION)
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Plus codes require external API to decode accurately
  -- For now, return NULL (can be enhanced later with proper plus code library)
  RETURN QUERY SELECT NULL::DOUBLE PRECISION, NULL::DOUBLE PRECISION;
END;
$$;

-- =====================================================
-- STEP 5: Create triggers to auto-update lat/lng when google_maps_url changes
-- =====================================================

-- Trigger function for bars table
CREATE OR REPLACE FUNCTION public.bars_update_location_from_url()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  coords RECORD;
BEGIN
  IF NEW.google_maps_url IS NOT NULL AND NEW.google_maps_url != '' THEN
    SELECT * INTO coords FROM public.extract_coordinates_from_google_maps_url(NEW.google_maps_url);
    IF coords.lat IS NOT NULL THEN
      NEW.lat := coords.lat;
      NEW.lng := coords.lng;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bars_update_location ON public.bars;
CREATE TRIGGER bars_update_location
  BEFORE INSERT OR UPDATE OF google_maps_url
  ON public.bars
  FOR EACH ROW
  EXECUTE FUNCTION public.bars_update_location_from_url();

-- Trigger function for business table  
CREATE OR REPLACE FUNCTION public.business_update_location_from_url()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  coords RECORD;
BEGIN
  IF NEW.catalog_url IS NOT NULL AND NEW.catalog_url != '' THEN
    SELECT * INTO coords FROM public.extract_coordinates_from_google_maps_url(NEW.catalog_url);
    IF coords.lat IS NOT NULL THEN
      NEW.lat := coords.lat;
      NEW.lng := coords.lng;
      -- Also update the PostGIS location column
      NEW.location := ST_SetSRID(ST_MakePoint(coords.lng, coords.lat), 4326)::geography;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_update_location ON public.business;
CREATE TRIGGER business_update_location
  BEFORE INSERT OR UPDATE OF catalog_url
  ON public.business
  FOR EACH ROW
  EXECUTE FUNCTION public.business_update_location_from_url();

-- =====================================================
-- STEP 6: Extract coordinates from existing Google Maps URLs
-- =====================================================

-- Update bars table with coordinates from google_maps_url
UPDATE public.bars
SET (lat, lng) = (
  SELECT coords.lat, coords.lng 
  FROM public.extract_coordinates_from_google_maps_url(google_maps_url) AS coords
)
WHERE google_maps_url IS NOT NULL 
  AND google_maps_url != ''
  AND lat IS NULL;

-- Update business table with coordinates from catalog_url
UPDATE public.business b
SET 
  lat = subquery.lat,
  lng = subquery.lng,
  location = CASE 
    WHEN subquery.lat IS NOT NULL AND subquery.lng IS NOT NULL 
    THEN ST_SetSRID(ST_MakePoint(subquery.lng, subquery.lat), 4326)::geography
    ELSE b.location
  END
FROM (
  SELECT 
    id,
    (public.extract_coordinates_from_google_maps_url(catalog_url)).*
  FROM public.business
  WHERE catalog_url IS NOT NULL 
    AND catalog_url != ''
    AND lat IS NULL
) AS subquery
WHERE b.id = subquery.id;

-- =====================================================
-- STEP 7: Create helper functions for distance calculations
-- =====================================================

-- Function to calculate distance between two points (Haversine formula)
CREATE OR REPLACE FUNCTION public.calculate_distance_km(
  lat1 DOUBLE PRECISION,
  lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lng2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  earth_radius CONSTANT DOUBLE PRECISION := 6371; -- Earth's radius in kilometers
  dlat DOUBLE PRECISION;
  dlng DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  IF lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN
    RETURN NULL;
  END IF;
  
  dlat := radians(lat2 - lat1);
  dlng := radians(lng2 - lng1);
  
  a := sin(dlat/2) * sin(dlat/2) + 
       cos(radians(lat1)) * cos(radians(lat2)) * 
       sin(dlng/2) * sin(dlng/2);
  
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  
  RETURN earth_radius * c;
END;
$$;

-- Function to find nearby bars
CREATE OR REPLACE FUNCTION public.find_nearby_bars(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 10,
  limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  bar_id UUID,
  bar_name TEXT,
  distance_km DOUBLE PRECISION,
  location_text TEXT,
  google_maps_url TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    public.calculate_distance_km(user_lat, user_lng, b.lat, b.lng) AS distance_km,
    b.location_text,
    b.google_maps_url
  FROM public.bars b
  WHERE b.is_active = TRUE
    AND b.lat IS NOT NULL
    AND b.lng IS NOT NULL
    AND public.calculate_distance_km(user_lat, user_lng, b.lat, b.lng) <= radius_km
  ORDER BY distance_km ASC
  LIMIT limit_count;
END;
$$;

-- Function to find nearby businesses
CREATE OR REPLACE FUNCTION public.find_nearby_businesses(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 10,
  category_filter TEXT DEFAULT NULL,
  limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  business_id UUID,
  business_name TEXT,
  distance_km DOUBLE PRECISION,
  location_text TEXT,
  category_id TEXT,
  catalog_url TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    public.calculate_distance_km(user_lat, user_lng, b.lat, b.lng) AS distance_km,
    b.location_text,
    b.category_id,
    b.catalog_url
  FROM public.business b
  WHERE b.is_active = TRUE
    AND b.lat IS NOT NULL
    AND b.lng IS NOT NULL
    AND public.calculate_distance_km(user_lat, user_lng, b.lat, b.lng) <= radius_km
    AND (category_filter IS NULL OR b.category_id = category_filter)
  ORDER BY distance_km ASC
  LIMIT limit_count;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.extract_coordinates_from_google_maps_url(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.parse_plus_code_coordinates(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calculate_distance_km(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.find_nearby_bars(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.find_nearby_businesses(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, INTEGER) TO authenticated, service_role, anon;

COMMIT;

-- =====================================================
-- STEP 8: Report statistics
-- =====================================================

DO $$
DECLARE
  bars_with_coords INT;
  bars_total INT;
  business_with_coords INT;
  business_total INT;
BEGIN
  SELECT COUNT(*) INTO bars_total FROM public.bars;
  SELECT COUNT(*) INTO business_total FROM public.business;
  
  -- Bars table might not have lat/lng columns created yet
  BEGIN
    SELECT COUNT(*) INTO bars_with_coords 
    FROM public.bars WHERE lat IS NOT NULL AND lng IS NOT NULL;
  EXCEPTION WHEN undefined_column THEN
    bars_with_coords := 0;
  END;
  
  SELECT COUNT(*) INTO business_with_coords 
  FROM public.business WHERE lat IS NOT NULL AND lng IS NOT NULL;
  
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Migration Complete!';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Bars: % of % have coordinates (%.1f%%)', 
    bars_with_coords, bars_total, 
    CASE WHEN bars_total > 0 THEN (bars_with_coords::FLOAT / bars_total * 100) ELSE 0 END;
  RAISE NOTICE 'Businesses: % of % have coordinates (%.1f%%)', 
    business_with_coords, business_total,
    CASE WHEN business_total > 0 THEN (business_with_coords::FLOAT / business_total * 100) ELSE 0 END;
  RAISE NOTICE '==========================================';
END $$;
