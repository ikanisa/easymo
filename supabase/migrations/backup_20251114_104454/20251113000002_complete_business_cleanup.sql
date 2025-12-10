-- Migration: Complete business table cleanup
-- Works with existing schema where businesses is a view over business table

BEGIN;

-- ============================================
-- STEP 1: Update service_categories
-- ============================================

-- Add updated_at if missing
ALTER TABLE public.service_categories 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Ensure all 6 categories exist with correct data
INSERT INTO public.service_categories (key, label, description, icon_emoji, sort_order)
VALUES
  ('pharmacies', 'Pharmacies', 'Medical pharmacies and drugstores', '💊', 10),
  ('quincailleries', 'Quincailleries', 'Hardware stores and building materials', '🔧', 20),
  ('shops_services', 'Shops & Services', 'General shops and service providers', '🏬', 30),
  ('property_rentals', 'Property Rentals', 'Houses, apartments, and rental properties', '🏡', 40),
  ('notary_services', 'Notary Services', 'Legal notary and documentation services', '📜', 50),
  ('bars_restaurants', 'Bars & Restaurants', 'Dining, bars, and food establishments', '🍽️', 60)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  icon_emoji = EXCLUDED.icon_emoji,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = now();

-- ============================================
-- STEP 2: Add missing columns to business table
-- ============================================

-- Rename new_category_id to category_id for consistency
ALTER TABLE public.business 
  DROP COLUMN IF EXISTS category_uuid CASCADE;

-- Use new_category_id as the main category reference
-- (it already exists and has FK constraint)
COMMENT ON COLUMN public.business.new_category_id IS 'FK to service_categories.id';

-- Ensure we have maps_url column (migrate from location_url if needed)
ALTER TABLE public.business 
  ADD COLUMN IF NOT EXISTS maps_url TEXT;

UPDATE public.business 
SET maps_url = location_url
WHERE location_url IS NOT NULL 
  AND location_url != ''
  AND (maps_url IS NULL OR maps_url = '');

-- ============================================
-- STEP 3: Map existing tags to category UUIDs
-- ============================================

-- Direct tag-to-category mapping
UPDATE public.business b
SET 
  new_category_id = sc.id,
  category_name = sc.label
FROM public.service_categories sc
WHERE b.tag = sc.key
  AND (b.new_category_id IS NULL OR b.category_name IS NULL);

-- Map bar/restaurant variants
UPDATE public.business b
SET 
  new_category_id = sc.id,
  category_name = sc.label
FROM public.service_categories sc
WHERE sc.key = 'bars_restaurants'
  AND (
    b.tag IN ('bar', 'restaurant', 'bars', 'restaurants', 'bar_restaurant', 'bars_restaurants')
    OR b.tag ILIKE '%bar%'
    OR b.tag ILIKE '%restaurant%'
    OR b.name ILIKE '%bar%'
    OR b.name ILIKE '%restaurant%'
  )
  AND (b.new_category_id IS NULL OR b.category_name IS NULL);

-- Map pharmacy variants
UPDATE public.business b
SET 
  new_category_id = sc.id,
  category_name = sc.label
FROM public.service_categories sc
WHERE sc.key = 'pharmacies'
  AND (
    b.tag ILIKE '%pharm%' 
    OR b.name ILIKE '%pharm%'
  )
  AND (b.new_category_id IS NULL OR b.category_name IS NULL);

-- Map quincaillerie/hardware variants
UPDATE public.business b
SET 
  new_category_id = sc.id,
  category_name = sc.label
FROM public.service_categories sc
WHERE sc.key = 'quincailleries'
  AND (
    b.tag ILIKE '%quinca%' 
    OR b.name ILIKE '%quinca%' 
    OR b.name ILIKE '%hardware%'
    OR b.tag ILIKE '%hardware%'
  )
  AND (b.new_category_id IS NULL OR b.category_name IS NULL);

-- Map property rentals
UPDATE public.business b
SET 
  new_category_id = sc.id,
  category_name = sc.label
FROM public.service_categories sc
WHERE sc.key = 'property_rentals'
  AND (
    b.tag ILIKE '%rental%' 
    OR b.tag ILIKE '%property%'
    OR b.name ILIKE '%rental%'
    OR b.name ILIKE '%property%'
    OR b.name ILIKE '%estate%'
  )
  AND (b.new_category_id IS NULL OR b.category_name IS NULL);

-- Map notary services
UPDATE public.business b
SET 
  new_category_id = sc.id,
  category_name = sc.label
FROM public.service_categories sc
WHERE sc.key = 'notary_services'
  AND (
    b.tag ILIKE '%notary%' 
    OR b.name ILIKE '%notary%'
    OR b.name ILIKE '%notaire%'
  )
  AND (b.new_category_id IS NULL OR b.category_name IS NULL);

-- Default uncategorized businesses to shops_services
UPDATE public.business b
SET 
  new_category_id = sc.id,
  category_name = sc.label
FROM public.service_categories sc
WHERE sc.key = 'shops_services'
  AND b.new_category_id IS NULL;

-- ============================================
-- STEP 4: Create additional indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_business_maps_url 
  ON public.business(maps_url) 
  WHERE maps_url IS NOT NULL;

