-- Transition compatibility and function rewrites
BEGIN;

-- Create compatibility view for mobility_trips (table will be dropped in next migration)
-- First, check if we need to drop existing view
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'mobility_trips_compat') THEN
    DROP VIEW public.mobility_trips_compat CASCADE;
  END IF;
END $$;

CREATE VIEW mobility_trips_compat AS
SELECT
  id,
  user_id AS creator_user_id,
  role,
  COALESCE(vehicle_type, 'car') AS vehicle_type,
  pickup_lat,
  pickup_lng,
  pickup_geog,
  pickup_text,
  NULL::double precision AS dropoff_lat,
  NULL::double precision AS dropoff_lng,
  NULL::geography AS dropoff_geog,
  NULL::text AS dropoff_text,
  NULL::integer AS pickup_radius_m,
  NULL::integer AS dropoff_radius_m,
  CASE status
    WHEN 'open' THEN 'open'
    WHEN 'expired' THEN 'expired'
    WHEN 'cancelled' THEN 'expired'
    ELSE 'open'
  END AS status,
  created_at,
  NULL::timestamptz AS matched_at,
  expires_at,
  updated_at AS last_location_update,
  scheduled_for,
  NULL::text AS recurrence,
  metadata
FROM public.trips;

-- Drop and rewrite find_nearby_trips_v2 to use trips
DROP FUNCTION IF EXISTS find_nearby_trips_v2(double precision, double precision, text, text, numeric, integer, integer);

CREATE OR REPLACE FUNCTION find_nearby_trips_v2(
  p_lat double precision,
  p_lng double precision,
  p_role text,
  p_vehicle_type text DEFAULT NULL,
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
  distance_km numeric,
  created_at timestamptz,
  updated_at timestamptz,
  metadata jsonb
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_search_point geography;
  v_radius_meters numeric;
BEGIN
  v_search_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  v_radius_meters := p_radius_km * 1000;

  RETURN QUERY
  SELECT
    t.id,
    t.user_id,
    t.role,
    t.vehicle_type,
    t.pickup_lat,
    t.pickup_lng,
    t.pickup_text,
    ROUND((ST_Distance(t.pickup_geog, v_search_point) / 1000.0)::numeric, 2) AS distance_km,
    t.created_at,
    t.updated_at,
    t.metadata
  FROM public.trips t
  WHERE t.status = 'open'
    AND t.kind IN ('scheduled','request_intent')
    AND (t.expires_at IS NULL OR t.expires_at > now())
    AND (p_vehicle_type IS NULL OR t.vehicle_type = p_vehicle_type)
    AND t.updated_at > now() - (p_freshness_minutes || ' minutes')::interval
    AND ST_DWithin(t.pickup_geog, v_search_point, v_radius_meters)
  ORDER BY ST_Distance(t.pickup_geog, v_search_point)
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION find_nearby_trips_v2 TO service_role, authenticated;

-- Disable triggers tied to matches/metrics (safe no-ops if absent)
DROP TRIGGER IF EXISTS trg_update_metrics_on_completion ON mobility_trip_matches;
DROP TRIGGER IF EXISTS trg_log_trip_status_change ON mobility_trip_matches;
DROP TRIGGER IF EXISTS trg_increment_version ON mobility_trip_matches;

COMMIT;
