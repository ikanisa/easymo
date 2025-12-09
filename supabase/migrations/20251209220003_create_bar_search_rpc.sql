-- =====================================================================
-- CREATE BAR SEARCH RPC FUNCTION
-- =====================================================================
-- Enables geospatial search for bars/restaurants near a location
-- Used by Waiter AI Agent for discovery flow
--
-- Example usage:
-- SELECT * FROM search_bars_nearby(-1.9536, 30.0606, 10, 5);
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. CREATE NEARBY BARS SEARCH FUNCTION
-- =====================================================================

CREATE OR REPLACE FUNCTION public.search_bars_nearby(
  p_lat FLOAT,
  p_lng FLOAT,
  p_radius_km FLOAT DEFAULT 10.0,
  p_limit INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  city_area TEXT,
  location_text TEXT,
  latitude DECIMAL,
  longitude DECIMAL,
  whatsapp_number TEXT,
  is_active BOOLEAN,
  google_maps_url TEXT,
  features JSONB,
  distance_km FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.slug,
    b.city_area,
    b.location_text,
    b.latitude,
    b.longitude,
    b.whatsapp_number,
    b.is_active,
    b.google_maps_url,
    b.features,
    -- Calculate distance using PostGIS if location column exists, otherwise use haversine
    CASE 
      WHEN b.latitude IS NOT NULL AND b.longitude IS NOT NULL THEN
        -- Haversine formula for distance calculation
        (
          6371 * acos(
            cos(radians(p_lat)) * 
            cos(radians(b.latitude)) * 
            cos(radians(b.longitude) - radians(p_lng)) + 
            sin(radians(p_lat)) * 
            sin(radians(b.latitude))
          )
        )::FLOAT
      ELSE NULL
    END AS distance_km
  FROM public.bars b
  WHERE 
    b.is_active = true
    AND b.latitude IS NOT NULL
    AND b.longitude IS NOT NULL
    -- Filter by radius using haversine
    AND (
      6371 * acos(
        cos(radians(p_lat)) * 
        cos(radians(b.latitude)) * 
        cos(radians(b.longitude) - radians(p_lng)) + 
        sin(radians(p_lat)) * 
        sin(radians(b.latitude))
      )
    ) <= p_radius_km
  ORDER BY 
    distance_km ASC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================================
-- 2. CREATE ALTERNATIVE VERSION WITH POSTGIS (if geography column exists)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.search_bars_nearby_postgis(
  p_lat FLOAT,
  p_lng FLOAT,
  p_radius_km FLOAT DEFAULT 10.0,
  p_limit INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  city_area TEXT,
  location_text TEXT,
  latitude DECIMAL,
  longitude DECIMAL,
  whatsapp_number TEXT,
  is_active BOOLEAN,
  google_maps_url TEXT,
  features JSONB,
  distance_km FLOAT
) AS $$
BEGIN
  -- Check if location column exists and use it, otherwise fallback
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.slug,
    b.city_area,
    b.location_text,
    b.latitude,
    b.longitude,
    b.whatsapp_number,
    b.is_active,
    b.google_maps_url,
    b.features,
    -- Use PostGIS ST_Distance if location column exists
    CASE 
      WHEN b.location IS NOT NULL THEN
        (ST_Distance(
          b.location,
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
        ) / 1000.0)::FLOAT
      WHEN b.latitude IS NOT NULL AND b.longitude IS NOT NULL THEN
        (
          6371 * acos(
            cos(radians(p_lat)) * 
            cos(radians(b.latitude)) * 
            cos(radians(b.longitude) - radians(p_lng)) + 
            sin(radians(p_lat)) * 
            sin(radians(b.latitude))
          )
        )::FLOAT
      ELSE NULL
    END AS distance_km
  FROM public.bars b
  WHERE 
    b.is_active = true
    AND (
      -- Use PostGIS if available
      (b.location IS NOT NULL AND ST_DWithin(
        b.location,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
        p_radius_km * 1000
      ))
      OR
      -- Fallback to lat/lng with haversine
      (b.latitude IS NOT NULL AND b.longitude IS NOT NULL AND (
        6371 * acos(
          cos(radians(p_lat)) * 
          cos(radians(b.latitude)) * 
          cos(radians(b.longitude) - radians(p_lng)) + 
          sin(radians(p_lat)) * 
          sin(radians(b.latitude))
        )
      ) <= p_radius_km)
    )
  ORDER BY 
    distance_km ASC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================================
-- 3. GRANT PERMISSIONS
-- =====================================================================

GRANT EXECUTE ON FUNCTION public.search_bars_nearby(FLOAT, FLOAT, FLOAT, INT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.search_bars_nearby_postgis(FLOAT, FLOAT, FLOAT, INT) TO authenticated, anon, service_role;

-- =====================================================================
-- 4. ADD COMMENTS
-- =====================================================================

COMMENT ON FUNCTION public.search_bars_nearby IS 
'Search for nearby bars using haversine formula. Returns bars within radius sorted by distance. Example: search_bars_nearby(-1.9536, 30.0606, 10, 5)';

COMMENT ON FUNCTION public.search_bars_nearby_postgis IS 
'Search for nearby bars using PostGIS if available, fallback to haversine. Returns bars within radius sorted by distance.';

COMMIT;
