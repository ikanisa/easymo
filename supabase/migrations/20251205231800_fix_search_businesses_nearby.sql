BEGIN;

-- Drop existing function if exists
DROP FUNCTION IF EXISTS public.search_businesses_nearby(double precision, double precision, text, double precision, integer);
DROP FUNCTION IF EXISTS public.search_businesses_nearby(text, double precision, integer, double precision, double precision);

-- Create the correct function
CREATE OR REPLACE FUNCTION public.search_businesses_nearby(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_category TEXT,
  p_radius_km DOUBLE PRECISION DEFAULT 10,
  p_limit INTEGER DEFAULT 9
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT,
  address TEXT,
  phone TEXT,
  owner_whatsapp TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  distance_km DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.name,
    b.category,
    b.address,
    b.phone,
    b.owner_whatsapp,
    b.latitude,
    b.longitude,
    -- Calculate distance using Haversine formula
    (
      6371 * acos(
        cos(radians(p_latitude)) * 
        cos(radians(b.latitude)) * 
        cos(radians(b.longitude) - radians(p_longitude)) + 
        sin(radians(p_latitude)) * 
        sin(radians(b.latitude))
      )
    ) AS distance_km
  FROM public.businesses b
  WHERE 
    b.category = p_category
    AND b.latitude IS NOT NULL
    AND b.longitude IS NOT NULL
    -- Pre-filter by bounding box (much faster than calculating exact distance)
    AND b.latitude BETWEEN (p_latitude - (p_radius_km / 111.0)) AND (p_latitude + (p_radius_km / 111.0))
    AND b.longitude BETWEEN (p_longitude - (p_radius_km / (111.0 * cos(radians(p_latitude))))) 
                        AND (p_longitude + (p_radius_km / (111.0 * cos(radians(p_latitude)))))
  ORDER BY distance_km ASC
  LIMIT p_limit;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.search_businesses_nearby TO authenticated, anon, service_role;

COMMIT;
