BEGIN;

-- =====================================================================
-- Update RPC functions to use tag_id foreign key
-- =====================================================================
-- Now that business.tag_id references business_tags.id,
-- update the functions to use this proper foreign key relationship

-- Drop existing functions to allow changing return types
DROP FUNCTION IF EXISTS public.get_shops_tags();
DROP FUNCTION IF EXISTS public.get_shops_by_tag(text, double precision, double precision, double precision, integer);
DROP FUNCTION IF EXISTS public.get_shops_by_tag_id(uuid, double precision, double precision, double precision, integer);

-- Function 1: Get tags using tag_id relationship
CREATE OR REPLACE FUNCTION public.get_shops_tags()
RETURNS TABLE(
  tag_id uuid,
  tag_name text,
  tag_slug text,
  icon text,
  description text,
  business_count bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    bt.id as tag_id,
    bt.name as tag_name,
    bt.slug as tag_slug,
    bt.icon,
    bt.description,
    COUNT(DISTINCT b.id) as business_count
  FROM public.business_tags bt
  LEFT JOIN public.business b ON b.tag_id = bt.id AND b.is_active = true
  WHERE bt.is_active = true
  GROUP BY bt.id, bt.name, bt.slug, bt.icon, bt.description, bt.sort_order
  HAVING COUNT(DISTINCT b.id) > 0
  ORDER BY bt.sort_order ASC, COUNT(DISTINCT b.id) DESC, bt.name ASC;
$$;

-- Function 2: Get businesses by tag using tag_id (accepts tag name)
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
  INNER JOIN public.business_tags bt ON bt.id = b.tag_id
  WHERE
    bt.name = p_tag
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

-- Function 3: Get businesses by tag_id (more efficient when tag_id is known)
CREATE OR REPLACE FUNCTION public.get_shops_by_tag_id(
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
    b.tag_id = p_tag_id
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
GRANT EXECUTE ON FUNCTION public.get_shops_by_tag_id(uuid, double precision, double precision, double precision, integer) TO authenticated, anon;

SELECT 'RPC functions updated to use tag_id foreign key relationship' as status;

COMMIT;
