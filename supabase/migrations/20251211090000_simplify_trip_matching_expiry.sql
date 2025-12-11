-- ============================================================================
-- FIX: Simplify Trip Matching - Use expires_at Only
-- ============================================================================
-- Migration: 20251211090000_simplify_trip_matching_expiry.sql
-- 
-- ISSUE:
-- - Current logic checks multiple time conditions (created_at, updated_at, expires_at)
-- - Scheduled trips have wrong expiry calculation (7 days from now instead of 30 min after travel time)
-- - Overcomplicated matching logic
-- 
-- CORRECT LOGIC:
-- - Trip expires 30 minutes AFTER the travel time (scheduled_for OR now)
-- - Matching only needs to check: expires_at > now()
-- - No need for _window_minutes parameter - expiry handles everything
-- 
-- EXAMPLES:
-- - Immediate trip created at 10:00 → expires at 10:30
-- - Trip scheduled for 11:00 created at 10:00 → expires at 11:30
-- - Trip scheduled for 14:00 created at 10:00 → expires at 14:30
-- ============================================================================

BEGIN;

-- ============================================================================
-- DROP OLD FUNCTIONS
-- ============================================================================
DROP FUNCTION IF EXISTS public.match_drivers_for_trip_v2(uuid, integer, boolean, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.match_passengers_for_trip_v2(uuid, integer, boolean, integer, integer) CASCADE;

-- ============================================================================
-- SIMPLIFIED MATCH DRIVERS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.match_drivers_for_trip_v2(
  _trip_id uuid,
  _limit integer DEFAULT 9,
  _prefer_dropoff boolean DEFAULT false,
  _radius_m integer DEFAULT 10000
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
  role text,
  scheduled_for timestamptz,
  expires_at timestamptz
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

  -- Find matching drivers - SIMPLIFIED LOGIC
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
    EXTRACT(EPOCH FROM (now() - COALESCE(t.updated_at, t.created_at)))::integer / 60 AS location_age_minutes,
    -- Extract number plate from metadata
    COALESCE(
      (t.metadata->>'number_plate')::text,
      (p.metadata->>'number_plate')::text,
      (p.metadata->'driver'->>'number_plate')::text
    ) AS number_plate,
    COALESCE(p.display_name, p.phone_number, 'Driver') AS driver_name,
    'driver'::text AS role,
    t.scheduled_for,
    t.expires_at
  FROM public.trips t
  INNER JOIN public.profiles p ON p.user_id = t.user_id
  WHERE t.role = 'driver'
    -- SIMPLIFIED: Only check these essential conditions
    AND t.status = 'open'
    AND t.expires_at > now()  -- ✅ SIMPLE: Trip hasn't expired yet
    AND t.pickup_lat IS NOT NULL
    AND t.pickup_lng IS NOT NULL
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
    t.scheduled_for ASC NULLS FIRST,  -- Immediate trips first, then by travel time
    distance_km ASC,
    (t.vehicle_type = v_vehicle_type) DESC
  LIMIT _limit;
END;
$$;

-- ============================================================================
-- SIMPLIFIED MATCH PASSENGERS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.match_passengers_for_trip_v2(
  _trip_id uuid,
  _limit integer DEFAULT 9,
  _prefer_dropoff boolean DEFAULT false,
  _radius_m integer DEFAULT 10000
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
  role text,
  scheduled_for timestamptz,
  expires_at timestamptz
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

  -- Find matching passengers - SIMPLIFIED LOGIC
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
    EXTRACT(EPOCH FROM (now() - COALESCE(t.updated_at, t.created_at)))::integer / 60 AS location_age_minutes,
    NULL::text AS number_plate,
    COALESCE(p.display_name, p.phone_number, 'Passenger') AS driver_name,
    'passenger'::text AS role,
    t.scheduled_for,
    t.expires_at
  FROM public.trips t
  INNER JOIN public.profiles p ON p.user_id = t.user_id
  WHERE t.role = 'passenger'
    -- SIMPLIFIED: Only check these essential conditions
    AND t.status = 'open'
    AND t.expires_at > now()  -- ✅ SIMPLE: Trip hasn't expired yet
    AND t.pickup_lat IS NOT NULL
    AND t.pickup_lng IS NOT NULL
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
    t.scheduled_for ASC NULLS FIRST,  -- Immediate trips first, then by travel time
    distance_km ASC,
    (t.vehicle_type = v_vehicle_type) DESC
  LIMIT _limit;
END;
$$;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.match_drivers_for_trip_v2(uuid, integer, boolean, integer) TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.match_passengers_for_trip_v2(uuid, integer, boolean, integer) TO service_role, authenticated, anon;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Simplified trip matching logic';
  RAISE NOTICE '✅ Removed _window_minutes parameter';
  RAISE NOTICE '✅ Only checks expires_at > now()';
  RAISE NOTICE '✅ Trip expires 30 min after travel time (scheduled_for OR now)';
  RAISE NOTICE '✅ Orders by scheduled_for (immediate trips first)';
END;
$$;

COMMIT;
