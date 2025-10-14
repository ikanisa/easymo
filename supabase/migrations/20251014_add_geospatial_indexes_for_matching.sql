-- Enable PostGIS if not enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Ensure we have geographies for pickup/dropoff on offers and requests
-- (Add columns only if they do not already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='rides_offers' AND column_name='pickup_geog'
  ) THEN
    ALTER TABLE rides_offers
      ADD COLUMN pickup_geog geography(Point, 4326),
      ADD COLUMN dropoff_geog geography(Point, 4326);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='rides_requests' AND column_name='pickup_geog'
  ) THEN
    ALTER TABLE rides_requests
      ADD COLUMN pickup_geog geography(Point, 4326),
      ADD COLUMN dropoff_geog geography(Point, 4326);
  END IF;
END$$;

-- Backfill geography columns when corresponding lat/lng columns exist
DO $$
DECLARE
  pickup_lat_exists boolean;
  pickup_lng_exists boolean;
  dropoff_lat_exists boolean;
  dropoff_lng_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='rides_offers' AND column_name='pickup_lat'
  ) INTO pickup_lat_exists;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='rides_offers' AND column_name='pickup_lng'
  ) INTO pickup_lng_exists;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='rides_offers' AND column_name='dropoff_lat'
  ) INTO dropoff_lat_exists;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='rides_offers' AND column_name='dropoff_lng'
  ) INTO dropoff_lng_exists;

  IF pickup_lat_exists AND pickup_lng_exists THEN
    EXECUTE $$
      UPDATE rides_offers
      SET pickup_geog = ST_SetSRID(ST_MakePoint(pickup_lng, pickup_lat), 4326)::geography
      WHERE pickup_lat IS NOT NULL AND pickup_lng IS NOT NULL AND pickup_geog IS NULL
    $$;
  END IF;

  IF dropoff_lat_exists AND dropoff_lng_exists THEN
    EXECUTE $$
      UPDATE rides_offers
      SET dropoff_geog = ST_SetSRID(ST_MakePoint(dropoff_lng, dropoff_lat), 4326)::geography
      WHERE dropoff_lat IS NOT NULL AND dropoff_lng IS NOT NULL AND dropoff_geog IS NULL
    $$;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='rides_requests' AND column_name='pickup_lat'
  ) INTO pickup_lat_exists;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='rides_requests' AND column_name='pickup_lng'
  ) INTO pickup_lng_exists;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='rides_requests' AND column_name='dropoff_lat'
  ) INTO dropoff_lat_exists;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='rides_requests' AND column_name='dropoff_lng'
  ) INTO dropoff_lng_exists;

  IF pickup_lat_exists AND pickup_lng_exists THEN
    EXECUTE $$
      UPDATE rides_requests
      SET pickup_geog = ST_SetSRID(ST_MakePoint(pickup_lng, pickup_lat), 4326)::geography
      WHERE pickup_lat IS NOT NULL AND pickup_lng IS NOT NULL AND pickup_geog IS NULL
    $$;
  END IF;

  IF dropoff_lat_exists AND dropoff_lng_exists THEN
    EXECUTE $$
      UPDATE rides_requests
      SET dropoff_geog = ST_SetSRID(ST_MakePoint(dropoff_lng, dropoff_lat), 4326)::geography
      WHERE dropoff_lat IS NOT NULL AND dropoff_lng IS NOT NULL AND dropoff_geog IS NULL
    $$;
  END IF;
END$$;

-- Create GiST indexes for fast radius filtering
CREATE INDEX IF NOT EXISTS idx_rides_offers_pickup_geog ON rides_offers USING GIST (pickup_geog);
CREATE INDEX IF NOT EXISTS idx_rides_offers_dropoff_geog ON rides_offers USING GIST (dropoff_geog);
CREATE INDEX IF NOT EXISTS idx_rides_requests_pickup_geog ON rides_requests USING GIST (pickup_geog);
CREATE INDEX IF NOT EXISTS idx_rides_requests_dropoff_geog ON rides_requests USING GIST (dropoff_geog);

