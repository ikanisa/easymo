-- ============================================================================
-- CRITICAL FIX: Mobility Matching Column Name Mismatch
-- ============================================================================
-- Migration: 20251208192000_fix_mobility_matching_column_names.sql
-- 
-- ROOT CAUSE:
-- - trips table uses: pickup_lat, pickup_lng (SHORT names)
-- - match_*_v2 functions query: pickup_latitude, pickup_longitude (LONG names)
-- 
-- RESULT:
-- - Functions return NO RESULTS (columns don't exist)
-- - Users see "No drivers/passengers nearby" even when they exist
-- 
-- THIS MIGRATION:
-- 1. Fixes column names in both matching functions
-- 2. Changes pickup_latitude → pickup_lat
-- 3. Changes pickup_longitude → pickup_lng
-- 4. Changes dropoff_latitude → dropoff_lat
-- 5. Changes dropoff_longitude → dropoff_lng
-- 6. Maintains all other logic (24-hour window, radius, sorting)
-- ============================================================================

BEGIN;

-- ============================================================================
-- DROP EXISTING FUNCTIONS
-- ============================================================================
DROP FUNCTION IF EXISTS public.match_drivers_for_trip_v2(uuid, integer, boolean, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.match_passengers_for_trip_v2(uuid, integer, boolean, integer, integer) CASCADE;

-- ============================================================================
-- MATCH DRIVERS FOR TRIP V2 (CORRECT COLUMN NAMES)
-- ============================================================================

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
  is_exact_match boolean,
  location_age_minutes integer,
  number_plate text,
  driver_name text,
  role text
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
  v_radius_km double precision;
BEGIN
  -- Get requesting trip (FIXED: use pickup_lat/pickup_lng)
  SELECT 
    t.pickup_lat,        -- FIXED: was pickup_latitude
    t.pickup_lng,        -- FIXED: was pickup_longitude
    t.dropoff_lat,       -- FIXED: was dropoff_latitude
    t.dropoff_lng,       -- FIXED: was dropoff_longitude
    t.vehicle_type,
    CASE 
      WHEN _radius_m IS NULL OR _radius_m <= 0 THEN 10.0
      ELSE _radius_m::double precision / 1000.0
    END
  INTO 
    v_pickup_lat,
    v_pickup_lng,
    v_dropoff_lat,
    v_dropoff_lng,
    v_vehicle_type,
    v_radius_km
  FROM public.trips t
  WHERE t.id = _trip_id;

  -- Return empty if trip not found
  IF v_pickup_lat IS NULL THEN
    RETURN;
  END IF;

  -- Find matching drivers (FIXED: use pickup_lat/pickup_lng)
  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.user_id AS creator_user_id,  -- FIXED: trips.user_id not creator_user_id
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    COALESCE(t.metadata->>'ref_code', SUBSTRING(t.id::text, 1, 8)) AS ref_code,
    -- Distance calculation using haversine formula
    ROUND(
      (6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_lat)) *    -- FIXED
          cos(radians(t.pickup_lng) - radians(v_pickup_lng)) +         -- FIXED
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_lat))      -- FIXED
        ))
      ))::numeric, 2
    ) AS distance_km,
    -- Dropoff bonus (if both have dropoff)
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL AND t.dropoff_lat IS NOT NULL THEN
        ROUND(
          (6371000 * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians(v_dropoff_lat)) * cos(radians(t.dropoff_lat)) *     -- FIXED
              cos(radians(t.dropoff_lng) - radians(v_dropoff_lng)) +          -- FIXED
              sin(radians(v_dropoff_lat)) * sin(radians(t.dropoff_lat))       -- FIXED
            ))
          ))::numeric, 0
        )
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    t.dropoff_text,
    NULL::timestamptz AS matched_at,
    t.created_at,
    t.vehicle_type,
    (t.vehicle_type = v_vehicle_type) AS is_exact_match,
    -- Location age in minutes
    EXTRACT(EPOCH FROM (now() - t.updated_at))::integer / 60 AS location_age_minutes,
    -- Extract number plate from metadata
    COALESCE(
      (t.metadata->>'number_plate')::text,
      (p.metadata->>'number_plate')::text,
      (p.metadata->'driver'->>'number_plate')::text
    ) AS number_plate,
    COALESCE(p.display_name, p.phone_number, 'Driver') AS driver_name,
    'driver'::text AS role
  FROM public.trips t
  INNER JOIN public.profiles p ON p.user_id = t.user_id  -- FIXED: trips.user_id
  WHERE t.role = 'driver'
    -- Status: only open trips
    AND t.status = 'open'
    -- Expiry: must be in future
    AND (t.expires_at IS NULL OR t.expires_at > now())
    -- Location must exist (FIXED: use pickup_lat/pickup_lng)
    AND t.pickup_lat IS NOT NULL
    AND t.pickup_lng IS NOT NULL
    -- CRITICAL: 24-hour location freshness window
    AND t.updated_at > now() - interval '24 hours'
    -- Window: only recent trips (configurable)
    AND t.created_at >= NOW() - (INTERVAL '1 day' * _window_days)
    -- Exclude self
    AND t.id != _trip_id
    -- Within search radius (FIXED: use pickup_lat/pickup_lng)
    AND (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_lat)) *
          cos(radians(t.pickup_lng) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_lat))
        ))
      )
    ) <= v_radius_km
  ORDER BY 
    distance_km ASC,
    t.updated_at DESC,
    (t.vehicle_type = v_vehicle_type) DESC
  LIMIT _limit;
