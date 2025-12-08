-- Canonical trips table (scheduled + request intents)
BEGIN;

-- Drop existing view if present
DROP VIEW IF EXISTS public.trips CASCADE;

CREATE TABLE IF NOT EXISTS public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('scheduled', 'request_intent')),
  role text NOT NULL CHECK (role IN ('driver', 'passenger')),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  vehicle_type text,
  pickup_lat double precision NOT NULL,
  pickup_lng double precision NOT NULL,
  pickup_geog geography(Point, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(pickup_lng, pickup_lat), 4326)::geography
  ) STORED,
  pickup_text text,
  scheduled_for timestamptz,
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','cancelled','expired')),
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trips_valid_coordinates CHECK (pickup_lat BETWEEN -90 AND 90 AND pickup_lng BETWEEN -180 AND 180)
);

COMMENT ON TABLE public.trips IS 'Canonical trips table (scheduled + request intents).';
COMMENT ON COLUMN public.trips.kind IS 'scheduled | request_intent';
COMMENT ON COLUMN public.trips.status IS 'open | cancelled | expired';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trips_pickup_geog ON public.trips USING GIST (pickup_geog);
CREATE INDEX IF NOT EXISTS idx_trips_status_open ON public.trips (status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_trips_role_kind_status ON public.trips (role, kind, status, scheduled_for DESC);
CREATE INDEX IF NOT EXISTS idx_trips_scheduled_open ON public.trips (scheduled_for) WHERE status = 'open' AND scheduled_for IS NOT NULL;

-- RLS
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trips_owner_rw" ON public.trips;
DROP POLICY IF EXISTS "trips_owner_rw" ON public.trips;
CREATE POLICY "trips_owner_rw"
  ON public.trips
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "trips_service_role_all" ON public.trips;
DROP POLICY IF EXISTS "trips_service_role_all" ON public.trips;
CREATE POLICY "trips_service_role_all"
  ON public.trips
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION trips_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_trips_updated_at ON public.trips;
CREATE TRIGGER trg_trips_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION trips_set_updated_at();

COMMIT;
