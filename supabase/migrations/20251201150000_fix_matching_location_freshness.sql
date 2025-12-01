-- Fix driver-passenger matching for location freshness (30-minute window)
-- This migration addresses critical issues:
-- 1. Missing last_location_at column for tracking location freshness
-- 2. Location freshness enforcement (30-minute window instead of 30 days)
-- 3. Correct sorting order (distance ASC, recency DESC, vehicle as tiebreaker)
-- 4. PostGIS ST_DWithin usage for performance

BEGIN;

-- 1. Add last_location_at column to rides_trips table
ALTER TABLE rides_trips ADD COLUMN IF NOT EXISTS last_location_at timestamptz DEFAULT now();

-- 2. Create index for efficient location freshness queries
CREATE INDEX IF NOT EXISTS idx_rides_trips_location_fresh 
  ON rides_trips(last_location_at) 
  WHERE status = 'open' AND expires_at > now();

-- 3. Update match_drivers_for_trip_v2 function with:
--    - 30-minute location freshness check
--    - Correct sorting (distance ASC, recency DESC, vehicle as tiebreaker)
--    - PostGIS ST_DWithin for performance
CREATE OR REPLACE FUNCTION public.match_drivers_for_trip_v2(
  _trip_id uuid,
  _limit integer DEFAULT 9,
  _prefer_dropoff boolean DEFAULT false,
  _radius_m integer DEFAULT 10000,
  _window_days integer DEFAULT 30
)
RETURNS TABLE (
  trip_id uuid,
  creator_user_id uuid,
  whatsapp_e164 text,
  ref_code text,
  distance_km numeric,
  drop_bonus_m numeric,
  pickup_text text,
  dropoff_text text,
  matched_at timestamptz,
  created_at timestamptz,
  vehicle_type text,
  is_exact_match boolean
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_pickup_lat double precision;
  v_pickup_lng double precision;
  v_dropoff_lat double precision;
  v_dropoff_lng double precision;
  v_vehicle_type text;
  v_radius_m integer;
BEGIN
  SELECT 
    t.pickup_latitude,
    t.pickup_longitude,
    t.dropoff_latitude,
    t.dropoff_longitude,
    t.vehicle_type,
    COALESCE(NULLIF(_radius_m, 0), 10000)
  INTO 
    v_pickup_lat,
    v_pickup_lng,
    v_dropoff_lat,
    v_dropoff_lng,
    v_vehicle_type,
    v_radius_m
  FROM public.rides_trips t
  WHERE t.id = _trip_id;

  IF v_pickup_lat IS NULL THEN
    RETURN;
  END IF;

  -- Find matching drivers with:
  -- 1. Location freshness: Only users with location updated within 30 minutes
  -- 2. Sorting: distance ASC, location recency DESC, vehicle match as tiebreaker
  -- 3. PostGIS ST_DWithin for efficient spatial filtering
  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    COALESCE(t.ref_code, SUBSTRING(t.id::text, 1, 8)) AS ref_code,
    ROUND(
      (ST_Distance(
        t.pickup::geography,
        ST_SetSRID(ST_MakePoint(v_pickup_lng, v_pickup_lat), 4326)::geography
      ) / 1000.0)::numeric, 2
    ) AS distance_km,
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL AND t.dropoff_latitude IS NOT NULL THEN
        ROUND(
          ST_Distance(
            t.dropoff::geography,
            ST_SetSRID(ST_MakePoint(v_dropoff_lng, v_dropoff_lat), 4326)::geography
          )::numeric, 0
        )
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    t.dropoff_text,
    t.matched_at,
    t.created_at,
    t.vehicle_type,
    (t.vehicle_type = v_vehicle_type) AS is_exact_match
  FROM public.rides_trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'driver'
    AND t.status IN ('open', 'pending', 'active')
    AND t.expires_at > now()
    AND t.pickup IS NOT NULL
    -- CRITICAL FIX: 30-minute location freshness (not 30 days!)
    AND t.last_location_at > now() - interval '30 minutes'
    AND t.id != _trip_id
    -- Use PostGIS ST_DWithin for efficient spatial filtering
    AND ST_DWithin(
      t.pickup::geography,
      ST_SetSRID(ST_MakePoint(v_pickup_lng, v_pickup_lat), 4326)::geography,
      v_radius_m
    )
  ORDER BY 
    -- CRITICAL FIX: Distance first (nearest first)
    distance_km ASC,
    -- Then by location recency (most recent on top)
    t.last_location_at DESC,
    -- Vehicle match as tiebreaker
    (t.vehicle_type = v_vehicle_type) DESC
  LIMIT _limit;
END;
$$;

-- 4. Update match_passengers_for_trip_v2 with same fixes
CREATE OR REPLACE FUNCTION public.match_passengers_for_trip_v2(
  _trip_id uuid,
  _limit integer DEFAULT 9,
  _prefer_dropoff boolean DEFAULT false,
  _radius_m integer DEFAULT 10000,
  _window_days integer DEFAULT 30
)
RETURNS TABLE (
  trip_id uuid,
  creator_user_id uuid,
  whatsapp_e164 text,
  ref_code text,
  distance_km numeric,
  drop_bonus_m numeric,
  pickup_text text,
  dropoff_text text,
  matched_at timestamptz,
  created_at timestamptz,
  vehicle_type text,
  is_exact_match boolean
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_pickup_lat double precision;
  v_pickup_lng double precision;
  v_dropoff_lat double precision;
  v_dropoff_lng double precision;
  v_vehicle_type text;
  v_radius_m integer;
BEGIN
  SELECT 
    t.pickup_latitude,
    t.pickup_longitude,
    t.dropoff_latitude,
    t.dropoff_longitude,
    t.vehicle_type,
    COALESCE(NULLIF(_radius_m, 0), 10000)
  INTO 
    v_pickup_lat,
    v_pickup_lng,
    v_dropoff_lat,
    v_dropoff_lng,
    v_vehicle_type,
    v_radius_m
  FROM public.rides_trips t
  WHERE t.id = _trip_id;

  IF v_pickup_lat IS NULL THEN
    RETURN;
  END IF;

  -- Find matching passengers with:
  -- 1. Location freshness: Only users with location updated within 30 minutes
  -- 2. Sorting: distance ASC, location recency DESC, vehicle match as tiebreaker
  -- 3. PostGIS ST_DWithin for efficient spatial filtering
  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    COALESCE(t.ref_code, SUBSTRING(t.id::text, 1, 8)) AS ref_code,
    ROUND(
      (ST_Distance(
        t.pickup::geography,
        ST_SetSRID(ST_MakePoint(v_pickup_lng, v_pickup_lat), 4326)::geography
      ) / 1000.0)::numeric, 2
    ) AS distance_km,
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL AND t.dropoff_latitude IS NOT NULL THEN
        ROUND(
          ST_Distance(
            t.dropoff::geography,
            ST_SetSRID(ST_MakePoint(v_dropoff_lng, v_dropoff_lat), 4326)::geography
          )::numeric, 0
        )
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    t.dropoff_text,
    t.matched_at,
    t.created_at,
    t.vehicle_type,
    (t.vehicle_type = v_vehicle_type) AS is_exact_match
  FROM public.rides_trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'passenger'
    AND t.status IN ('open', 'pending', 'active')
    AND t.expires_at > now()
    AND t.pickup IS NOT NULL
    -- CRITICAL FIX: 30-minute location freshness (not 30 days!)
    AND t.last_location_at > now() - interval '30 minutes'
    AND t.id != _trip_id
    -- Use PostGIS ST_DWithin for efficient spatial filtering
    AND ST_DWithin(
      t.pickup::geography,
      ST_SetSRID(ST_MakePoint(v_pickup_lng, v_pickup_lat), 4326)::geography,
      v_radius_m
    )
  ORDER BY 
    -- CRITICAL FIX: Distance first (nearest first)
    distance_km ASC,
    -- Then by location recency (most recent on top)
    t.last_location_at DESC,
    -- Vehicle match as tiebreaker
    (t.vehicle_type = v_vehicle_type) DESC
  LIMIT _limit;
END;
$$;

-- 5. Create function to update trip location (for refreshing location without new trip)
CREATE OR REPLACE FUNCTION public.update_trip_location(
  _trip_id uuid,
  _lat double precision,
  _lng double precision,
  _pickup_text text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.rides_trips
  SET 
    pickup_latitude = _lat,
    pickup_longitude = _lng,
    pickup = ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography::geometry,
    pickup_text = COALESCE(_pickup_text, pickup_text),
    last_location_at = now()
  WHERE id = _trip_id;
END;
$$;

-- 6. Backfill existing trips: set last_location_at from created_at for existing records
UPDATE rides_trips 
SET last_location_at = created_at 
WHERE last_location_at IS NULL;

COMMIT;
