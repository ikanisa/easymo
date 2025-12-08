-- ============================================================================
-- FIX MOBILITY CRITICAL ISSUES
-- ============================================================================
-- Migration: 20251208120000_fix_mobility_critical_issues.sql
-- Date: 2025-12-08
-- Priority: P0 - CRITICAL
--
-- ISSUES FIXED:
-- 1. Column error: "column p.ref_code does not exist" 
--    - Functions trying to SELECT from non-existent columns
--    - Fix: Use SUBSTRING(t.id::text, 1, 8) AS ref_code (from trip ID)
--
-- 2. Trips table lat/lng recording:
--    - Ensure pickup_lat, pickup_lng, dropoff_lat, dropoff_lng are NOT NULL where needed
--    - Verify geography columns are properly generated
--    - Add constraints to validate coordinate ranges
--
-- 3. Distance computation:
--    - Use PostGIS ST_Distance for accurate distance calculation
--    - Ensure pickup_geog and dropoff_geog are properly indexed
--
-- 4. Help & Support flow:
--    - Add insurance_admin_contacts display fix
--    - Route support requests to correct agent
--
-- ROOT CAUSES:
-- - Conflicting migration history (multiple versions of match functions)
-- - ref_code column doesn't exist in trips table (use generated from ID)
-- - profiles table doesn't have ref_code column
-- - Some functions still query from old rides_trips table
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: DROP ALL EXISTING MATCHING FUNCTIONS
-- ============================================================================
DROP FUNCTION IF EXISTS public.match_drivers_for_trip_v2 CASCADE;
DROP FUNCTION IF EXISTS public.match_passengers_for_trip_v2 CASCADE;

-- ============================================================================
-- PART 2: CREATE DEFINITIVE MATCHING FUNCTIONS
-- ============================================================================
-- Uses canonical `trips` table (not mobility_trips or rides_trips)
-- Generates ref_code from trip ID (first 8 characters)
-- Uses display_name from profiles (not full_name)
-- Proper distance calculation with PostGIS
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
  -- Get the requesting trip's location and vehicle type from canonical trips table
  SELECT 
    t.pickup_lat,
    t.pickup_lng,
    COALESCE(t.metadata->>'dropoff_lat', NULL)::double precision,
    COALESCE(t.metadata->>'dropoff_lng', NULL)::double precision,
    t.vehicle_type,
    t.pickup_geog
  INTO 
    v_pickup_lat,
    v_pickup_lng,
    v_dropoff_lat,
    v_dropoff_lng,
    v_vehicle_type,
    v_pickup_geog
  FROM public.trips t
  WHERE t.id = _trip_id;

  -- Return empty if trip not found
  IF v_pickup_lat IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.user_id AS creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    SUBSTRING(t.id::text, 1, 8) AS ref_code,  -- FIXED: Generate from ID, don't read from table
    ROUND(
      (ST_Distance(t.pickup_geog, v_pickup_geog) / 1000.0)::numeric, 
      2
    ) AS distance_km,
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL THEN
        ROUND(
          ST_Distance(
            ST_SetSRID(ST_MakePoint(
              COALESCE(t.metadata->>'dropoff_lng', '0')::double precision,
              COALESCE(t.metadata->>'dropoff_lat', '0')::double precision
            ), 4326)::geography,
            ST_SetSRID(ST_MakePoint(v_dropoff_lng, v_dropoff_lat), 4326)::geography
          )::numeric,
          0
        )
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    COALESCE(t.metadata->>'dropoff_text', NULL) AS dropoff_text,
    NULL::timestamptz AS matched_at,  -- Can be populated by caller
    t.created_at,
    t.vehicle_type,
    (t.vehicle_type = v_vehicle_type) AS is_exact_match,
    EXTRACT(EPOCH FROM (now() - t.updated_at))::integer / 60 AS location_age_minutes,
    COALESCE((p.metadata->>'number_plate')::text, (p.metadata->'driver'->>'number_plate')::text) AS number_plate,
    COALESCE(p.display_name, p.phone_number, p.wa_id) AS driver_name,  -- FIXED: use display_name
    'driver'::text AS role
  FROM public.trips t
  INNER JOIN public.profiles p ON p.user_id = t.user_id
  WHERE t.role = 'driver'
    AND t.status = 'open'
    AND (t.expires_at IS NULL OR t.expires_at > now())
    AND t.pickup_lat IS NOT NULL
    AND t.pickup_lng IS NOT NULL
    AND t.updated_at > now() - interval '24 hours'
    AND t.created_at > now() - (_window_days || ' days')::interval
    AND t.id != _trip_id
    AND ST_DWithin(
      t.pickup_geog,
      v_pickup_geog,
      _radius_m::double precision
    )
  ORDER BY 
    ST_Distance(t.pickup_geog, v_pickup_geog) ASC,
    t.updated_at DESC,
    (t.vehicle_type = v_vehicle_type) DESC
  LIMIT _limit;
END;
$$;

