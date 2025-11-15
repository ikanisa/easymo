-- ============================================
-- GEOLOCATION MIGRATION - APPLY THIS SQL
-- ============================================
-- Go to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/sql/new
-- Paste this entire file and click RUN
-- ============================================

BEGIN;

-- 1. Add columns to bars table
ALTER TABLE public.bars
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS geocoded_at timestamptz,
  ADD COLUMN IF NOT EXISTS geocode_status text DEFAULT 'pending';

-- 2. Add columns to business table  
ALTER TABLE public.business
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'Rwanda',
  ADD COLUMN IF NOT EXISTS geocoded_at timestamptz,
  ADD COLUMN IF NOT EXISTS geocode_status text DEFAULT 'pending';

-- 3. Create distance calculation function
CREATE OR REPLACE FUNCTION public.calculate_distance_km(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  earth_radius_km double precision := 6371.0;
  dlat double precision;
  dlon double precision;
  a double precision;
  c double precision;
BEGIN
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
    RETURN NULL;
  END IF;
  
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  
  a := sin(dlat / 2) * sin(dlat / 2) +
       cos(radians(lat1)) * cos(radians(lat2)) *
       sin(dlon / 2) * sin(dlon / 2);
       
  c := 2 * atan2(sqrt(a), sqrt(1 - a));
  
  RETURN earth_radius_km * c;
END;
$$;

-- 4. Create nearby bars function
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
  distance_km double precision
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.name,
    b.slug,
    b.location_text,
    b.country,
    b.city_area,
    b.latitude,
    b.longitude,
    public.calculate_distance_km(user_lat, user_lon, b.latitude, b.longitude) as distance_km
  FROM public.bars b
  WHERE 
    b.is_active = true
    AND b.latitude IS NOT NULL
    AND b.longitude IS NOT NULL
    AND public.calculate_distance_km(user_lat, user_lon, b.latitude, b.longitude) <= radius_km
  ORDER BY distance_km ASC
  LIMIT _limit;
END;
$$;

-- 5. Create nearby business function
CREATE OR REPLACE FUNCTION public.nearby_business(
  user_lat double precision,
  user_lon double precision,
  radius_km double precision DEFAULT 10.0,
  _category text DEFAULT NULL,
  _limit integer DEFAULT 20
)
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  location_text text,
  country text,
  category_id text,
  latitude double precision,
  longitude double precision,
  distance_km double precision
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.name,
    b.description,
    b.location_text,
    b.country,
    b.category_id,
    b.latitude,
    b.longitude,
    public.calculate_distance_km(user_lat, user_lon, b.latitude, b.longitude) as distance_km
  FROM public.business b
  WHERE 
    b.is_active = true
    AND b.latitude IS NOT NULL
    AND b.longitude IS NOT NULL
    AND (_category IS NULL OR b.category_id = _category)
    AND public.calculate_distance_km(user_lat, user_lon, b.latitude, b.longitude) <= radius_km
  ORDER BY distance_km ASC
  LIMIT _limit;
END;
$$;

-- 6. Create indexes
CREATE INDEX IF NOT EXISTS idx_bars_lat_lng 
  ON public.bars(latitude, longitude) 
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bars_geocode_status 
  ON public.bars(geocode_status);

CREATE INDEX IF NOT EXISTS idx_business_lat_lng 
  ON public.business(latitude, longitude) 
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_geocode_status 
  ON public.business(geocode_status);

-- 7. Update existing business records
UPDATE public.business
SET country = 'Rwanda'
WHERE country IS NULL AND location_text IS NOT NULL;

COMMIT;

-- Test the installation
SELECT calculate_distance_km(-1.9442, 30.0619, -1.2864, 36.8172) as test_distance_km;

-- ============================================
-- AFTER RUNNING THIS, EXECUTE GEOCODING WITH:
-- ============================================
-- curl -X POST https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/geocode-locations \
--   -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcndud2d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NTgxMjcsImV4cCI6MjA3NjEzNDEyN30.egf4IDQpkHCpDKeyF63G72jQmIBcgWMHmj7FVt5xgAA" \
--   -H "Content-Type: application/json" \
--   -d '{"table":"all","batch_size":50}'
