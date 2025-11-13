-- Migration: Clean duplicates and add coordinates to bars/business tables
-- Date: 2025-11-12
-- Description: Remove duplicates, add lat/lng columns, and prepare for coordinate extraction

BEGIN;

-- =====================================================
-- PART 1: Add lat/lng columns to bars table
-- =====================================================

ALTER TABLE public.bars 
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location geography(Point, 4326);

-- Add index for geospatial queries
CREATE INDEX IF NOT EXISTS idx_bars_location 
  ON public.bars USING GIST (location);

-- =====================================================
-- PART 2: Remove duplicates from bars table
-- =====================================================

-- Create a temporary table with unique bars (keep oldest by created_at)
CREATE TEMP TABLE bars_unique AS
SELECT DISTINCT ON (slug) *
FROM public.bars
ORDER BY slug, created_at ASC;

-- Count duplicates before deletion
DO $$
DECLARE
  v_total_count INTEGER;
  v_unique_count INTEGER;
  v_duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_count FROM public.bars;
  SELECT COUNT(*) INTO v_unique_count FROM bars_unique;
  v_duplicate_count := v_total_count - v_unique_count;
  
  RAISE NOTICE 'Bars table: Total records: %, Unique: %, Duplicates to remove: %', 
    v_total_count, v_unique_count, v_duplicate_count;
END $$;

-- Delete all records and reinsert unique ones
TRUNCATE TABLE public.bars CASCADE;

INSERT INTO public.bars 
SELECT * FROM bars_unique;

-- =====================================================
-- PART 3: Remove duplicates from business table
-- =====================================================

-- Create temporary table with unique businesses (keep oldest by created_at)
CREATE TEMP TABLE business_unique AS
SELECT DISTINCT ON (LOWER(TRIM(name)), LOWER(TRIM(COALESCE(location_text, '')))) *
FROM public.business
ORDER BY LOWER(TRIM(name)), LOWER(TRIM(COALESCE(location_text, ''))), created_at ASC;

-- Count duplicates
DO $$
DECLARE
  v_total_count INTEGER;
  v_unique_count INTEGER;
  v_duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_count FROM public.business;
  SELECT COUNT(*) INTO v_unique_count FROM business_unique;
  v_duplicate_count := v_total_count - v_unique_count;
  
  RAISE NOTICE 'Business table: Total records: %, Unique: %, Duplicates to remove: %', 
    v_total_count, v_unique_count, v_duplicate_count;
END $$;

-- Delete all and reinsert unique records
TRUNCATE TABLE public.business CASCADE;

INSERT INTO public.business 
SELECT * FROM business_unique;

-- =====================================================
-- PART 4: Create function to extract coordinates from Google Maps URLs
-- =====================================================

CREATE OR REPLACE FUNCTION public.extract_coordinates_from_google_maps_url(url TEXT)
RETURNS TABLE (lat DOUBLE PRECISION, lng DOUBLE PRECISION) AS $$
DECLARE
  coordinates_match TEXT;
  lat_str TEXT;
  lng_str TEXT;
BEGIN
  -- Pattern 1: @-1.234567,30.123456 (most common in Google Maps URLs)
  coordinates_match := (regexp_matches(url, '@(-?\d+\.?\d*),(-?\d+\.?\d*)', 'g'))[1];
  
  IF coordinates_match IS NOT NULL THEN
    lat_str := (regexp_matches(url, '@(-?\d+\.?\d*),(-?\d+\.?\d*)', 'g'))[1];
    lng_str := (regexp_matches(url, '@(-?\d+\.?\d*),(-?\d+\.?\d*)', 'g'))[2];
    
    IF lat_str IS NOT NULL AND lng_str IS NOT NULL THEN
      RETURN QUERY SELECT lat_str::DOUBLE PRECISION, lng_str::DOUBLE PRECISION;
      RETURN;
    END IF;
  END IF;
  
  -- Pattern 2: query parameter format (less common)
  coordinates_match := (regexp_matches(url, 'query=(-?\d+\.?\d*),(-?\d+\.?\d*)', 'g'))[1];
  
  IF coordinates_match IS NOT NULL THEN
    lat_str := (regexp_matches(url, 'query=(-?\d+\.?\d*),(-?\d+\.?\d*)', 'g'))[1];
    lng_str := (regexp_matches(url, 'query=(-?\d+\.?\d*),(-?\d+\.?\d*)', 'g'))[2];
    
    IF lat_str IS NOT NULL AND lng_str IS NOT NULL THEN
      RETURN QUERY SELECT lat_str::DOUBLE PRECISION, lng_str::DOUBLE PRECISION;
      RETURN;
    END IF;
  END IF;
  
  -- No coordinates found
  RETURN QUERY SELECT NULL::DOUBLE PRECISION, NULL::DOUBLE PRECISION;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- PART 5: Function to update location geography from lat/lng
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_location_from_coordinates()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for bars table
DROP TRIGGER IF EXISTS bars_update_location ON public.bars;
CREATE TRIGGER bars_update_location
  BEFORE INSERT OR UPDATE OF lat, lng ON public.bars
  FOR EACH ROW
  EXECUTE FUNCTION public.update_location_from_coordinates();

