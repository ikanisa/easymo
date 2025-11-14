-- Simplified shops & services flow - use businesses.tag directly
-- ================================================================

BEGIN;

-- Function 1: Get active tags with business counts from businesses.tag column
CREATE OR REPLACE FUNCTION public.get_shops_tags()
RETURNS TABLE(
  tag_name text,
  business_count bigint,
  icon text
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    b.tag as tag_name,
    COUNT(*) as business_count,
    CASE b.tag
      -- Assign icons based on tag name
      WHEN 'Hardware store' THEN '🔧'
      WHEN 'Pharmacy' THEN '💊'
      WHEN 'Bar & Restaurant' THEN '🍺'
      WHEN 'Electronics store' THEN '📱'
      WHEN 'Cosmetics store' THEN '💄'
      WHEN 'Beauty salon' THEN '💅'
      WHEN 'Hair salon' THEN '✂️'
      WHEN 'Auto parts store' THEN '🚗'
      WHEN 'Coffee shop' THEN '☕'
      WHEN 'Store' THEN '🏪'
      WHEN 'Spareparts' THEN '⚙️'
      WHEN 'Salon & Beauty' THEN '💇'
      ELSE '🏬'
    END as icon
  FROM public.businesses b
  WHERE 
    b.is_active = true 
    AND b.tag IS NOT NULL 
    AND b.tag != ''
  GROUP BY b.tag
  HAVING COUNT(*) > 0
  ORDER BY COUNT(*) DESC, b.tag ASC;
$$;

-- Function 2: Get businesses by tag with accurate distance
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
  latitude double precision,
  longitude double precision,
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
    b.lat as latitude,
    b.lng as longitude,
    b.tag,
    CASE
      -- Use PostGIS ST_Distance with geography for accurate calculation
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
        -- Fallback to haversine if geography columns are null
        public.haversine_km(b.lat, b.lng, p_user_lat, p_user_lon)
      ELSE NULL
    END AS distance_km
  FROM public.businesses b
  WHERE
    b.is_active = true
    AND LOWER(b.tag) = LOWER(p_tag)
    AND (b.lat IS NOT NULL AND b.lng IS NOT NULL)
    AND (
      -- Filter by radius using accurate distance
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
