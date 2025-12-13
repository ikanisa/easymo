-- =====================================================================
-- FIX BAR SEARCH RPC FUNCTION
-- =====================================================================
-- Updates bar search to work with actual bars table schema
-- Bars table doesn't have lat/lng columns, so we'll do simple text search
-- and return all active bars for now
-- =====================================================================

BEGIN;

-- Drop old functions
DROP FUNCTION IF EXISTS public.search_bars_nearby(FLOAT, FLOAT, FLOAT, INT);
DROP FUNCTION IF EXISTS public.search_bars_nearby_postgis(FLOAT, FLOAT, FLOAT, INT);

-- =====================================================================
-- CREATE SIMPLE BAR SEARCH (No geospatial - bars don't have coordinates)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.search_bars_nearby(
  p_lat FLOAT,
  p_lng FLOAT,
  p_radius_km FLOAT DEFAULT 10.0,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  city_area TEXT,
  location_text TEXT,
  whatsapp_number TEXT,
  is_active BOOLEAN,
  google_maps_url TEXT,
  features JSONB,
  distance_km FLOAT
) AS $$
BEGIN
  -- Bars table doesn't have lat/lng, so we can't do distance calculation
  -- Return all active bars for now
  -- TODO: Add lat/lng columns to bars table for proper geospatial search
  
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.slug,
    b.city_area,
    b.location_text,
    bn.whatsapp_number,
    b.is_active,
    NULL::TEXT as google_maps_url,
    NULL::JSONB as features,
    NULL::FLOAT as distance_km
  FROM public.bars b
  LEFT JOIN public.bar_numbers bn ON bn.bar_id = b.id AND bn.is_active = true
  WHERE 
    b.is_active = true
  ORDER BY 
    b.name ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.search_bars_nearby(FLOAT, FLOAT, FLOAT, INT) TO authenticated, anon, service_role;

-- Add comment
COMMENT ON FUNCTION public.search_bars_nearby IS 
'Search for active bars. Note: Geospatial search not available yet - bars table needs lat/lng columns. Returns all active bars sorted by name.';

COMMIT;
