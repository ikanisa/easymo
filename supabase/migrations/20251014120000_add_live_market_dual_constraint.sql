-- Dual-constraint matching support (pickup + dropoff proximity)

BEGIN;

-- Ensure PostGIS is available for geography operations
CREATE EXTENSION IF NOT EXISTS postgis;

-- Ensure our live market materialized view exists using available mobility tables
DO $$
DECLARE
  offers_exists boolean := EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'rides_offers'
  );
  requests_exists boolean := EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'rides_requests'
  );
  trips_exists boolean := EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'trips'
  );
BEGIN
  IF offers_exists THEN
    EXECUTE 'ALTER TABLE public.rides_offers
      ADD COLUMN IF NOT EXISTS pickup_geog geography(Point, 4326),
      ADD COLUMN IF NOT EXISTS dropoff_geog geography(Point, 4326)';
  END IF;

  IF requests_exists THEN
    EXECUTE 'ALTER TABLE public.rides_requests
      ADD COLUMN IF NOT EXISTS pickup_geog geography(Point, 4326),
      ADD COLUMN IF NOT EXISTS dropoff_geog geography(Point, 4326)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = 'live_market_mv'
  ) THEN
    IF offers_exists AND requests_exists THEN
      EXECUTE $$CREATE MATERIALIZED VIEW public.live_market_mv AS
        SELECT
          'offer'::text AS kind,
          id,
          user_id,
          created_at,
          status,
          pickup_geog,
          dropoff_geog
        FROM public.rides_offers
        WHERE status = 'live'
        UNION ALL
        SELECT
          'request'::text AS kind,
          id,
          user_id,
          created_at,
          status,
          pickup_geog,
          dropoff_geog
        FROM public.rides_requests
        WHERE status = 'live';$$;
    ELSIF trips_exists THEN
      EXECUTE $$CREATE MATERIALIZED VIEW public.live_market_mv AS
        SELECT
          CASE WHEN role = 'driver' THEN 'offer' ELSE 'request' END AS kind,
          id,
          creator_user_id AS user_id,
          created_at,
          status,
          pickup AS pickup_geog,
          dropoff AS dropoff_geog
        FROM public.trips
        WHERE status = 'open' AND pickup IS NOT NULL;$$;
    END IF;
  END IF;
END$$;

-- Create supporting indexes for whichever base tables exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='rides_offers') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_rides_offers_pickup_geog ON public.rides_offers USING GIST (pickup_geog)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_rides_offers_dropoff_geog ON public.rides_offers USING GIST (dropoff_geog)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='rides_requests') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_rides_requests_pickup_geog ON public.rides_requests USING GIST (pickup_geog)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_rides_requests_dropoff_geog ON public.rides_requests USING GIST (dropoff_geog)';
  END IF;
  IF to_regclass('public.live_market_mv') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_live_market_mv_pickup ON public.live_market_mv USING GIST (pickup_geog)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_live_market_mv_dropoff ON public.live_market_mv USING GIST (dropoff_geog)';
  END IF;
END$$;

-- Refresh helper for consumers that need up-to-date snapshots
CREATE OR REPLACE FUNCTION public.refresh_live_market_mv()
RETURNS void LANGUAGE sql AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.live_market_mv;
$$;

-- Candidate search function supporting dual constraint matching
CREATE OR REPLACE FUNCTION public.search_live_market_candidates(
  _actor_kind text,
  _pickup_lat double precision,
  _pickup_lng double precision,
  _dropoff_lat double precision DEFAULT NULL,
  _dropoff_lng double precision DEFAULT NULL,
  _radius_km numeric DEFAULT 10,
  _limit integer DEFAULT 20
)
RETURNS TABLE (
  candidate_kind text,
  candidate_id uuid,
  candidate_user_id uuid,
  pickup_distance_km numeric,
  dropoff_distance_km numeric,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
  pickup_geog geography := ST_SetSRID(ST_MakePoint(_pickup_lng, _pickup_lat), 4326)::geography;
  dropoff_geog geography := CASE
    WHEN _dropoff_lat IS NOT NULL AND _dropoff_lng IS NOT NULL
      THEN ST_SetSRID(ST_MakePoint(_dropoff_lng, _dropoff_lat), 4326)::geography
    ELSE NULL
  END;
  radius_m float8 := COALESCE(_radius_km, 10) * 1000.0;
  target_kind text := CASE WHEN lower(coalesce(_actor_kind, '')) = 'driver' THEN 'request' ELSE 'offer' END;
  has_mv boolean := to_regclass('public.live_market_mv') IS NOT NULL;
BEGIN
  IF pickup_geog IS NULL THEN
    RAISE EXCEPTION 'Pickup coordinates are required';
  END IF;

  IF has_mv THEN
    RETURN QUERY
      SELECT
        m.kind AS candidate_kind,
        m.id AS candidate_id,
        m.user_id AS candidate_user_id,
        (ST_Distance(m.pickup_geog, pickup_geog) / 1000.0)::numeric(10,3) AS pickup_distance_km,
        CASE
          WHEN dropoff_geog IS NOT NULL AND m.dropoff_geog IS NOT NULL
            THEN (ST_Distance(m.dropoff_geog, dropoff_geog) / 1000.0)::numeric(10,3)
          ELSE NULL
        END AS dropoff_distance_km,
        m.created_at
      FROM public.live_market_mv m
      WHERE m.kind = target_kind
        AND m.pickup_geog IS NOT NULL
        AND ST_DWithin(m.pickup_geog, pickup_geog, radius_m)
        AND (
          dropoff_geog IS NULL
          OR (m.dropoff_geog IS NOT NULL AND ST_DWithin(m.dropoff_geog, dropoff_geog, radius_m))
        )
      ORDER BY
        (ST_Distance(m.pickup_geog, pickup_geog)
          + COALESCE(ST_Distance(m.dropoff_geog, dropoff_geog), 0)) ASC,
        m.created_at DESC
      LIMIT GREATEST(1, COALESCE(_limit, 20));
  ELSE
    RETURN QUERY
      SELECT
        CASE WHEN t.role = 'driver' THEN 'offer' ELSE 'request' END AS candidate_kind,
        t.id AS candidate_id,
        t.creator_user_id AS candidate_user_id,
        (ST_Distance(t.pickup, pickup_geog) / 1000.0)::numeric(10,3) AS pickup_distance_km,
        CASE
          WHEN dropoff_geog IS NOT NULL AND t.dropoff IS NOT NULL
            THEN (ST_Distance(t.dropoff, dropoff_geog) / 1000.0)::numeric(10,3)
          ELSE NULL
        END AS dropoff_distance_km,
        t.created_at
      FROM public.trips t
      WHERE t.status = 'open'
        AND t.pickup IS NOT NULL
        AND t.role <> lower(coalesce(_actor_kind, ''))
        AND ST_DWithin(t.pickup, pickup_geog, radius_m)
        AND (
          dropoff_geog IS NULL
          OR (t.dropoff IS NOT NULL AND ST_DWithin(t.dropoff, dropoff_geog, radius_m))
        )
      ORDER BY
        (ST_Distance(t.pickup, pickup_geog)
          + COALESCE(ST_Distance(t.dropoff, dropoff_geog), 0)) ASC,
        t.created_at DESC
      LIMIT GREATEST(1, COALESCE(_limit, 20));
  END IF;
END;
$$;

COMMIT;
