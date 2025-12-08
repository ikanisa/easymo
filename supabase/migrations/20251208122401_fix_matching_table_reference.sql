-- ============================================================================
-- FIX MOBILITY MATCHING - CORRECT TABLE AND COLUMN REFERENCES
-- ============================================================================
-- Migration: 20251208122401_fix_matching_table_reference.sql
-- 
-- PROBLEM: Production error "column p.ref_code does not exist"
-- ROOT CAUSE: Functions query from mobility_trips (V2) but edge functions
--             insert into rides_trips (V1). Column names differ:
--             - rides_trips uses: pickup_latitude, pickup_longitude, pickup_geog
--             - mobility_trips uses: pickup_lat, pickup_lng, pickup_geog
-- 
-- FIX: Update match_drivers_for_trip_v2 and match_passengers_for_trip_v2
--      to query from rides_trips (V1 table) with correct column names
-- 
-- BACKGROUND:
-- - Edge functions in supabase/functions/_shared/wa-webhook-shared/rpc/mobility.ts
--   insert trips into rides_trips table (line 76)
-- - The matching functions were incorrectly updated to query mobility_trips
-- - This causes "no matches found" because data is in different table
-- - The ref_code is generated from trip.id, not from profiles table
-- ============================================================================

BEGIN;

-- ============================================================================
-- DROP EXISTING FUNCTIONS
-- ============================================================================
DROP FUNCTION IF EXISTS public.match_drivers_for_trip_v2 CASCADE;
DROP FUNCTION IF EXISTS public.match_passengers_for_trip_v2 CASCADE;

-- ============================================================================
-- MATCH DRIVERS FOR TRIP V2 (CORRECTED TABLE REFERENCE)
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
  -- Get the requesting trip's location and vehicle type from rides_trips (V1)
  SELECT 
    t.pickup_latitude,
    t.pickup_longitude,
    t.dropoff_latitude,
    t.dropoff_longitude,
    t.vehicle_type,
    t.pickup_geog
  INTO 
    v_pickup_lat,
    v_pickup_lng,
    v_dropoff_lat,
    v_dropoff_lng,
    v_vehicle_type,
    v_pickup_geog
  FROM public.rides_trips t
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
    -- CRITICAL FIX: Generate ref_code from trip.id, NOT from profiles
    COALESCE(t.ref_code, SUBSTRING(t.id::text, 1, 8)) AS ref_code,
    -- Use PostGIS ST_Distance for accurate distance calculation
    ROUND(
      (ST_Distance(t.pickup_geog, v_pickup_geog) / 1000.0)::numeric, 
      2
    ) AS distance_km,
    -- Calculate dropoff bonus if both trips have dropoff locations
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL AND t.dropoff_latitude IS NOT NULL THEN
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
    -- Calculate location age in minutes (how fresh is their position)
    EXTRACT(EPOCH FROM (now() - COALESCE(t.last_location_at, t.created_at)))::integer / 60 AS location_age_minutes,
    -- Number plate from trip or profile metadata
    COALESCE(
      t.number_plate, 
      (p.metadata->>'number_plate')::text, 
      (p.metadata->'driver'->>'number_plate')::text
    ) AS number_plate,
    -- FIXED: Use display_name instead of full_name
    COALESCE(p.display_name, p.phone_number, p.wa_id) AS driver_name,
    'driver'::text AS role
  FROM public.rides_trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'driver'
    -- Status: open, pending, or active trips
    AND t.status IN ('open', 'pending', 'active')
    -- Expiry: NULL expires_at means never expires, otherwise must be in future
    AND (t.expires_at IS NULL OR t.expires_at > now())
    -- Location must exist
    AND t.pickup_latitude IS NOT NULL
    AND t.pickup_longitude IS NOT NULL
    -- Location freshness: 24 hours window (generous to prevent false negatives)
    AND COALESCE(t.last_location_at, t.created_at) > now() - interval '24 hours'
    -- Window: Only trips created within the window (default 2 days)
    AND t.created_at > now() - (_window_days || ' days')::interval
    -- Exclude the requesting trip
    AND t.id != _trip_id
    -- Spatial filter: Within search radius (uses PostGIS GIST index)
    AND ST_DWithin(
      t.pickup_geog,
      v_pickup_geog,
      _radius_m::double precision
    )
  ORDER BY 
    -- Primary: Distance (closest first)
    ST_Distance(t.pickup_geog, v_pickup_geog) ASC,
    -- Secondary: Most recently active
    COALESCE(t.last_location_at, t.created_at) DESC,
    -- Tertiary: Exact vehicle match preferred
    (t.vehicle_type = v_vehicle_type) DESC
  LIMIT _limit;
