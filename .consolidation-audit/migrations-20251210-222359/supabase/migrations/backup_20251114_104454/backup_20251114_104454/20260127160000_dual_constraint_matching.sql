-- Dual-constraint geospatial matching for trips
-- Enables pickup + dropoff <= radius filtering
-- Uses existing pickup/dropoff geography columns from trips table
BEGIN;

-- Enable PostGIS extension if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Ensure GIST indexes exist for efficient geospatial queries on trips table
-- (pickup/dropoff geography columns already exist from master_schema_additions)
CREATE INDEX IF NOT EXISTS idx_trips_pickup_gist 
  ON public.trips USING GIST (pickup);

CREATE INDEX IF NOT EXISTS idx_trips_dropoff_gist 
  ON public.trips USING GIST (dropoff);

-- Create RPC function for search_live_market_candidates (used by /app/api/match/search)
-- This function searches for matching trips with dual-constraint support
CREATE OR REPLACE FUNCTION public.search_live_market_candidates(
  _actor_kind text,
  _pickup_lat double precision,
  _pickup_lng double precision,
  _dropoff_lat double precision DEFAULT NULL,
  _dropoff_lng double precision DEFAULT NULL,
  _radius_km double precision DEFAULT 10,
  _limit integer DEFAULT 20
)
RETURNS TABLE (
  candidate_id uuid,
  candidate_kind text,
  candidate_user_id uuid,
  pickup_distance_km double precision,
  dropoff_distance_km double precision,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pickup_geog geography;
  dropoff_geog geography;
  radius_m double precision;
  target_role text;
BEGIN
  -- Create geography point for pickup
  pickup_geog := ST_SetSRID(ST_MakePoint(_pickup_lng, _pickup_lat), 4326)::geography;
  
  -- Create geography point for dropoff if provided
  IF _dropoff_lat IS NOT NULL AND _dropoff_lng IS NOT NULL THEN
    dropoff_geog := ST_SetSRID(ST_MakePoint(_dropoff_lng, _dropoff_lat), 4326)::geography;
  END IF;
  
  -- Convert radius from km to meters
  radius_m := GREATEST(_radius_km, 0.1) * 1000.0;
  
  -- Determine target role (match opposite roles)
  target_role := CASE 
    WHEN lower(_actor_kind) = 'driver' THEN 'passenger'
    WHEN lower(_actor_kind) = 'passenger' THEN 'driver'
    ELSE 'passenger'
  END;
  
  -- Return matching trips
  RETURN QUERY
  SELECT
    t.id AS candidate_id,
    t.role AS candidate_kind,
    t.creator_user_id AS candidate_user_id,
    (ST_Distance(t.pickup, pickup_geog) / 1000.0)::double precision AS pickup_distance_km,
    CASE
      WHEN dropoff_geog IS NULL OR t.dropoff IS NULL THEN NULL
      ELSE (ST_Distance(t.dropoff, dropoff_geog) / 1000.0)::double precision
    END AS dropoff_distance_km,
    t.created_at
  FROM public.trips t
  WHERE 
    t.status = 'open'
    AND t.role = target_role
    AND t.pickup IS NOT NULL
    AND ST_DWithin(t.pickup, pickup_geog, radius_m)
    AND (
      -- If no dropoff provided, only filter by pickup
      dropoff_geog IS NULL
      OR t.dropoff IS NULL
      -- If dropoff provided, both pickup AND dropoff must be within radius
      OR ST_DWithin(t.dropoff, dropoff_geog, radius_m)
    )
  ORDER BY
    -- Sort by sum of distances (pickup + dropoff), then by creation time
    (ST_Distance(t.pickup, pickup_geog) + COALESCE(ST_Distance(t.dropoff, dropoff_geog), 0)) ASC,
    t.created_at DESC
  LIMIT GREATEST(_limit, 1);
END;
$$;

-- Create RPC function for match_search_candidates (used by /admin-app/api/match/search)
-- This function is similar but uses a different signature with require_dual parameter
CREATE OR REPLACE FUNCTION public.match_search_candidates(
  actor_kind text,
  pickup_lat double precision,
  pickup_lng double precision,
  dropoff_lat double precision DEFAULT NULL,
  dropoff_lng double precision DEFAULT NULL,
  radius_km double precision DEFAULT 10,
  limit_count integer DEFAULT 20,
  require_dual boolean DEFAULT false
)
RETURNS TABLE (
  kind text,
  id uuid,
  created_at timestamptz,
  pickup_distance_km double precision,
  dropoff_distance_km double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pickup_geog geography;
  dropoff_geog geography;
  radius_m double precision;
  target_role text;
BEGIN
  -- Create geography point for pickup
  pickup_geog := ST_SetSRID(ST_MakePoint(pickup_lng, pickup_lat), 4326)::geography;
  
  -- Create geography point for dropoff if provided
  IF dropoff_lat IS NOT NULL AND dropoff_lng IS NOT NULL THEN
    dropoff_geog := ST_SetSRID(ST_MakePoint(dropoff_lng, dropoff_lat), 4326)::geography;
  END IF;
  
  -- Convert radius from km to meters
  radius_m := GREATEST(radius_km, 0.1) * 1000.0;
  
  -- Determine target role (match opposite roles)
  target_role := CASE 
    WHEN lower(actor_kind) = 'driver' THEN 'passenger'
    WHEN lower(actor_kind) = 'passenger' THEN 'driver'
    ELSE 'passenger'
  END;
  
  -- Return matching trips
  RETURN QUERY
  SELECT
    t.role AS kind,
    t.id,
    t.created_at,
    (ST_Distance(t.pickup, pickup_geog) / 1000.0)::double precision AS pickup_distance_km,
    CASE
      WHEN dropoff_geog IS NULL OR t.dropoff IS NULL THEN NULL
      ELSE (ST_Distance(t.dropoff, dropoff_geog) / 1000.0)::double precision
    END AS dropoff_distance_km
  FROM public.trips t
  WHERE 
    t.status = 'open'
    AND t.role = target_role
    AND t.pickup IS NOT NULL
    AND ST_DWithin(t.pickup, pickup_geog, radius_m)
    AND (
      -- If require_dual is false or no dropoff provided, only filter by pickup
      NOT require_dual
      OR dropoff_geog IS NULL
      OR t.dropoff IS NULL
      -- If require_dual is true and dropoff provided, both must be within radius
      OR ST_DWithin(t.dropoff, dropoff_geog, radius_m)
    )
  ORDER BY
    -- Sort by sum of distances (pickup + dropoff), then by creation time
    (ST_Distance(t.pickup, pickup_geog) + COALESCE(ST_Distance(t.dropoff, dropoff_geog), 0)) ASC,
    t.created_at DESC
  LIMIT GREATEST(limit_count, 1);
END;
$$;

-- Grant execute permissions on the RPC functions
GRANT EXECUTE ON FUNCTION public.search_live_market_candidates TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.match_search_candidates TO authenticated, anon, service_role;

COMMIT;