-- Create triggers for business table
DROP TRIGGER IF EXISTS business_update_location ON public.business;
CREATE TRIGGER business_update_location
  BEFORE INSERT OR UPDATE OF lat, lng ON public.business
  FOR EACH ROW
  EXECUTE FUNCTION public.update_location_from_coordinates();

-- =====================================================
-- PART 6: Extract and populate coordinates for bars
-- =====================================================

WITH extracted_coords AS (
  SELECT 
    id,
    (public.extract_coordinates_from_google_maps_url(catalog_url)).lat as extracted_lat,
    (public.extract_coordinates_from_google_maps_url(catalog_url)).lng as extracted_lng
  FROM public.bars
  WHERE catalog_url IS NOT NULL
    AND catalog_url LIKE '%google.com%'
    AND (lat IS NULL OR lng IS NULL)
)
UPDATE public.bars
SET 
  lat = extracted_coords.extracted_lat,
  lng = extracted_coords.extracted_lng
FROM extracted_coords
WHERE bars.id = extracted_coords.id
  AND extracted_coords.extracted_lat IS NOT NULL
  AND extracted_coords.extracted_lng IS NOT NULL;

-- Log results
DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_updated_count 
  FROM public.bars 
  WHERE lat IS NOT NULL AND lng IS NOT NULL;
  
  RAISE NOTICE 'Bars with coordinates: %', v_updated_count;
END $$;

-- =====================================================
-- PART 7: Extract and populate coordinates for business
-- =====================================================

WITH extracted_coords AS (
  SELECT 
    id,
    (public.extract_coordinates_from_google_maps_url(catalog_url)).lat as extracted_lat,
    (public.extract_coordinates_from_google_maps_url(catalog_url)).lng as extracted_lng
  FROM public.business
  WHERE catalog_url IS NOT NULL
    AND catalog_url LIKE '%google.com%'
    AND (lat IS NULL OR lng IS NULL)
)
UPDATE public.business
SET 
  lat = extracted_coords.extracted_lat,
  lng = extracted_coords.extracted_lng
FROM extracted_coords
WHERE business.id = extracted_coords.id
  AND extracted_coords.extracted_lat IS NOT NULL
  AND extracted_coords.extracted_lng IS NOT NULL;

-- Log results
DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_updated_count 
  FROM public.business 
  WHERE lat IS NOT NULL AND lng IS NOT NULL;
  
  RAISE NOTICE 'Businesses with coordinates: %', v_updated_count;
END $$;

-- =====================================================
-- PART 8: Add helper function to find nearby businesses/bars
-- =====================================================

CREATE OR REPLACE FUNCTION public.find_nearby_bars(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_km DOUBLE PRECISION DEFAULT 5.0,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  distance_meters NUMERIC,
  location_text TEXT
) AS $$
DECLARE
  v_point geography;
BEGIN
  v_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.slug,
    ST_Distance(b.location, v_point)::NUMERIC as distance_meters,
    b.location_text
  FROM public.bars b
  WHERE b.location IS NOT NULL
    AND ST_DWithin(b.location, v_point, p_radius_km * 1000)
  ORDER BY b.location <-> v_point
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.find_nearby_businesses(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_category_id TEXT DEFAULT NULL,
  p_radius_km DOUBLE PRECISION DEFAULT 5.0,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  category_id TEXT,
  distance_meters NUMERIC,
  location_text TEXT
) AS $$
DECLARE
  v_point geography;
BEGIN
  v_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.description,
    b.category_id,
    ST_Distance(b.location, v_point)::NUMERIC as distance_meters,
    b.location_text
  FROM public.business b
  WHERE b.location IS NOT NULL
    AND (p_category_id IS NULL OR b.category_id = p_category_id)
    AND ST_DWithin(b.location, v_point, p_radius_km * 1000)
  ORDER BY b.location <-> v_point
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.extract_coordinates_from_google_maps_url(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_nearby_bars(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_nearby_businesses(DOUBLE PRECISION, DOUBLE PRECISION, TEXT, DOUBLE PRECISION, INTEGER) TO authenticated, service_role;

COMMIT;

-- Final summary
DO $$
DECLARE
  v_bars_total INTEGER;
  v_bars_with_coords INTEGER;
  v_business_total INTEGER;
  v_business_with_coords INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_bars_total FROM public.bars;
  SELECT COUNT(*) INTO v_bars_with_coords FROM public.bars WHERE lat IS NOT NULL AND lng IS NOT NULL;
  SELECT COUNT(*) INTO v_business_total FROM public.business;
  SELECT COUNT(*) INTO v_business_with_coords FROM public.business WHERE lat IS NOT NULL AND lng IS NOT NULL;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Bars: % total, % with coordinates (%.1f%%)', 
    v_bars_total, v_bars_with_coords, 
    (v_bars_with_coords::NUMERIC / NULLIF(v_bars_total, 0) * 100);
  RAISE NOTICE 'Businesses: % total, % with coordinates (%.1f%%)', 
    v_business_total, v_business_with_coords,
    (v_business_with_coords::NUMERIC / NULLIF(v_business_total, 0) * 100);
  RAISE NOTICE '========================================';
END $$;
