BEGIN;

-- ==================================================================
-- FIX search_businesses_nearby Function
-- ==================================================================
-- Problem: Function references b.latitude/b.longitude but table uses b.lat/b.lng
-- Solution: Drop all wrong versions and recreate with correct column names
-- ==================================================================

-- Drop all possible wrong signatures
DROP FUNCTION IF EXISTS public.search_businesses_nearby(text, double precision, double precision, double precision, integer);
DROP FUNCTION IF EXISTS public.search_businesses_nearby(text, float, float, float, integer);
DROP FUNCTION IF EXISTS public.search_businesses_nearby(double precision, double precision, text, double precision, integer);
DROP FUNCTION IF EXISTS public.search_businesses_nearby(p_category text, p_latitude double precision, p_limit integer, p_longitude double precision, p_radius_km double precision);
DROP FUNCTION IF EXISTS public.search_businesses_nearby(p_latitude double precision, p_longitude double precision, p_category text, p_radius_km double precision, p_limit integer);

-- Create the correct function with proper column names
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
    b.lat AS latitude,  -- Map lat to latitude in output
    b.lng AS longitude, -- Map lng to longitude in output
    -- Calculate distance using Haversine formula
    (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(p_latitude)) * 
          cos(radians(b.lat)) * 
          cos(radians(b.lng) - radians(p_longitude)) + 
          sin(radians(p_latitude)) * 
          sin(radians(b.lat))
        ))
      )
    ) AS distance_km
  FROM public.businesses b
  WHERE 
    b.category = p_category
    AND b.lat IS NOT NULL
    AND b.lng IS NOT NULL
    AND b.is_active = true  -- Only return active businesses
    -- Pre-filter by bounding box (much faster than calculating exact distance)
    AND b.lat BETWEEN (p_latitude - (p_radius_km / 111.0)) AND (p_latitude + (p_radius_km / 111.0))
    AND b.lng BETWEEN (p_longitude - (p_radius_km / (111.0 * cos(radians(p_latitude))))) 
                  AND (p_longitude + (p_radius_km / (111.0 * cos(radians(p_latitude)))))
  ORDER BY distance_km ASC
  LIMIT p_limit;
END;
$$;

-- Grant execute permission to all relevant roles
GRANT EXECUTE ON FUNCTION public.search_businesses_nearby(double precision, double precision, text, double precision, integer) 
TO authenticated, anon, service_role;

-- Create index on businesses for faster location-based queries if not exists
CREATE INDEX IF NOT EXISTS idx_businesses_location ON public.businesses (lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_businesses_category_active ON public.businesses (category, is_active);

COMMIT;