END;
$$;

-- ============================================================================
-- MATCH PASSENGERS FOR TRIP V2 (CORRECT COLUMN NAMES)
-- ============================================================================

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
  is_exact_match boolean,
  location_age_minutes integer,
  number_plate text,
  driver_name text,
  role text
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
  v_radius_km double precision;
BEGIN
  -- Get requesting trip (FIXED: use pickup_lat/pickup_lng)
  SELECT 
    t.pickup_lat,        -- FIXED: was pickup_latitude
    t.pickup_lng,        -- FIXED: was pickup_longitude
    t.dropoff_lat,       -- FIXED: was dropoff_latitude
    t.dropoff_lng,       -- FIXED: was dropoff_longitude
    t.vehicle_type,
    CASE 
      WHEN _radius_m IS NULL OR _radius_m <= 0 THEN 10.0
      ELSE _radius_m::double precision / 1000.0
    END
  INTO 
    v_pickup_lat,
    v_pickup_lng,
    v_dropoff_lat,
    v_dropoff_lng,
    v_vehicle_type,
    v_radius_km
  FROM public.trips t
  WHERE t.id = _trip_id;

  -- Return empty if trip not found
  IF v_pickup_lat IS NULL THEN
    RETURN;
  END IF;

  -- Find matching passengers (FIXED: use pickup_lat/pickup_lng)
  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.user_id AS creator_user_id,  -- FIXED: trips.user_id not creator_user_id
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    COALESCE(t.metadata->>'ref_code', SUBSTRING(t.id::text, 1, 8)) AS ref_code,
    -- Distance calculation
    ROUND(
      (6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_lat)) *    -- FIXED
          cos(radians(t.pickup_lng) - radians(v_pickup_lng)) +         -- FIXED
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_lat))      -- FIXED
        ))
      ))::numeric, 2
    ) AS distance_km,
    -- Dropoff bonus
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL AND t.dropoff_lat IS NOT NULL THEN
        ROUND(
          (6371000 * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians(v_dropoff_lat)) * cos(radians(t.dropoff_lat)) *     -- FIXED
              cos(radians(t.dropoff_lng) - radians(v_dropoff_lng)) +          -- FIXED
              sin(radians(v_dropoff_lat)) * sin(radians(t.dropoff_lat))       -- FIXED
            ))
          ))::numeric, 0
        )
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    t.dropoff_text,
    NULL::timestamptz AS matched_at,
    t.created_at,
    t.vehicle_type,
    (t.vehicle_type = v_vehicle_type) AS is_exact_match,
    EXTRACT(EPOCH FROM (now() - t.updated_at))::integer / 60 AS location_age_minutes,
    NULL::text AS number_plate,
    COALESCE(p.display_name, p.phone_number, 'Passenger') AS driver_name,
    'passenger'::text AS role
  FROM public.trips t
  INNER JOIN public.profiles p ON p.user_id = t.user_id  -- FIXED: trips.user_id
  WHERE t.role = 'passenger'
    AND t.status = 'open'
    AND (t.expires_at IS NULL OR t.expires_at > now())
    -- FIXED: use pickup_lat/pickup_lng
    AND t.pickup_lat IS NOT NULL
    AND t.pickup_lng IS NOT NULL
    AND t.updated_at > now() - interval '24 hours'
    AND t.created_at >= NOW() - (INTERVAL '1 day' * _window_days)
    AND t.id != _trip_id
    -- FIXED: use pickup_lat/pickup_lng
    AND (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_lat)) *
          cos(radians(t.pickup_lng) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_lat))
        ))
      )
    ) <= v_radius_km
  ORDER BY 
    distance_km ASC,
    t.updated_at DESC,
    (t.vehicle_type = v_vehicle_type) DESC
  LIMIT _limit;
END;
$$;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.match_drivers_for_trip_v2(uuid, integer, boolean, integer, integer) TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.match_passengers_for_trip_v2(uuid, integer, boolean, integer, integer) TO service_role, authenticated, anon;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Fixed matching functions to use correct column names';
  RAISE NOTICE '✅ pickup_latitude → pickup_lat';
  RAISE NOTICE '✅ pickup_longitude → pickup_lng';
  RAISE NOTICE '✅ dropoff_latitude → dropoff_lat';
  RAISE NOTICE '✅ dropoff_longitude → dropoff_lng';
  RAISE NOTICE '✅ creator_user_id → user_id (trips table column)';
END;
$$;

COMMIT;
