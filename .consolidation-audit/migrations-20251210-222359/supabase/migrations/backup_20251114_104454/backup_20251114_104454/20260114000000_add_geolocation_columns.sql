-- Migration: Add geolocation columns and enable geocoding
-- Date: 2026-01-14
-- Description: Adds latitude, longitude, and country columns to bars and business tables
-- Also creates functions for distance calculation

BEGIN;

-- Enable PostGIS extension if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- ==============================================
-- 1. ADD COLUMNS TO BARS TABLE
-- ==============================================

-- Add geolocation columns to bars table
ALTER TABLE public.bars
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS geocoded_at timestamptz,
  ADD COLUMN IF NOT EXISTS geocode_status text DEFAULT 'pending';

-- Update country column constraint (already exists but ensure it's there)
ALTER TABLE public.bars
  ALTER COLUMN country SET NOT NULL;

-- Create index for spatial queries on bars
CREATE INDEX IF NOT EXISTS idx_bars_lat_lng 
  ON public.bars(latitude, longitude) 
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bars_geocode_status 
  ON public.bars(geocode_status);

-- Add comments
COMMENT ON COLUMN public.bars.latitude IS 'Latitude coordinate (WGS84)';
COMMENT ON COLUMN public.bars.longitude IS 'Longitude coordinate (WGS84)';
COMMENT ON COLUMN public.bars.geocoded_at IS 'Timestamp when geocoding was last performed';
COMMENT ON COLUMN public.bars.geocode_status IS 'Status: pending, success, failed, manual';

-- ==============================================
-- 2. UPDATE BUSINESS TABLE
-- ==============================================

-- Add country column to business table if it doesn't exist
ALTER TABLE public.business
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'Rwanda';

-- Rename existing lat/lng columns for consistency
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'business' AND column_name = 'lat') THEN
    ALTER TABLE public.business RENAME COLUMN lat TO latitude;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'business' AND column_name = 'lng') THEN
    ALTER TABLE public.business RENAME COLUMN lng TO longitude;
  END IF;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Add geocoding tracking columns
ALTER TABLE public.business
  ADD COLUMN IF NOT EXISTS geocoded_at timestamptz,
  ADD COLUMN IF NOT EXISTS geocode_status text DEFAULT 'pending';

-- Create index for spatial queries on business
CREATE INDEX IF NOT EXISTS idx_business_lat_lng 
  ON public.business(latitude, longitude) 
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_country 
  ON public.business(country);

CREATE INDEX IF NOT EXISTS idx_business_geocode_status 
  ON public.business(geocode_status);

-- Add comments
COMMENT ON COLUMN public.business.latitude IS 'Latitude coordinate (WGS84)';
COMMENT ON COLUMN public.business.longitude IS 'Longitude coordinate (WGS84)';
COMMENT ON COLUMN public.business.country IS 'Country where business is located';
COMMENT ON COLUMN public.business.geocoded_at IS 'Timestamp when geocoding was last performed';
COMMENT ON COLUMN public.business.geocode_status IS 'Status: pending, success, failed, manual';

-- ==============================================
-- 3. UPDATE DRIVER_STATUS TABLE
-- ==============================================

-- Rename existing lat/lng columns for consistency in driver_status
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'driver_status' AND column_name = 'lat') THEN
    ALTER TABLE public.driver_status RENAME COLUMN lat TO latitude;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'driver_status' AND column_name = 'lng') THEN
    ALTER TABLE public.driver_status RENAME COLUMN lng TO longitude;
  END IF;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Add comments
COMMENT ON COLUMN public.driver_status.latitude IS 'Current latitude coordinate (WGS84)';
COMMENT ON COLUMN public.driver_status.longitude IS 'Current longitude coordinate (WGS84)';

-- ==============================================
-- 4. UPDATE TRIPS TABLE
-- ==============================================

