-- ============================================================================
-- SIMPLIFIED NEARBY RPC FUNCTIONS
-- ============================================================================
-- Migration: 20251208092600_create_nearby_rpc_functions.sql
-- Purpose: Create simple find_nearby_drivers and find_nearby_passengers functions
--          that query the canonical trips table using PostGIS spatial indexes
-- 
-- Key principles:
-- - No match-related logic (matches are out of scope)
-- - Use PostGIS for efficient spatial queries
-- - Return only essential fields for WhatsApp display
-- - Simple, maintainable, performant
-- ============================================================================

BEGIN;

-- ============================================================================
-- FUNCTION: find_nearby_drivers
-- ============================================================================
-- Find nearby drivers based on passenger trip request
-- Used when passenger wants to see available drivers

CREATE OR REPLACE FUNCTION public.find_nearby_drivers(
  p_passenger_trip_id uuid,
  p_limit integer DEFAULT 9,
  p_radius_m integer DEFAULT 10000
)
RETURNS TABLE (
  trip_id uuid,
  driver_user_id uuid,
  whatsapp_number text,
  ref_code text,
  distance_m numeric,
  pickup_text text,
  dropoff_text text,
  vehicle_type text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_passenger_lat double precision;
  v_passenger_lng double precision;
  v_vehicle_type text;
  v_dropoff_lat double precision;
  v_dropoff_lng double precision;
BEGIN
  -- Get passenger trip details
  SELECT 
    pickup_latitude,
    pickup_longitude,
    vehicle_type,
    dropoff_latitude,
    dropoff_longitude
  INTO 
    v_passenger_lat,
    v_passenger_lng,
    v_vehicle_type,
    v_dropoff_lat,
    v_dropoff_lng
  FROM public.trips
  WHERE id = p_passenger_trip_id
    AND role = 'passenger';

  -- If trip not found or invalid, return empty
  IF v_passenger_lat IS NULL THEN
    RETURN;
  END IF;

  -- Find nearby drivers using PostGIS spatial index
  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.creator_user_id AS driver_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_number,
    COALESCE(t.ref_code, SUBSTRING(t.id::text, 1, 8)) AS ref_code,
    -- Calculate distance using PostGIS
    ROUND(
      ST_Distance(
        t.pickup_geog,
        ST_SetSRID(ST_MakePoint(v_passenger_lng, v_passenger_lat), 4326)::geography
      )::numeric,
      0
    ) AS distance_m,
    t.pickup_text,
    t.dropoff_text,
    t.vehicle_type,
    t.created_at
  FROM public.trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'driver'
    AND t.status = 'open'
    AND t.expires_at > now()
    AND t.vehicle_type = v_vehicle_type
    -- Use PostGIS spatial query with index
    AND ST_DWithin(
      t.pickup_geog,
      ST_SetSRID(ST_MakePoint(v_passenger_lng, v_passenger_lat), 4326)::geography,
      p_radius_m
    )
    AND t.id != p_passenger_trip_id
  ORDER BY 
    -- Prioritize by distance
    ST_Distance(
      t.pickup_geog,
      ST_SetSRID(ST_MakePoint(v_passenger_lng, v_passenger_lat), 4326)::geography
    ) ASC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.find_nearby_drivers IS 
  'Find nearby available drivers for a passenger trip request. Uses PostGIS spatial index for performance.';

-- ============================================================================
-- FUNCTION: find_nearby_passengers
-- ============================================================================
-- Find nearby passengers based on driver trip offer
-- Used when driver wants to see passengers looking for rides

CREATE OR REPLACE FUNCTION public.find_nearby_passengers(
  p_driver_trip_id uuid,
  p_limit integer DEFAULT 9,
  p_radius_m integer DEFAULT 10000
)
RETURNS TABLE (
  trip_id uuid,
  passenger_user_id uuid,
  whatsapp_number text,
  ref_code text,
  distance_m numeric,
  pickup_text text,
  dropoff_text text,
  vehicle_type text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_driver_lat double precision;
  v_driver_lng double precision;
  v_vehicle_type text;
  v_dropoff_lat double precision;
  v_dropoff_lng double precision;
BEGIN
  -- Get driver trip details
  SELECT 
    pickup_latitude,
    pickup_longitude,
    vehicle_type,
    dropoff_latitude,
    dropoff_longitude
  INTO 
    v_driver_lat,
    v_driver_lng,
    v_vehicle_type,
    v_dropoff_lat,
    v_dropoff_lng
  FROM public.trips
  WHERE id = p_driver_trip_id
    AND role = 'driver';

  -- If trip not found or invalid, return empty
  IF v_driver_lat IS NULL THEN
    RETURN;
  END IF;

  -- Find nearby passengers using PostGIS spatial index
  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.creator_user_id AS passenger_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_number,
    COALESCE(t.ref_code, SUBSTRING(t.id::text, 1, 8)) AS ref_code,
    -- Calculate distance using PostGIS
    ROUND(
      ST_Distance(
        t.pickup_geog,
        ST_SetSRID(ST_MakePoint(v_driver_lng, v_driver_lat), 4326)::geography
      )::numeric,
      0
    ) AS distance_m,
    t.pickup_text,
    t.dropoff_text,
    t.vehicle_type,
    t.created_at
  FROM public.trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'passenger'
    AND t.status = 'open'
    AND t.expires_at > now()
    AND t.vehicle_type = v_vehicle_type
    -- Use PostGIS spatial query with index
    AND ST_DWithin(
      t.pickup_geog,
      ST_SetSRID(ST_MakePoint(v_driver_lng, v_driver_lat), 4326)::geography,
      p_radius_m
    )
    AND t.id != p_driver_trip_id
  ORDER BY 
    -- Prioritize by distance
    ST_Distance(
      t.pickup_geog,
      ST_SetSRID(ST_MakePoint(v_driver_lng, v_driver_lat), 4326)::geography
    ) ASC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.find_nearby_passengers IS 
  'Find nearby passengers looking for rides for a driver trip offer. Uses PostGIS spatial index for performance.';

-- ============================================================================
-- FUNCTION: get_user_recent_trips
-- ============================================================================
-- Get user's recent trips (for history/management)

CREATE OR REPLACE FUNCTION public.get_user_recent_trips(
  p_user_id uuid,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  trip_id uuid,
  trip_kind text,
  role text,
  vehicle_type text,
  pickup_text text,
  dropoff_text text,
  status text,
  scheduled_at timestamptz,
  created_at timestamptz,
  ref_code text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.trip_kind,
    t.role,
    t.vehicle_type,
    t.pickup_text,
    t.dropoff_text,
    t.status,
    t.scheduled_at,
    t.created_at,
    COALESCE(t.ref_code, SUBSTRING(t.id::text, 1, 8)) AS ref_code
  FROM public.trips t
  WHERE t.creator_user_id = p_user_id
  ORDER BY t.created_at DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.get_user_recent_trips IS 
  'Get user recent trips for history display';

-- ============================================================================
-- FUNCTION: cancel_trip
-- ============================================================================
-- Cancel a trip (set status to cancelled)

CREATE OR REPLACE FUNCTION public.cancel_trip(
  p_trip_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated boolean;
BEGIN
  UPDATE public.trips
  SET 
    status = 'cancelled',
    updated_at = now()
  WHERE id = p_trip_id
    AND creator_user_id = p_user_id
    AND status = 'open';
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

COMMENT ON FUNCTION public.cancel_trip IS 
  'Cancel a trip by ID if owned by user and currently open';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.find_nearby_drivers TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_nearby_passengers TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_recent_trips TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_trip TO authenticated;

GRANT EXECUTE ON FUNCTION public.find_nearby_drivers TO service_role;
GRANT EXECUTE ON FUNCTION public.find_nearby_passengers TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_recent_trips TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_trip TO service_role;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  -- Test that functions exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'find_nearby_drivers'
  ) THEN
    RAISE EXCEPTION 'Function find_nearby_drivers was not created';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'find_nearby_passengers'
  ) THEN
    RAISE EXCEPTION 'Function find_nearby_passengers was not created';
  END IF;
  
  RAISE NOTICE 'Successfully created simplified nearby RPC functions';
END;
$$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
-- 
-- COMPLETED:
-- ✓ Created find_nearby_drivers function (PostGIS spatial query)
-- ✓ Created find_nearby_passengers function (PostGIS spatial query)
-- ✓ Created get_user_recent_trips function
-- ✓ Created cancel_trip function
-- ✓ All functions use SECURITY DEFINER for RLS bypass
-- ✓ All functions leverage PostGIS spatial indexes
-- 
-- NEXT STEPS:
-- 1. Update edge functions to use these new RPC functions
-- 2. Remove old match-related logic from edge functions
-- 3. Create backward compatibility views
-- 4. Archive/remove old tables
-- 
-- USAGE EXAMPLES:
-- 
-- -- Find nearby drivers for passenger trip
-- SELECT * FROM find_nearby_drivers('passenger-trip-uuid', 9, 10000);
-- 
-- -- Find nearby passengers for driver trip
-- SELECT * FROM find_nearby_passengers('driver-trip-uuid', 9, 10000);
-- 
-- -- Get user's recent trips
-- SELECT * FROM get_user_recent_trips('user-uuid', 20);
-- 
-- -- Cancel a trip
-- SELECT cancel_trip('trip-uuid', 'user-uuid');
-- 
-- ============================================================================
