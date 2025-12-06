-- ============================================================================
-- DEFINITIVE FIX FOR MOBILITY MATCHING FUNCTIONS
-- ============================================================================
-- Migration: 20251206090000_fix_mobility_matching_definitive.sql
-- 
-- PROBLEM: Users get "No matches found" even when active rides exist in DB.
-- 
-- ROOT CAUSES FIXED:
-- 1. Table name consistency: Uses `mobility_trips` (V2 table - where app writes)
-- 2. Location freshness: Increased from 30 minutes to 24 hours
-- 3. Expiry handling: NULL expires_at now accepted (never expires)
-- 4. Return columns: All required fields for TypeScript interfaces
-- 
-- IMPORTANT: The edge functions write to `mobility_trips` (V2 schema),
-- so the matching functions must also query from `mobility_trips`.
-- 
-- V2 Schema differences from V1:
-- - pickup_lat/pickup_lng instead of pickup_latitude/pickup_longitude
-- - pickup_geog is auto-generated (STORED) from lat/lng
-- - last_location_update instead of last_location_at
-- - No ref_code column (use substring of id)
-- - No number_plate column (fetch from profiles.metadata)
-- 
-- This migration drops and recreates the matching functions with:
-- - Correct table reference (`mobility_trips`)
-- - 24-hour location freshness window (was 30 minutes)
-- - NULL expires_at handling (treat as never expires)
-- - All required return columns
-- - Proper grants for service_role, authenticated, anon
-- ============================================================================

BEGIN;

-- ============================================================================
-- DROP EXISTING FUNCTIONS
-- ============================================================================
DROP FUNCTION IF EXISTS public.match_drivers_for_trip_v2 CASCADE;
DROP FUNCTION IF EXISTS public.match_passengers_for_trip_v2 CASCADE;

-- ============================================================================
-- MATCH DRIVERS FOR TRIP V2
-- ============================================================================
-- Called by passengers to find nearby drivers
-- Returns drivers within radius who have recent location updates
-- Uses V2 schema (mobility_trips table)
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
    -- Calculate dropoff bonus if both trips have dropoff locations
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
    -- Calculate location age in minutes (how fresh is their position)
    EXTRACT(EPOCH FROM (now() - COALESCE(t.last_location_update, t.created_at)))::integer / 60 AS location_age_minutes,
    -- Number plate from profile metadata (drivers often store it there)
    COALESCE((p.metadata->>'number_plate')::text, (p.metadata->'driver'->>'number_plate')::text) AS number_plate,
    p.full_name AS driver_name,
    'driver'::text AS role
  FROM public.mobility_trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'driver'
    -- Status: only open trips (V2 simplified statuses)
    AND t.status = 'open'
    -- Expiry: NULL expires_at means never expires, otherwise must be in future
    AND (t.expires_at IS NULL OR t.expires_at > now())
    -- Location must exist
    AND t.pickup_lat IS NOT NULL
    AND t.pickup_lng IS NOT NULL
    -- CRITICAL FIX: Location freshness increased from 30 minutes to 24 hours
    -- This prevents excluding drivers who haven't updated location recently.
    -- Note: Hardcoded to 24 hours intentionally - this is a generous window to
    -- prevent false negatives. The _window_days parameter controls trip age instead.
    -- See MOBILITY_CONFIG.SQL_LOCATION_FRESHNESS_HOURS in config/mobility.ts
    AND COALESCE(t.last_location_update, t.created_at) > now() - interval '24 hours'
    -- Window: Only trips created within the window (default 2 days)
    AND t.created_at > now() - (_window_days || ' days')::interval
    -- Exclude the requesting trip
    AND t.id != _trip_id
    -- Spatial filter: Within search radius
    AND ST_DWithin(
      t.pickup_geog,
      v_pickup_geog,
      _radius_m::double precision
    )
  ORDER BY 
    -- Primary: Distance (closest first)
    ST_Distance(t.pickup_geog, v_pickup_geog) ASC,
    -- Secondary: Most recently active
    COALESCE(t.last_location_update, t.created_at) DESC,
    -- Tertiary: Exact vehicle match preferred
    (t.vehicle_type = v_vehicle_type) DESC
  LIMIT _limit;
END;
$$;

COMMENT ON FUNCTION public.match_drivers_for_trip_v2 IS 
  'Find nearby drivers for a passenger trip. Uses mobility_trips (V2) table with 24-hour location freshness window.';

-- ============================================================================
-- MATCH PASSENGERS FOR TRIP V2
-- ============================================================================
-- Called by drivers to find nearby passengers
-- Returns passengers within radius who have recent location updates
-- Uses V2 schema (mobility_trips table)
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
    -- Calculate dropoff bonus if both trips have dropoff locations
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
    -- Calculate location age in minutes
    EXTRACT(EPOCH FROM (now() - COALESCE(t.last_location_update, t.created_at)))::integer / 60 AS location_age_minutes,
    NULL::text AS number_plate,  -- Passengers don't have number plates
    p.full_name AS driver_name,  -- Reusing column name for passenger name
    'passenger'::text AS role
  FROM public.mobility_trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'passenger'
    -- Status: only open trips (V2 simplified statuses)
    AND t.status = 'open'
    -- Expiry: NULL expires_at means never expires, otherwise must be in future
    AND (t.expires_at IS NULL OR t.expires_at > now())
    -- Location must exist
    AND t.pickup_lat IS NOT NULL
    AND t.pickup_lng IS NOT NULL
    -- CRITICAL FIX: Location freshness increased from 30 minutes to 24 hours
    -- This prevents excluding passengers who haven't updated location recently.
    -- Note: Hardcoded to 24 hours intentionally - this is a generous window to
    -- prevent false negatives. The _window_days parameter controls trip age instead.
    -- See MOBILITY_CONFIG.SQL_LOCATION_FRESHNESS_HOURS in config/mobility.ts
    AND COALESCE(t.last_location_update, t.created_at) > now() - interval '24 hours'
    -- Window: Only trips created within the window (default 2 days)
    AND t.created_at > now() - (_window_days || ' days')::interval
    -- Exclude the requesting trip
    AND t.id != _trip_id
    -- Spatial filter: Within search radius
    AND ST_DWithin(
      t.pickup_geog,
      v_pickup_geog,
      _radius_m::double precision
    )
  ORDER BY 
    -- Primary: Distance (closest first)
    ST_Distance(t.pickup_geog, v_pickup_geog) ASC,
    -- Secondary: Most recently active
    COALESCE(t.last_location_update, t.created_at) DESC,
    -- Tertiary: Exact vehicle match preferred
    (t.vehicle_type = v_vehicle_type) DESC
  LIMIT _limit;
END;
$$;

COMMENT ON FUNCTION public.match_passengers_for_trip_v2 IS 
  'Find nearby passengers for a driver trip. Uses mobility_trips (V2) table with 24-hour location freshness window.';

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
  -- Verify functions exist
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
  
  RAISE NOTICE 'Matching functions created successfully with V2 schema and 24-hour location freshness';
END;
$$;

COMMIT;
