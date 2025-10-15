-- Requires: postgis
CREATE EXTENSION IF NOT EXISTS postgis;

-- Ensure geo columns on offers/requests
ALTER TABLE IF EXISTS public.rides_offers
  ADD COLUMN IF NOT EXISTS pickup_geog  geography(Point,4326),
  ADD COLUMN IF NOT EXISTS dropoff_geog geography(Point,4326);

ALTER TABLE IF EXISTS public.rides_requests
  ADD COLUMN IF NOT EXISTS pickup_geog  geography(Point,4326),
  ADD COLUMN IF NOT EXISTS dropoff_geog geography(Point,4326);

-- Recreate materialized view deterministically
DROP MATERIALIZED VIEW IF EXISTS public.live_market_mv;

-- TODO: Replace this SELECT with your canonical definition if different
CREATE MATERIALIZED VIEW public.live_market_mv AS
SELECT
  r.id,
  r.pickup_geog,
  r.dropoff_geog,
  r.status,
  r.created_at
FROM public.rides_requests r
WHERE r.status = 'open' AND r.pickup_geog IS NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rides_offers_pickup_geog
  ON public.rides_offers USING GIST (pickup_geog);

CREATE INDEX IF NOT EXISTS idx_rides_offers_dropoff_geog
  ON public.rides_offers USING GIST (dropoff_geog);

CREATE INDEX IF NOT EXISTS idx_rides_requests_pickup_geog
  ON public.rides_requests USING GIST (pickup_geog);

CREATE INDEX IF NOT EXISTS idx_rides_requests_dropoff_geog
  ON public.rides_requests USING GIST (dropoff_geog);

CREATE INDEX IF NOT EXISTS idx_live_market_mv_pickup
  ON public.live_market_mv USING GIST (pickup_geog);

CREATE INDEX IF NOT EXISTS idx_live_market_mv_dropoff
  ON public.live_market_mv USING GIST (dropoff_geog);
