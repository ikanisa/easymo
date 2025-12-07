-- ============================================================================
-- FIX MOBILITY MATCHING - DISPLAY_NAME COLUMN
-- ============================================================================
-- Migration: 20251207130000_fix_matching_display_name.sql
-- 
-- PROBLEM: Matching functions use p.full_name but profiles table has display_name
-- ERROR: column p.full_name does not exist (PostgreSQL error 42703)
-- 
-- FIX: Update match_drivers_for_trip_v2 and match_passengers_for_trip_v2
--      to use p.display_name instead of p.full_name
-- 
-- TABLES AFFECTED:
-- - None (only function definitions)
-- 
-- FUNCTIONS UPDATED:
-- - match_drivers_for_trip_v2
-- - match_passengers_for_trip_v2
-- ============================================================================

BEGIN;

-- ============================================================================
-- DROP EXISTING FUNCTIONS
-- ============================================================================
DROP FUNCTION IF EXISTS public.match_drivers_for_trip_v2 CASCADE;
DROP FUNCTION IF EXISTS public.match_passengers_for_trip_v2 CASCADE;

-- ============================================================================
-- MATCH DRIVERS FOR TRIP V2 (WITH DISPLAY_NAME FIX)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.match_drivers_for_trip_v2(
  _trip_id uuid,
  _limit integer DEFAULT 9,
  _prefer_dropoff boolean DEFAULT false,
  _radius_m integer DEFAULT 10000,
  _window_days integer DEFAULT 2
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
  v_pickup_geog geography;
BEGIN
  -- Get the requesting trip's location and vehicle type from V2 table
  SELECT 
    t.pickup_lat,
    t.pickup_lng,
    t.dropoff_lat,
    t.dropoff_lng,
    t.vehicle_type,
    t.pickup_geog
  INTO 
    v_pickup_lat,
    v_pickup_lng,
    v_dropoff_lat,
    v_dropoff_lng,
    v_vehicle_type,
    v_pickup_geog
  FROM public.mobility_trips t
  WHERE t.id = _trip_id;

  -- Return empty if trip not found
  IF v_pickup_lat IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    SUBSTRING(t.id::text, 1, 8) AS ref_code,
    ROUND(
      (ST_Distance(t.pickup_geog, v_pickup_geog) / 1000.0)::numeric, 
      2
    ) AS distance_km,
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL AND t.dropoff_lat IS NOT NULL THEN
        ROUND(
          ST_Distance(
            t.dropoff_geog,
            ST_SetSRID(ST_MakePoint(v_dropoff_lng, v_dropoff_lat), 4326)::geography
          )::numeric,
          0
        )
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    t.dropoff_text,
    t.matched_at,
    t.created_at,
    t.vehicle_type,
    (t.vehicle_type = v_vehicle_type) AS is_exact_match,
    EXTRACT(EPOCH FROM (now() - COALESCE(t.last_location_update, t.created_at)))::integer / 60 AS location_age_minutes,
    COALESCE((p.metadata->>'number_plate')::text, (p.metadata->'driver'->>'number_plate')::text) AS number_plate,
    COALESCE(p.display_name, p.phone_number, p.wa_id) AS driver_name,  -- FIXED: use display_name instead of full_name
    'driver'::text AS role
  FROM public.mobility_trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'driver'
    AND t.status = 'open'
    AND (t.expires_at IS NULL OR t.expires_at > now())
    AND t.pickup_lat IS NOT NULL
    AND t.pickup_lng IS NOT NULL
    AND COALESCE(t.last_location_update, t.created_at) > now() - interval '24 hours'
    AND t.created_at > now() - (_window_days || ' days')::interval
    AND t.id != _trip_id
    AND ST_DWithin(
      t.pickup_geog,
      v_pickup_geog,
      _radius_m::double precision
    )
  ORDER BY 
    ST_Distance(t.pickup_geog, v_pickup_geog) ASC,
    COALESCE(t.last_location_update, t.created_at) DESC,
    (t.vehicle_type = v_vehicle_type) DESC
  LIMIT _limit;
END;
$$;

COMMENT ON FUNCTION public.match_drivers_for_trip_v2 IS 
  'Find nearby drivers for a passenger trip. Fixed to use display_name instead of full_name.';

-- ============================================================================
-- MATCH PASSENGERS FOR TRIP V2 (WITH DISPLAY_NAME FIX)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.match_passengers_for_trip_v2(
  _trip_id uuid,
  _limit integer DEFAULT 9,
  _prefer_dropoff boolean DEFAULT false,
  _radius_m integer DEFAULT 10000,
  _window_days integer DEFAULT 2
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
  v_pickup_geog geography;
BEGIN
  -- Get the requesting trip's location and vehicle type from V2 table
  SELECT 
    t.pickup_lat,
    t.pickup_lng,
    t.dropoff_lat,
    t.dropoff_lng,
    t.vehicle_type,
    t.pickup_geog
  INTO 
    v_pickup_lat,
    v_pickup_lng,
    v_dropoff_lat,
    v_dropoff_lng,
    v_vehicle_type,
    v_pickup_geog
  FROM public.mobility_trips t
  WHERE t.id = _trip_id;

  -- Return empty if trip not found
  IF v_pickup_lat IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    SUBSTRING(t.id::text, 1, 8) AS ref_code,
    ROUND(
      (ST_Distance(t.pickup_geog, v_pickup_geog) / 1000.0)::numeric, 
      2
    ) AS distance_km,
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL AND t.dropoff_lat IS NOT NULL THEN
        ROUND(
          ST_Distance(
            t.dropoff_geog,
            ST_SetSRID(ST_MakePoint(v_dropoff_lng, v_dropoff_lat), 4326)::geography
          )::numeric,
          0
        )
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    t.dropoff_text,
    t.matched_at,
    t.created_at,
    t.vehicle_type,
    (t.vehicle_type = v_vehicle_type) AS is_exact_match,
    EXTRACT(EPOCH FROM (now() - COALESCE(t.last_location_update, t.created_at)))::integer / 60 AS location_age_minutes,
    NULL::text AS number_plate,
    COALESCE(p.display_name, p.phone_number, p.wa_id) AS driver_name,  -- FIXED: use display_name instead of full_name
    'passenger'::text AS role
  FROM public.mobility_trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'passenger'
    AND t.status = 'open'
    AND (t.expires_at IS NULL OR t.expires_at > now())
    AND t.pickup_lat IS NOT NULL
    AND t.pickup_lng IS NOT NULL
    AND COALESCE(t.last_location_update, t.created_at) > now() - interval '24 hours'
    AND t.created_at > now() - (_window_days || ' days')::interval
    AND t.id != _trip_id
    AND ST_DWithin(
      t.pickup_geog,
      v_pickup_geog,
      _radius_m::double precision
    )
  ORDER BY 
    ST_Distance(t.pickup_geog, v_pickup_geog) ASC,
    COALESCE(t.last_location_update, t.created_at) DESC,
    (t.vehicle_type = v_vehicle_type) DESC
  LIMIT _limit;
END;
$$;

COMMENT ON FUNCTION public.match_passengers_for_trip_v2 IS 
  'Find nearby passengers for a driver trip. Fixed to use display_name instead of full_name.';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.match_drivers_for_trip_v2 TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.match_passengers_for_trip_v2 TO service_role, authenticated, anon;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'match_drivers_for_trip_v2'
  ) THEN
    RAISE EXCEPTION 'Function match_drivers_for_trip_v2 was not created';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'match_passengers_for_trip_v2'
  ) THEN
    RAISE EXCEPTION 'Function match_passengers_for_trip_v2 was not created';
  END IF;
  
  RAISE NOTICE 'Matching functions fixed: now using display_name instead of full_name';
END;
$$;

COMMIT;
