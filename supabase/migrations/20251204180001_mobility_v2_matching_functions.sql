-- ============================================================================
-- MOBILITY V2 - MATCHING FUNCTIONS
-- ============================================================================
-- Companion to 20251204180000_mobility_v2_complete_schema.sql
-- Adds RPC functions for matching service
-- ============================================================================

BEGIN;

-- ============================================================================
-- SPATIAL MATCHING FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION find_nearby_trips_v2(
  p_lat double precision,
  p_lng double precision,
  p_role text,
  p_vehicle_type text,
  p_radius_km numeric DEFAULT 15.0,
  p_limit integer DEFAULT 20,
  p_freshness_minutes integer DEFAULT 30
)
RETURNS TABLE (
  trip_id uuid,
  user_id uuid,
  role text,
  vehicle_type text,
  pickup_lat double precision,
  pickup_lng double precision,
  pickup_text text,
  dropoff_lat double precision,
  dropoff_lng double precision,
  dropoff_text text,
  distance_km numeric,
  created_at timestamptz,
  last_location_update timestamptz,
  location_age_minutes integer,
  metadata jsonb
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_search_point geography;
  v_radius_meters numeric;
BEGIN
  -- Convert lat/lng to PostGIS geography
  v_search_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  v_radius_meters := p_radius_km * 1000;
  
  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.creator_user_id AS user_id,
    t.role,
    t.vehicle_type,
    t.pickup_lat,
    t.pickup_lng,
    t.pickup_text,
    t.dropoff_lat,
    t.dropoff_lng,
    t.dropoff_text,
    ROUND((ST_Distance(t.pickup_geog, v_search_point) / 1000.0)::numeric, 2) AS distance_km,
    t.created_at,
    t.last_location_update,
    EXTRACT(EPOCH FROM (now() - t.last_location_update))::integer / 60 AS location_age_minutes,
    t.metadata
  FROM mobility_trips t
  WHERE t.role = p_role
    AND t.status = 'open'
    AND t.expires_at > now()
    AND t.vehicle_type = p_vehicle_type
    AND t.last_location_update > now() - (p_freshness_minutes || ' minutes')::interval
    AND ST_DWithin(t.pickup_geog, v_search_point, v_radius_meters)
  ORDER BY ST_Distance(t.pickup_geog, v_search_point) ASC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION find_nearby_trips_v2 IS 'Find nearby trips using PostGIS spatial search. Used by matching-service.';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION find_nearby_trips_v2 TO service_role;
GRANT EXECUTE ON FUNCTION find_nearby_trips_v2 TO authenticated;

COMMIT;
