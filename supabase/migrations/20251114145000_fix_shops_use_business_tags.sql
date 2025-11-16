-- Fix shops & services flow to use business_tags table properly
-- ================================================================

BEGIN;

-- Drop the incorrect functions
DROP FUNCTION IF EXISTS public.get_shops_tags();
DROP FUNCTION IF EXISTS public.get_shops_by_tag(text, double precision, double precision, double precision, integer);

-- Function 1: Get tags directly from business_tags table with business counts
CREATE OR REPLACE FUNCTION public.get_business_tags_with_counts()
RETURNS TABLE(
  id uuid,
  name text,
  slug text,
  icon text,
  description text,
  business_count bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    bt.id,
    bt.name,
    bt.slug,
    bt.icon,
    bt.description,
    COUNT(b.id) as business_count
  FROM public.business_tags bt
  LEFT JOIN public.businesses b ON b.tag = bt.name AND b.is_active = true
  WHERE bt.is_active = true
  GROUP BY bt.id, bt.name, bt.slug, bt.icon, bt.description, bt.sort_order
  HAVING COUNT(b.id) > 0
  ORDER BY bt.sort_order ASC, COUNT(b.id) DESC, bt.name ASC;
$$;

-- Function 2: Get businesses by tag_id from business_tags table
CREATE OR REPLACE FUNCTION public.get_businesses_by_tag_id(
  p_tag_id uuid,
  p_user_lat double precision,
  p_user_lon double precision,
  p_radius_km double precision DEFAULT 10.0,
  p_limit integer DEFAULT 9
)
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  owner_whatsapp text,
  location_text text,
  tag text,
  distance_km double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    b.id,
    b.name,
    b.description,
    b.owner_whatsapp,
    b.location_text,
    b.tag,
    CASE
      WHEN b.location IS NOT NULL THEN 
        (ST_Distance(
          b.location, 
          ST_SetSRID(ST_MakePoint(p_user_lon, p_user_lat), 4326)::geography
        ) / 1000.0)::double precision
      WHEN b.geo IS NOT NULL THEN 
        (ST_Distance(
          b.geo, 
          ST_SetSRID(ST_MakePoint(p_user_lon, p_user_lat), 4326)::geography
        ) / 1000.0)::double precision
      WHEN b.lat IS NOT NULL AND b.lng IS NOT NULL THEN 
        public.haversine_km(b.lat, b.lng, p_user_lat, p_user_lon)
      ELSE NULL
    END AS distance_km
  FROM public.businesses b
  INNER JOIN public.business_tags bt ON bt.name = b.tag
  WHERE
    bt.id = p_tag_id
    AND b.is_active = true
    AND (b.lat IS NOT NULL AND b.lng IS NOT NULL)
    AND (
      CASE
        WHEN b.location IS NOT NULL THEN 
          (ST_Distance(
            b.location, 
            ST_SetSRID(ST_MakePoint(p_user_lon, p_user_lat), 4326)::geography
          ) / 1000.0) <= p_radius_km
        WHEN b.geo IS NOT NULL THEN 
          (ST_Distance(
            b.geo, 
            ST_SetSRID(ST_MakePoint(p_user_lon, p_user_lat), 4326)::geography
          ) / 1000.0) <= p_radius_km
        WHEN b.lat IS NOT NULL AND b.lng IS NOT NULL THEN 
          public.haversine_km(b.lat, b.lng, p_user_lat, p_user_lon) <= p_radius_km
        ELSE false
      END
    )
  ORDER BY distance_km ASC NULLS LAST
  LIMIT p_limit;
$$;

COMMIT;