-- Optional: materialized view that unifies “live” market (toggle list to include drivers or passengers)
-- This is additive, does not replace existing queries.
CREATE MATERIALIZED VIEW IF NOT EXISTS live_market_mv AS
SELECT
  'offer'::text AS kind,
  id, user_id, created_at, status, pickup_geog, dropoff_geog
FROM rides_offers
WHERE status = 'live'
UNION ALL
SELECT
  'request'::text AS kind,
  id, user_id, created_at, status, pickup_geog, dropoff_geog
FROM rides_requests
WHERE status = 'live';

CREATE INDEX IF NOT EXISTS idx_live_market_mv_pickup ON live_market_mv USING GIST (pickup_geog);
CREATE INDEX IF NOT EXISTS idx_live_market_mv_dropoff ON live_market_mv USING GIST (dropoff_geog);
CREATE UNIQUE INDEX IF NOT EXISTS idx_live_market_mv_kind_id ON live_market_mv (kind, id);

-- Refresh convenience function (optional)
CREATE OR REPLACE FUNCTION refresh_live_market_mv()
RETURNS void LANGUAGE sql AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY live_market_mv;
$$;

-- Dual-constraint search helper
CREATE OR REPLACE FUNCTION match_search_candidates(
  _actor_kind text,
  _pickup_lat double precision,
  _pickup_lng double precision,
  _dropoff_lat double precision DEFAULT NULL,
  _dropoff_lng double precision DEFAULT NULL,
  _radius_km double precision DEFAULT 10,
  _limit_count integer DEFAULT 20,
  _require_dual boolean DEFAULT true
)
RETURNS TABLE (
  kind text,
  id uuid,
  created_at timestamptz,
  pickup_distance_km double precision,
  dropoff_distance_km double precision
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH params AS (
  SELECT
    ST_SetSRID(ST_MakePoint(_pickup_lng, _pickup_lat), 4326)::geography AS pickup_geog,
    CASE
      WHEN _dropoff_lat IS NULL OR _dropoff_lng IS NULL THEN NULL
      ELSE ST_SetSRID(ST_MakePoint(_dropoff_lng, _dropoff_lat), 4326)::geography
    END AS dropoff_geog,
    GREATEST(_radius_km, 0.1) * 1000.0 AS radius_m
),
live_market AS (
  SELECT
    'offer'::text AS kind,
    id,
    created_at,
    pickup_geog,
    dropoff_geog
  FROM rides_offers
  WHERE status = 'live'
  UNION ALL
  SELECT
    'request'::text AS kind,
    id,
    created_at,
    pickup_geog,
    dropoff_geog
  FROM rides_requests
  WHERE status = 'live'
)
SELECT
  m.kind,
  m.id,
  m.created_at,
  ST_Distance(m.pickup_geog, params.pickup_geog) / 1000.0 AS pickup_distance_km,
  CASE
    WHEN params.dropoff_geog IS NULL OR m.dropoff_geog IS NULL THEN NULL
    ELSE ST_Distance(m.dropoff_geog, params.dropoff_geog) / 1000.0
  END AS dropoff_distance_km
FROM live_market m, params
WHERE
  ((lower(_actor_kind) = 'driver' AND m.kind = 'request') OR (lower(_actor_kind) = 'passenger' AND m.kind = 'offer'))
  AND m.pickup_geog IS NOT NULL
  AND ST_DWithin(m.pickup_geog, params.pickup_geog, params.radius_m)
  AND (
    NOT _require_dual
    OR params.dropoff_geog IS NULL
    OR (
      m.dropoff_geog IS NOT NULL
      AND ST_DWithin(m.dropoff_geog, params.dropoff_geog, params.radius_m)
    )
  )
ORDER BY
  ST_Distance(m.pickup_geog, params.pickup_geog)
  + COALESCE(ST_Distance(m.dropoff_geog, params.dropoff_geog), 0),
  m.created_at DESC
LIMIT GREATEST(_limit_count, 1);
$$;