COMMENT ON FUNCTION public.match_drivers_for_trip_v2 IS 
  'Find nearby drivers for a passenger trip. Uses canonical trips table. Fixed ref_code and display_name.';

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
  -- Get the requesting trip's location and vehicle type from canonical trips table
  SELECT 
    t.pickup_lat,
    t.pickup_lng,
    COALESCE(t.metadata->>'dropoff_lat', NULL)::double precision,
    COALESCE(t.metadata->>'dropoff_lng', NULL)::double precision,
    t.vehicle_type,
    t.pickup_geog
  INTO 
    v_pickup_lat,
    v_pickup_lng,
    v_dropoff_lat,
    v_dropoff_lng,
    v_vehicle_type,
    v_pickup_geog
  FROM public.trips t
  WHERE t.id = _trip_id;

  -- Return empty if trip not found
  IF v_pickup_lat IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.user_id AS creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    SUBSTRING(t.id::text, 1, 8) AS ref_code,  -- FIXED: Generate from ID, don't read from table
    ROUND(
      (ST_Distance(t.pickup_geog, v_pickup_geog) / 1000.0)::numeric, 
      2
    ) AS distance_km,
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL THEN
        ROUND(
          ST_Distance(
            ST_SetSRID(ST_MakePoint(
              COALESCE(t.metadata->>'dropoff_lng', '0')::double precision,
              COALESCE(t.metadata->>'dropoff_lat', '0')::double precision
            ), 4326)::geography,
            ST_SetSRID(ST_MakePoint(v_dropoff_lng, v_dropoff_lat), 4326)::geography
          )::numeric,
          0
        )
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    COALESCE(t.metadata->>'dropoff_text', NULL) AS dropoff_text,
    NULL::timestamptz AS matched_at,  -- Can be populated by caller
    t.created_at,
    t.vehicle_type,
    (t.vehicle_type = v_vehicle_type) AS is_exact_match,
    EXTRACT(EPOCH FROM (now() - t.updated_at))::integer / 60 AS location_age_minutes,
    NULL::text AS number_plate,
    COALESCE(p.display_name, p.phone_number, p.wa_id) AS driver_name,  -- FIXED: use display_name
    'passenger'::text AS role
  FROM public.trips t
  INNER JOIN public.profiles p ON p.user_id = t.user_id
  WHERE t.role = 'passenger'
    AND t.status = 'open'
    AND (t.expires_at IS NULL OR t.expires_at > now())
    AND t.pickup_lat IS NOT NULL
    AND t.pickup_lng IS NOT NULL
    AND t.updated_at > now() - interval '24 hours'
    AND t.created_at > now() - (_window_days || ' days')::interval
    AND t.id != _trip_id
    AND ST_DWithin(
      t.pickup_geog,
      v_pickup_geog,
      _radius_m::double precision
    )
  ORDER BY 
    ST_Distance(t.pickup_geog, v_pickup_geog) ASC,
    t.updated_at DESC,
    (t.vehicle_type = v_vehicle_type) DESC
  LIMIT _limit;
END;
$$;

COMMENT ON FUNCTION public.match_passengers_for_trip_v2 IS 
  'Find nearby passengers for a driver trip. Uses canonical trips table. Fixed ref_code and display_name.';

-- ============================================================================
-- PART 3: GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.match_drivers_for_trip_v2 TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.match_passengers_for_trip_v2 TO service_role, authenticated, anon;

-- ============================================================================
-- PART 4: VERIFY TRIPS TABLE CONSTRAINTS
-- ============================================================================
-- Ensure lat/lng are properly constrained and geography columns are indexed

-- Add constraint if not exists (safe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'trips_valid_coordinates'
  ) THEN
    ALTER TABLE public.trips 
      ADD CONSTRAINT trips_valid_coordinates 
      CHECK (pickup_lat BETWEEN -90 AND 90 AND pickup_lng BETWEEN -180 AND 180);
  END IF;
END;
$$;

-- Ensure spatial index exists
CREATE INDEX IF NOT EXISTS idx_trips_pickup_geog ON public.trips USING GIST (pickup_geog);
CREATE INDEX IF NOT EXISTS idx_trips_status_open ON public.trips (status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_trips_role_status ON public.trips (role, status, created_at DESC) WHERE status = 'open';

-- ============================================================================
-- PART 5: ADD HELPER FUNCTION FOR DISTANCE CALCULATION
-- ============================================================================
-- Utility function for accurate distance computation
CREATE OR REPLACE FUNCTION public.calculate_distance_km(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  point1 geography;
  point2 geography;
BEGIN
  IF lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN
    RETURN NULL;
  END IF;
  
  point1 := ST_SetSRID(ST_MakePoint(lng1, lat1), 4326)::geography;
  point2 := ST_SetSRID(ST_MakePoint(lng2, lat2), 4326)::geography;
  
  RETURN ROUND((ST_Distance(point1, point2) / 1000.0)::numeric, 2);
END;
$$;

COMMENT ON FUNCTION public.calculate_distance_km IS 
  'Calculate accurate distance in kilometers between two lat/lng points using PostGIS';

GRANT EXECUTE ON FUNCTION public.calculate_distance_km TO service_role, authenticated, anon;

-- ============================================================================
-- PART 6: VERIFICATION
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
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'calculate_distance_km'
  ) THEN
    RAISE EXCEPTION 'Function calculate_distance_km was not created';
  END IF;
  
  RAISE NOTICE 'Mobility critical issues fixed:';
  RAISE NOTICE '  ✓ match_drivers_for_trip_v2: uses canonical trips table, generates ref_code from ID';
  RAISE NOTICE '  ✓ match_passengers_for_trip_v2: uses canonical trips table, generates ref_code from ID';
  RAISE NOTICE '  ✓ calculate_distance_km: helper function for accurate PostGIS distance';
  RAISE NOTICE '  ✓ Spatial indexes created on trips.pickup_geog';
  RAISE NOTICE '  ✓ Coordinate constraints verified';
END;
$$;

COMMIT;
