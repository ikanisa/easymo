BEGIN;

-- =====================================================================
-- Delete business_tag_assignments table and fix WhatsApp flows
-- =====================================================================
-- WhatsApp flows should use:
-- - business table for business data
-- - business.tag field directly (not junction table)
-- - bars table for bar data

-- Drop the business_tag_assignments table
DROP TABLE IF EXISTS business_tag_assignments CASCADE;

-- Drop any functions that used business_tag_assignments
DROP FUNCTION IF EXISTS public.get_business_tags_with_counts();
DROP FUNCTION IF EXISTS public.get_businesses_by_tag_id(uuid, double precision, double precision, double precision, integer);
-- Drop get_shops_tags with all possible signatures
DROP FUNCTION IF EXISTS public.get_shops_tags();

-- Function 1: Get tags directly from business.tag field with counts
CREATE OR REPLACE FUNCTION public.get_shops_tags()
RETURNS TABLE(
  tag_name text,
  icon text,
  business_count bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    bt.name as tag_name,
    bt.icon,
    COUNT(DISTINCT b.id) as business_count
  FROM public.business_tags bt
  LEFT JOIN public.business b ON b.tag = bt.name AND b.is_active = true
  WHERE bt.is_active = true
  GROUP BY bt.name, bt.icon, bt.sort_order
  HAVING COUNT(DISTINCT b.id) > 0
  ORDER BY bt.sort_order ASC, COUNT(DISTINCT b.id) DESC, bt.name ASC;
$$;

-- Drop existing function if it exists with different signature
DROP FUNCTION IF EXISTS public.get_shops_by_tag(text, double precision, double precision, double precision, integer, integer);
DROP FUNCTION IF EXISTS public.get_shops_by_tag(text, double precision, double precision, double precision, integer);
DROP FUNCTION IF EXISTS public.get_shops_by_tag(text, double precision, double precision, double precision);

-- Function 2: Get businesses by tag from business.tag field
CREATE OR REPLACE FUNCTION public.get_shops_by_tag(
  p_tag text,
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
    CASE
      WHEN b.location IS NOT NULL THEN 
        (ST_Distance(
          b.location, 
          ST_SetSRID(ST_MakePoint(p_user_lon, p_user_lat), 4326)::geography
        ) / 1000.0)::double precision
      WHEN b.latitude IS NOT NULL AND b.longitude IS NOT NULL THEN 
        public.haversine_km(b.latitude, b.longitude, p_user_lat, p_user_lon)
      ELSE NULL
    END AS distance_km
  FROM public.business b
  WHERE
    b.tag = p_tag
    AND b.is_active = true
    AND (b.latitude IS NOT NULL AND b.longitude IS NOT NULL)
    AND (
      CASE
        WHEN b.location IS NOT NULL THEN 
          (ST_Distance(
            b.location, 
            ST_SetSRID(ST_MakePoint(p_user_lon, p_user_lat), 4326)::geography
          ) / 1000.0) <= p_radius_km
        WHEN b.latitude IS NOT NULL AND b.longitude IS NOT NULL THEN 
          public.haversine_km(b.latitude, b.longitude, p_user_lat, p_user_lon) <= p_radius_km
        ELSE false
      END
    )
  ORDER BY distance_km ASC NULLS LAST
  LIMIT p_limit;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_shops_tags() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_shops_by_tag(text, double precision, double precision, double precision, integer) TO authenticated, anon;

SELECT 'business_tag_assignments table deleted, WhatsApp flows now use business.tag field directly' as status;

COMMIT;