-- Full text search on business name and description
CREATE INDEX IF NOT EXISTS idx_business_search 
  ON public.business 
  USING gin(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '')));

-- ============================================
-- STEP 5: Create trigger for updated_at
-- ============================================

DROP TRIGGER IF EXISTS update_service_categories_updated_at ON public.service_categories;
CREATE TRIGGER update_service_categories_updated_at
  BEFORE UPDATE ON public.service_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- STEP 6: Create helper views and functions
-- ============================================

-- View: businesses by category
CREATE OR REPLACE VIEW public.businesses_by_category AS
SELECT 
  sc.id as category_id,
  sc.key as category_key,
  sc.label as category_label,
  sc.icon_emoji,
  COUNT(b.id) as business_count,
  json_agg(
    json_build_object(
      'id', b.id,
      'name', b.name,
      'description', b.description,
      'location_text', b.location_text,
      'lat', b.lat,
      'lng', b.lng,
      'maps_url', b.maps_url,
      'is_active', b.is_active
    ) ORDER BY b.name
  ) FILTER (WHERE b.id IS NOT NULL) as businesses
FROM public.service_categories sc
LEFT JOIN public.business b ON b.new_category_id = sc.id AND b.is_active = true
WHERE sc.is_active = true
GROUP BY sc.id, sc.key, sc.label, sc.icon_emoji, sc.sort_order
ORDER BY sc.sort_order;

-- Function: Get businesses near a location
CREATE OR REPLACE FUNCTION public.get_businesses_near(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_meters DOUBLE PRECISION DEFAULT 5000,
  p_category_key TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  category_name TEXT,
  category_key TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  distance_meters DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.description,
    b.category_name,
    sc.key as category_key,
    b.lat,
    b.lng,
    ST_Distance(
      b.location::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) as distance_meters
  FROM public.business b
  LEFT JOIN public.service_categories sc ON sc.id = b.new_category_id
  WHERE b.is_active = true
    AND b.location IS NOT NULL
    AND (p_category_key IS NULL OR sc.key = p_category_key)
    AND ST_DWithin(
      b.location::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_meters
    )
  ORDER BY distance_meters
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- STEP 7: Data quality report
-- ============================================

DO $$
DECLARE
  total_businesses INTEGER;
  categorized_businesses INTEGER;
  uncategorized_businesses INTEGER;
  with_maps_url INTEGER;
  with_coordinates INTEGER;
  with_location INTEGER;
  active_businesses INTEGER;
  category_stats TEXT;
BEGIN
  -- Get counts
  SELECT COUNT(*) INTO total_businesses FROM public.business;
  SELECT COUNT(*) INTO active_businesses FROM public.business WHERE is_active = true;
  SELECT COUNT(*) INTO categorized_businesses FROM public.business WHERE new_category_id IS NOT NULL;
  SELECT COUNT(*) INTO uncategorized_businesses FROM public.business WHERE new_category_id IS NULL;
  SELECT COUNT(*) INTO with_maps_url FROM public.business WHERE maps_url IS NOT NULL AND maps_url != '';
  SELECT COUNT(*) INTO with_coordinates FROM public.business WHERE lat IS NOT NULL AND lng IS NOT NULL;
  SELECT COUNT(*) INTO with_location FROM public.business WHERE location IS NOT NULL;
  
  -- Get category distribution
  SELECT string_agg(
    format('  %s %s: %s businesses', sc.icon_emoji, sc.label, COUNT(b.id)),
    E'\n'
  )
  INTO category_stats
  FROM public.service_categories sc
  LEFT JOIN public.business b ON b.new_category_id = sc.id AND b.is_active = true
  WHERE sc.is_active = true
  GROUP BY sc.id, sc.label, sc.icon_emoji, sc.sort_order
  ORDER BY sc.sort_order;
  
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════╗';
  RAISE NOTICE '║   Business Table Cleanup - Complete ✅            ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Statistics:';
  RAISE NOTICE '  Total businesses: %', total_businesses;
  RAISE NOTICE '  Active businesses: %', active_businesses;
  RAISE NOTICE '  Categorized: % (%.1f%%)', categorized_businesses, 
    (categorized_businesses::float / NULLIF(total_businesses, 0) * 100);
  RAISE NOTICE '  Uncategorized: %', uncategorized_businesses;
  RAISE NOTICE '';
  RAISE NOTICE '📍 Location Data:';
  RAISE NOTICE '  With Google Maps URL: %', with_maps_url;
  RAISE NOTICE '  With lat/lng: %', with_coordinates;
  RAISE NOTICE '  With PostGIS location: %', with_location;
  RAISE NOTICE '';
  RAISE NOTICE '🏪 Category Distribution:';
  RAISE NOTICE '%', category_stats;
  RAISE NOTICE '';
  RAISE NOTICE '📝 Next Steps:';
  RAISE NOTICE '  1. Run: python3 scripts/extract_coordinates.py';
  RAISE NOTICE '     to populate lat/lng from Google Maps URLs';
  RAISE NOTICE '';
  RAISE NOTICE '  2. Verify categories:';
  RAISE NOTICE '     SELECT * FROM businesses_by_category;';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
END $$;

COMMIT;