END;
$$;

COMMENT ON FUNCTION public.match_drivers_for_trip_v2 IS 
  'Find nearby drivers for a passenger trip. Fixed to query rides_trips (V1) table with correct column names.';

-- ============================================================================
-- MATCH PASSENGERS FOR TRIP V2 (CORRECTED TABLE REFERENCE)
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
  -- Get the requesting trip's location and vehicle type from rides_trips (V1)
  SELECT 
    t.pickup_latitude,
    t.pickup_longitude,
    t.dropoff_latitude,
    t.dropoff_longitude,
    t.vehicle_type,
    t.pickup_geog
  INTO 
    v_pickup_lat,
    v_pickup_lng,
    v_dropoff_lat,
    v_dropoff_lng,
    v_vehicle_type,
    v_pickup_geog
  FROM public.rides_trips t
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
    -- CRITICAL FIX: Generate ref_code from trip.id, NOT from profiles
    COALESCE(t.ref_code, SUBSTRING(t.id::text, 1, 8)) AS ref_code,
    -- Use PostGIS ST_Distance for accurate distance calculation
    ROUND(
      (ST_Distance(t.pickup_geog, v_pickup_geog) / 1000.0)::numeric, 
      2
    ) AS distance_km,
    -- Calculate dropoff bonus if both trips have dropoff locations
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL AND t.dropoff_latitude IS NOT NULL THEN
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
    -- Calculate location age in minutes
    EXTRACT(EPOCH FROM (now() - COALESCE(t.last_location_at, t.created_at)))::integer / 60 AS location_age_minutes,
    NULL::text AS number_plate,  -- Passengers don't have number plates
    -- FIXED: Use display_name instead of full_name
    COALESCE(p.display_name, p.phone_number, p.wa_id) AS driver_name,  -- Reusing column name for passenger name
    'passenger'::text AS role
  FROM public.rides_trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'passenger'
    -- Status: open, pending, or active trips
    AND t.status IN ('open', 'pending', 'active')
    -- Expiry: NULL expires_at means never expires, otherwise must be in future
    AND (t.expires_at IS NULL OR t.expires_at > now())
    -- Location must exist
    AND t.pickup_latitude IS NOT NULL
    AND t.pickup_longitude IS NOT NULL
    -- Location freshness: 24 hours window (generous to prevent false negatives)
    AND COALESCE(t.last_location_at, t.created_at) > now() - interval '24 hours'
    -- Window: Only trips created within the window (default 2 days)
    AND t.created_at > now() - (_window_days || ' days')::interval
    -- Exclude the requesting trip
    AND t.id != _trip_id
    -- Spatial filter: Within search radius (uses PostGIS GIST index)
    AND ST_DWithin(
      t.pickup_geog,
      v_pickup_geog,
      _radius_m::double precision
    )
  ORDER BY 
    -- Primary: Distance (closest first)
    ST_Distance(t.pickup_geog, v_pickup_geog) ASC,
    -- Secondary: Most recently active
    COALESCE(t.last_location_at, t.created_at) DESC,
    -- Tertiary: Exact vehicle match preferred
    (t.vehicle_type = v_vehicle_type) DESC
  LIMIT _limit;
END;
$$;

COMMENT ON FUNCTION public.match_passengers_for_trip_v2 IS 
  'Find nearby passengers for a driver trip. Fixed to query rides_trips (V1) table with correct column names.';

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
  
  RAISE NOTICE 'Matching functions fixed: now querying rides_trips with correct column names (pickup_latitude/pickup_longitude)';
END;
$$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
-- 
-- FIXED ISSUES:
-- ✓ Changed table reference from mobility_trips to rides_trips
-- ✓ Changed column names from pickup_lat/pickup_lng to pickup_latitude/pickup_longitude
-- ✓ Generate ref_code from trip.id using SUBSTRING(t.id::text, 1, 8)
-- ✓ No reference to p.ref_code (profiles table doesn't have this column)
-- ✓ Use display_name from profiles (not full_name)
-- ✓ Proper geography column usage (pickup_geog, dropoff_geog)
-- ✓ PostGIS ST_Distance for accurate distance calculations
-- 
-- EXPECTED OUTCOME:
-- 1. User shares location → Trip created in rides_trips
-- 2. match_drivers_for_trip_v2 called → Queries rides_trips successfully
-- 3. Returns nearby drivers with ref_code generated from trip UUID
-- 4. No more "column p.ref_code does not exist" errors
-- 
-- ============================================================================