-- Standardize column names in trips table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'trips' AND column_name = 'pickup_lat') THEN
    ALTER TABLE public.trips RENAME COLUMN pickup_lat TO pickup_latitude;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'trips' AND column_name = 'pickup_lng') THEN
    ALTER TABLE public.trips RENAME COLUMN pickup_lng TO pickup_longitude;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'trips' AND column_name = 'dropoff_lat') THEN
    ALTER TABLE public.trips RENAME COLUMN dropoff_lat TO dropoff_latitude;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'trips' AND column_name = 'dropoff_lng') THEN
    ALTER TABLE public.trips RENAME COLUMN dropoff_lng TO dropoff_longitude;
  END IF;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Add comments
COMMENT ON COLUMN public.trips.pickup_latitude IS 'Pickup latitude coordinate (WGS84)';
COMMENT ON COLUMN public.trips.pickup_longitude IS 'Pickup longitude coordinate (WGS84)';
COMMENT ON COLUMN public.trips.dropoff_latitude IS 'Dropoff latitude coordinate (WGS84)';
COMMENT ON COLUMN public.trips.dropoff_longitude IS 'Dropoff longitude coordinate (WGS84)';

-- ==============================================
-- 5. CREATE DISTANCE CALCULATION FUNCTIONS
-- ==============================================

-- Haversine distance function (returns distance in kilometers)
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

COMMENT ON FUNCTION public.calculate_distance_km IS 'Calculate distance between two coordinates using Haversine formula (returns km)';

-- Function to find nearby bars
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

COMMENT ON FUNCTION public.nearby_bars IS 'Find bars within specified radius of user location';

-- Function to find nearby businesses
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

COMMENT ON FUNCTION public.nearby_business IS 'Find businesses within specified radius of user location, optionally filtered by category';

-- Function to find nearby drivers
CREATE OR REPLACE FUNCTION public.nearby_drivers(
  user_lat double precision,
  user_lon double precision,
  _vehicle_type text DEFAULT NULL,
  radius_km double precision DEFAULT 10.0,
  _limit integer DEFAULT 20
)
RETURNS TABLE(
  user_id uuid,
  vehicle_type text,
  latitude double precision,
  longitude double precision,
  distance_km double precision,
  last_seen timestamptz,
  online boolean
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.user_id,
    d.vehicle_type,
    d.latitude,
    d.longitude,
    public.calculate_distance_km(user_lat, user_lon, d.latitude, d.longitude) as distance_km,
    d.last_seen,
    d.online
  FROM public.driver_status d
  WHERE 
    d.online = true
    AND d.latitude IS NOT NULL
    AND d.longitude IS NOT NULL
    AND (_vehicle_type IS NULL OR d.vehicle_type = _vehicle_type)
    AND public.calculate_distance_km(user_lat, user_lon, d.latitude, d.longitude) <= radius_km
    AND d.last_seen > now() - interval '30 minutes' -- Only recently active drivers
  ORDER BY distance_km ASC
  LIMIT _limit;
END;
$$;

COMMENT ON FUNCTION public.nearby_drivers IS 'Find online drivers within specified radius, optionally filtered by vehicle type';

-- ==============================================
-- 6. UPDATE EXISTING BUSINESSES TABLE DATA
-- ==============================================

-- Set default country for existing businesses without country
UPDATE public.business
SET country = 'Rwanda'
WHERE country IS NULL AND location_text IS NOT NULL;

-- Mark records with existing coordinates as already geocoded
UPDATE public.business
SET 
  geocode_status = 'success',
  geocoded_at = now()
WHERE 
  latitude IS NOT NULL 
  AND longitude IS NOT NULL 
  AND geocode_status = 'pending';

-- ==============================================
-- 7. CREATE VIEW FOR GEOCODING QUEUE
-- ==============================================

CREATE OR REPLACE VIEW public.geocoding_queue AS
SELECT 
  'bars' as table_name,
  id::text as record_id,
  name,
  location_text,
  country,
  geocode_status
FROM public.bars
WHERE geocode_status = 'pending' OR geocode_status = 'failed'

UNION ALL

SELECT 
  'business' as table_name,
  id::text as record_id,
  name,
  location_text,
  country,
  geocode_status
FROM public.business
WHERE geocode_status = 'pending' OR geocode_status = 'failed'

ORDER BY geocode_status DESC, table_name;

COMMENT ON VIEW public.geocoding_queue IS 'Queue of records that need geocoding';

COMMIT;
