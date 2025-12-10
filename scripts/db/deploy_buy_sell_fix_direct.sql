-- Direct SQL deployment for Buy & Sell Category Filtering Fix
-- Run this via Supabase SQL Editor if normal migration fails
-- Date: 2025-12-08

-- Drop the old function
DROP FUNCTION IF EXISTS public.search_businesses_nearby(double precision, double precision, text, double precision, integer);

-- Create the corrected function that properly filters by buy_sell_categories
CREATE OR REPLACE FUNCTION public.search_businesses_nearby(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_category_key TEXT,  -- This is the 'key' from buy_sell_categories table
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
    COALESCE(b.buy_sell_category, b.category, 'General') AS category,
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
  INNER JOIN public.buy_sell_categories c 
    ON b.buy_sell_category_id = c.id
  WHERE 
    c.key = p_category_key  -- Match by category key (e.g., 'Salon', 'Pharmacy')
    AND b.lat IS NOT NULL
    AND b.lng IS NOT NULL
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

-- Ensure indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_businesses_location ON public.businesses (lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_businesses_buy_sell_category_id ON public.businesses (buy_sell_category_id) WHERE buy_sell_category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_buy_sell_categories_key ON public.buy_sell_categories (key);

-- Test the function
SELECT 
  name, 
  category, 
  distance_km,
  owner_whatsapp
FROM search_businesses_nearby(
  -1.9915565252304,   -- Kigali latitude
  30.105909347534,    -- Kigali longitude
  'Salon',            -- Category key
  10,                 -- 10km radius
  9                   -- Top 9 results
)
LIMIT 5;

-- Expected: Should return salons near Kigali, sorted by distance
