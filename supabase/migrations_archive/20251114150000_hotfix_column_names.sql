-- EMERGENCY HOTFIX: Fix all functions to use correct column names
-- business table has: latitude, longitude, location (not lat, lng, geo)
-- =======================================================================

BEGIN;

-- Fix nearby_businesses_v2
DROP FUNCTION IF EXISTS public.nearby_businesses_v2(double precision, double precision, text, text, integer);
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
      WHEN b.location IS NOT NULL THEN 
        (ST_Distance(b.location, ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography) / 1000.0)::double precision
      WHEN b.latitude IS NOT NULL AND b.longitude IS NOT NULL THEN 
        public.haversine_km(b.latitude, b.longitude, _lat, _lng)
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

-- Fix nearby_businesses
DROP FUNCTION IF EXISTS public.nearby_businesses(double precision, double precision, text, integer);
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
      WHEN b.location IS NOT NULL THEN 
        (ST_Distance(b.location, ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography) / 1000.0)::double precision
      WHEN b.latitude IS NOT NULL AND b.longitude IS NOT NULL THEN 
        public.haversine_km(b.latitude, b.longitude, _lat, _lng)
      ELSE NULL
    END AS distance_km
  FROM public.businesses b
  WHERE b.is_active = true
  ORDER BY distance_km NULLS LAST, b.created_at DESC
  LIMIT COALESCE(_limit, 10);
$$;

COMMIT;
