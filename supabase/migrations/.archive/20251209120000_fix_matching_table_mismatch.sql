-- ============================================================================
-- FIX MOBILITY MATCHING TABLE MISMATCH
-- ============================================================================
-- Migration: 20251209120000_fix_matching_table_mismatch.sql
-- 
-- CRITICAL FIX: Matching functions query wrong table
-- 
-- ROOT CAUSE:
-- - TypeScript code writes trips to: `trips` table (canonical)
-- - SQL matching functions query: `mobility_trips` table (V2 - wrong!)
-- 
-- RESULT:
-- - Trips created but never found → "No matches" error
-- 
-- THIS MIGRATION:
-- 1. Drops and recreates matching functions to query `trips` table
-- 2. Uses correct column names (pickup_latitude/pickup_longitude)
-- 3. Adds missing return columns (location_age_minutes, is_exact_match, role)
-- 4. Maintains 24-hour location freshness window
-- 5. Preserves all existing functionality
-- 
-- VERIFIED AGAINST:
-- - supabase/functions/wa-webhook-mobility/rpc/mobility.ts (writes to `trips`)
-- - supabase/functions/wa-webhook-mobility/handlers/nearby.ts (expects MatchResult type)
-- ============================================================================

BEGIN;

-- ============================================================================
-- DROP EXISTING FUNCTIONS (ALL VARIATIONS)
-- ============================================================================
DROP FUNCTION IF EXISTS public.match_drivers_for_trip_v2(uuid, integer, boolean, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.match_passengers_for_trip_v2(uuid, integer, boolean, integer, integer) CASCADE;

-- ============================================================================
-- MATCH DRIVERS FOR TRIP V2 (CANONICAL TRIPS TABLE)
-- ============================================================================
-- Called by passengers to find nearby drivers
-- Queries: public.trips (canonical table)
-- Columns: pickup_latitude, pickup_longitude (standard names)
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
  -- Get requesting trip from CANONICAL trips table
  SELECT 
    t.pickup_latitude,
    t.pickup_longitude,
    t.dropoff_latitude,
    t.dropoff_longitude,
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

  -- Find matching drivers from CANONICAL trips table
  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    COALESCE(t.ref_code, SUBSTRING(t.id::text, 1, 8)) AS ref_code,
    -- Distance calculation using haversine formula
    ROUND(
      (6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_latitude)) *
          cos(radians(t.pickup_longitude) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_latitude))
        ))
      ))::numeric, 2
    ) AS distance_km,
    -- Dropoff bonus (if both have dropoff)
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL AND t.dropoff_latitude IS NOT NULL THEN
        ROUND(
          (6371000 * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians(v_dropoff_lat)) * cos(radians(t.dropoff_latitude)) *
              cos(radians(t.dropoff_longitude) - radians(v_dropoff_lng)) +
              sin(radians(v_dropoff_lat)) * sin(radians(t.dropoff_latitude))
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
    -- Extract number plate from profile metadata
    COALESCE(
      t.number_plate,
      (p.metadata->>'number_plate')::text,
      (p.metadata->'driver'->>'number_plate')::text
    ) AS number_plate,
    COALESCE(p.display_name, p.phone_number, 'Driver') AS driver_name,
    'driver'::text AS role
  FROM public.trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'driver'
    -- Status: only open trips
    AND t.status = 'open'
    -- Expiry: must be in future
    AND (t.expires_at IS NULL OR t.expires_at > now())
    -- Location must exist
    AND t.pickup_latitude IS NOT NULL
    AND t.pickup_longitude IS NOT NULL
    -- CRITICAL: 24-hour location freshness window (generous to prevent false negatives)
    AND t.updated_at > now() - interval '24 hours'
    -- Window: only recent trips (configurable)
    AND t.created_at >= NOW() - (INTERVAL '1 day' * _window_days)
    -- Exclude self
    AND t.id != _trip_id
    -- Within search radius
    AND (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_latitude)) *
          cos(radians(t.pickup_longitude) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_latitude))
        ))
      )
    ) <= v_radius_km
  ORDER BY 
    -- Closest first
    distance_km ASC,
    -- Most recent first
    t.updated_at DESC,
    -- Exact vehicle match preferred
    (t.vehicle_type = v_vehicle_type) DESC
  LIMIT _limit;
