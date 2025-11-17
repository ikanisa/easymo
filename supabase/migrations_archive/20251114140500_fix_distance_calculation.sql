-- Fix distance calculation to use accurate PostGIS ST_Distance instead of Haversine approximation
-- ============================================================================================
-- 
-- ISSUE: The nearby_businesses functions were using haversine_km() which is a spherical
-- approximation that doesn't account for Earth's oblate spheroid shape. This causes
-- inaccurate distance calculations between users and businesses.
--
-- SOLUTION: Use PostGIS ST_Distance with geography type for accurate distance measurements.
-- PostGIS geography type uses the WGS84 spheroid model which is much more accurate.
--
-- CHANGES:
-- 1. Update nearby_businesses() to use ST_Distance with geography columns
-- 2. Add nearby_businesses_v2() function (if missing) to use ST_Distance with category support
-- 3. Keep haversine_km() for backward compatibility but add note about deprecation

BEGIN;

-- =====================================================================
-- Update nearby_businesses() to use accurate PostGIS ST_Distance
-- =====================================================================
CREATE OR REPLACE FUNCTION public.nearby_businesses(
  _lat double precision,
  _lng double precision,
  _viewer text,
  _limit integer DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  owner_whatsapp text,
  name text,
  description text,
  location_text text,
  distance_km double precision
)
LANGUAGE sql
AS $$
  SELECT 
    b.id,
    b.owner_whatsapp,
    b.name,
    b.description,
    b.location_text,
    CASE
      -- Use PostGIS ST_Distance with geography for accurate calculation
      -- ST_Distance returns meters, divide by 1000 for kilometers
      WHEN b.location IS NOT NULL THEN 
        (ST_Distance(b.location, ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography) / 1000.0)::double precision
      WHEN b.geo IS NOT NULL THEN 
        (ST_Distance(b.geo, ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography) / 1000.0)::double precision
      WHEN b.lat IS NOT NULL AND b.lng IS NOT NULL THEN 
        -- Fallback to haversine only if geography columns are null
        public.haversine_km(b.lat, b.lng, _lat, _lng)
      ELSE NULL
    END AS distance_km
  FROM public.businesses b
  WHERE b.is_active = true
  ORDER BY distance_km NULLS LAST, b.created_at DESC
  LIMIT COALESCE(_limit, 10);
$$;

-- =====================================================================
-- Create/Update nearby_businesses_v2() with category support and accurate distance
-- =====================================================================
CREATE OR REPLACE FUNCTION public.nearby_businesses_v2(
  _lat double precision,
  _lng double precision,
  _viewer text,
  _category_slug text DEFAULT NULL,
  _limit integer DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  owner_whatsapp text,
  name text,
  description text,
  location_text text,
  category_slug text,
  distance_km double precision
)
LANGUAGE sql
AS $$
  SELECT 
    b.id,
    b.owner_whatsapp,
    b.name,
    b.description,
    b.location_text,
    COALESCE(mc.slug, b.category_name) AS category_slug,
    CASE
      -- Use PostGIS ST_Distance with geography for accurate calculation
      -- Prefer 'location' column, fallback to 'geo', then lat/lng
      WHEN b.location IS NOT NULL THEN 
        (ST_Distance(b.location, ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography) / 1000.0)::double precision
      WHEN b.geo IS NOT NULL THEN 
        (ST_Distance(b.geo, ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography) / 1000.0)::double precision
      WHEN b.lat IS NOT NULL AND b.lng IS NOT NULL THEN 
        -- Fallback to haversine only if geography columns are null
        public.haversine_km(b.lat, b.lng, _lat, _lng)
      ELSE NULL
    END AS distance_km
  FROM public.businesses b
  LEFT JOIN public.marketplace_categories mc ON mc.slug = lower(b.category_name)
  WHERE b.is_active = true
    AND (
      _category_slug IS NULL OR _category_slug = '' OR
      lower(COALESCE(mc.slug, b.category_name, '')) = lower(_category_slug)
    )
  ORDER BY distance_km NULLS LAST, b.created_at DESC
  LIMIT COALESCE(_limit, 10);
$$;

-- =====================================================================
-- Add comment to haversine_km() about deprecation
-- =====================================================================
COMMENT ON FUNCTION public.haversine_km(double precision, double precision, double precision, double precision) IS 
'DEPRECATED: Use PostGIS ST_Distance with geography type for accurate distance calculations. 
This function uses spherical Earth approximation (radius 6371km) which is less accurate than 
PostGIS geography type that uses WGS84 spheroid. Kept for backward compatibility only.';

COMMIT;
