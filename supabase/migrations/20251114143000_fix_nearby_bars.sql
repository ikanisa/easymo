-- Fix nearby_bars function to include whatsapp_number and use accurate PostGIS distance
-- =========================================================================================

BEGIN;

-- Drop old function first (signature change)
DROP FUNCTION IF EXISTS public.nearby_bars(double precision, double precision, double precision, integer);

-- Create updated nearby_bars function with whatsapp_number
CREATE OR REPLACE FUNCTION public.nearby_bars(
  user_lat double precision,
  user_lon double precision,
  radius_km double precision DEFAULT 10.0,
  _limit integer DEFAULT 20
)
RETURNS TABLE(
  id uuid,
  name text,
  slug text,
  location_text text,
  country text,
  city_area text,
  latitude double precision,
  longitude double precision,
  whatsapp_number text,
  distance_km double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    b.id,
    b.name,
    b.slug,
    b.location_text,
    b.country,
    b.city_area,
    b.latitude,
    b.longitude,
    b.whatsapp_number,
    CASE
      -- Use PostGIS ST_Distance with geography for accurate calculation
      WHEN b.location IS NOT NULL THEN 
        (ST_Distance(
          b.location, 
          ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography
        ) / 1000.0)::double precision
      WHEN b.latitude IS NOT NULL AND b.longitude IS NOT NULL THEN 
        -- Fallback to haversine if location geography is null
        public.haversine_km(b.latitude, b.longitude, user_lat, user_lon)
      ELSE NULL
    END AS distance_km
  FROM public.bars b
  WHERE
    b.is_active = true
    AND (b.latitude IS NOT NULL AND b.longitude IS NOT NULL)
    AND (
      -- Filter by radius using accurate distance
      CASE
        WHEN b.location IS NOT NULL THEN 
          (ST_Distance(
            b.location, 
            ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography
          ) / 1000.0) <= radius_km
        WHEN b.latitude IS NOT NULL AND b.longitude IS NOT NULL THEN 
          public.haversine_km(b.latitude, b.longitude, user_lat, user_lon) <= radius_km
        ELSE false
      END
    )
  ORDER BY distance_km ASC NULLS LAST
  LIMIT _limit;
$$;

COMMIT;
