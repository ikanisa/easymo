-- ============================================================================
-- FIX: 30-Minute Time Window for Mobility Matching
-- ============================================================================
-- Migration: 20251211083000_fix_mobility_30min_window.sql
-- 
-- ISSUE: 
-- - Trips use 48-hour (2 day) window instead of 30 minutes
-- - Location freshness check uses 24 hours instead of 30 minutes
-- - Trip expiry set to 90 minutes instead of 30 minutes
-- 
-- FIX:
-- - Change matching window from days to minutes (_window_days → _window_minutes)
-- - Update location freshness from 24 hours to 30 minutes
-- - Update trip creation filters to 30-minute window
-- - Default window: 30 minutes (not 2 days)
-- 
-- IMPACT:
-- - More accurate real-time matching
-- - Only fresh trips (< 30 min) shown in results
-- - Faster queries (smaller dataset)
-- - Better user experience
-- ============================================================================

BEGIN;

-- ============================================================================
-- DROP EXISTING FUNCTIONS
-- ============================================================================
DROP FUNCTION IF EXISTS public.match_drivers_for_trip_v2(uuid, integer, boolean, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.match_passengers_for_trip_v2(uuid, integer, boolean, integer, integer) CASCADE;

-- ============================================================================
-- MATCH DRIVERS FOR TRIP V2 (30-MINUTE WINDOW)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.match_drivers_for_trip_v2(
  _trip_id uuid,
  _limit integer DEFAULT 9,
  _prefer_dropoff boolean DEFAULT false,
  _radius_m integer DEFAULT 10000,
  _window_minutes integer DEFAULT 30  -- CHANGED: from _window_days (was default 2 days)
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
  v_window_minutes integer;
BEGIN
  -- Get requesting trip
  SELECT 
    t.pickup_lat,
    t.pickup_lng,
    t.dropoff_lat,
    t.dropoff_lng,
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

  -- Use provided window or default to 30 minutes
  v_window_minutes := COALESCE(_window_minutes, 30);

  -- Find matching drivers
  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.user_id AS creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    COALESCE(t.metadata->>'ref_code', SUBSTRING(t.id::text, 1, 8)) AS ref_code,
    -- Distance calculation using haversine formula
    ROUND(
      (6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_lat)) *
          cos(radians(t.pickup_lng) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_lat))
        ))
      ))::numeric, 2
    ) AS distance_km,
    -- Dropoff bonus (if both have dropoff)
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL AND t.dropoff_lat IS NOT NULL THEN
        ROUND(
          (6371000 * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians(v_dropoff_lat)) * cos(radians(t.dropoff_lat)) *
              cos(radians(t.dropoff_lng) - radians(v_dropoff_lng)) +
              sin(radians(v_dropoff_lat)) * sin(radians(t.dropoff_lat))
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
  INNER JOIN public.profiles p ON p.user_id = t.user_id
  WHERE t.role = 'driver'
    -- Status: only open trips
    AND t.status = 'open'
    -- Expiry: must be in future
    AND (t.expires_at IS NULL OR t.expires_at > now())
    -- Location must exist
    AND t.pickup_lat IS NOT NULL
    AND t.pickup_lng IS NOT NULL
    -- FIXED: 30-minute location freshness (was 24 hours)
    AND t.updated_at > now() - (v_window_minutes || ' minutes')::interval
    -- FIXED: 30-minute window for trip creation (was 2 days)
    AND t.created_at >= now() - (v_window_minutes || ' minutes')::interval
    -- Exclude self
    AND t.id != _trip_id
    -- Within search radius
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
-- MATCH PASSENGERS FOR TRIP V2 (30-MINUTE WINDOW)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.match_passengers_for_trip_v2(
  _trip_id uuid,
  _limit integer DEFAULT 9,
  _prefer_dropoff boolean DEFAULT false,
  _radius_m integer DEFAULT 10000,
  _window_minutes integer DEFAULT 30  -- CHANGED: from _window_days (was default 2 days)
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
  v_window_minutes integer;
BEGIN
  -- Get requesting trip
  SELECT 
    t.pickup_lat,
    t.pickup_lng,
    t.dropoff_lat,
    t.dropoff_lng,
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

  -- Use provided window or default to 30 minutes
  v_window_minutes := COALESCE(_window_minutes, 30);

  -- Find matching passengers
  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.user_id AS creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    COALESCE(t.metadata->>'ref_code', SUBSTRING(t.id::text, 1, 8)) AS ref_code,
    -- Distance calculation
    ROUND(
      (6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_lat)) *
          cos(radians(t.pickup_lng) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_lat))
        ))
      ))::numeric, 2
    ) AS distance_km,
    -- Dropoff bonus
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL AND t.dropoff_lat IS NOT NULL THEN
        ROUND(
          (6371000 * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians(v_dropoff_lat)) * cos(radians(t.dropoff_lat)) *
              cos(radians(t.dropoff_lng) - radians(v_dropoff_lng)) +
              sin(radians(v_dropoff_lat)) * sin(radians(t.dropoff_lat))
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
  INNER JOIN public.profiles p ON p.user_id = t.user_id
  WHERE t.role = 'passenger'
    AND t.status = 'open'
    AND (t.expires_at IS NULL OR t.expires_at > now())
    AND t.pickup_lat IS NOT NULL
    AND t.pickup_lng IS NOT NULL
    -- FIXED: 30-minute location freshness (was 24 hours)
    AND t.updated_at > now() - (v_window_minutes || ' minutes')::interval
    -- FIXED: 30-minute window for trip creation (was 2 days)
    AND t.created_at >= now() - (v_window_minutes || ' minutes')::interval
    AND t.id != _trip_id
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
  RAISE NOTICE '✅ Fixed matching functions to use 30-minute window';
  RAISE NOTICE '✅ Changed _window_days (2 days) → _window_minutes (30 min)';
  RAISE NOTICE '✅ Location freshness: 24 hours → 30 minutes';
  RAISE NOTICE '✅ Trip creation window: 48 hours → 30 minutes';
  RAISE NOTICE '✅ Real-time matching enabled';
END;
$$;

COMMIT;