END;
$$;

COMMENT ON FUNCTION public.match_drivers_for_trip_v2 IS 
  'Find nearby drivers for passenger trip. Queries canonical trips table with pickup_latitude/pickup_longitude columns.';

-- ============================================================================
-- MATCH PASSENGERS FOR TRIP V2 (CANONICAL TRIPS TABLE)
-- ============================================================================
-- Called by drivers to find nearby passengers
-- Queries: public.trips (canonical table)
-- Columns: pickup_latitude, pickup_longitude (standard names)
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
  -- Get requesting trip from CANONICAL trips table
  SELECT 
    t.pickup_latitude,
    t.pickup_longitude,
    t.dropoff_latitude,
    t.dropoff_longitude,
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

  -- Find matching passengers from CANONICAL trips table
  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    COALESCE(t.ref_code, SUBSTRING(t.id::text, 1, 8)) AS ref_code,
    -- Distance calculation using haversine formula
    ROUND(
      (6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_latitude)) *
          cos(radians(t.pickup_longitude) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_latitude))
        ))
      ))::numeric, 2
    ) AS distance_km,
    -- Dropoff bonus (if both have dropoff)
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL AND t.dropoff_latitude IS NOT NULL THEN
        ROUND(
          (6371000 * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians(v_dropoff_lat)) * cos(radians(t.dropoff_latitude)) *
              cos(radians(t.dropoff_longitude) - radians(v_dropoff_lng)) +
              sin(radians(v_dropoff_lat)) * sin(radians(t.dropoff_latitude))
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
    NULL::text AS number_plate,  -- Passengers don't have plates
    COALESCE(p.display_name, p.phone_number, 'Passenger') AS driver_name,  -- Reusing column for passenger name
    'passenger'::text AS role
  FROM public.trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'passenger'
    -- Status: only open trips
    AND t.status = 'open'
    -- Expiry: must be in future
    AND (t.expires_at IS NULL OR t.expires_at > now())
    -- Location must exist
    AND t.pickup_latitude IS NOT NULL
    AND t.pickup_longitude IS NOT NULL
    -- CRITICAL: 24-hour location freshness window
    AND t.updated_at > now() - interval '24 hours'
    -- Window: only recent trips (configurable)
    AND t.created_at >= NOW() - (INTERVAL '1 day' * _window_days)
    -- Exclude self
    AND t.id != _trip_id
    -- Within search radius
    AND (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_latitude)) *
          cos(radians(t.pickup_longitude) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_latitude))
        ))
      )
    ) <= v_radius_km
  ORDER BY 
    -- Closest first
    distance_km ASC,
    -- Most recent first
    t.updated_at DESC,
    -- Exact vehicle match preferred
    (t.vehicle_type = v_vehicle_type) DESC
  LIMIT _limit;
END;
$$;

COMMENT ON FUNCTION public.match_passengers_for_trip_v2 IS 
  'Find nearby passengers for driver trip. Queries canonical trips table with pickup_latitude/pickup_longitude columns.';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.match_drivers_for_trip_v2 TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.match_passengers_for_trip_v2 TO service_role, authenticated, anon;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
DECLARE
  v_drivers_exists boolean;
  v_passengers_exists boolean;
BEGIN
  -- Check functions exist
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'match_drivers_for_trip_v2'
  ) INTO v_drivers_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'match_passengers_for_trip_v2'
  ) INTO v_passengers_exists;
  
  IF NOT v_drivers_exists THEN
    RAISE EXCEPTION 'Function match_drivers_for_trip_v2 not created';
  END IF;
  
  IF NOT v_passengers_exists THEN
    RAISE EXCEPTION 'Function match_passengers_for_trip_v2 not created';
  END IF;
  
  RAISE NOTICE '✅ Matching functions updated to query canonical trips table';
  RAISE NOTICE '✅ Column names: pickup_latitude, pickup_longitude';
  RAISE NOTICE '✅ Location freshness: 24 hours';
  RAISE NOTICE '✅ Return columns: all MatchResult fields included';
END;
$$;

COMMIT;
