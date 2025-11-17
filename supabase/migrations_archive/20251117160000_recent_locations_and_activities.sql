BEGIN;

-- Create recent_locations table for 30-minute location caching across flows
CREATE TABLE IF NOT EXISTS public.recent_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  source TEXT, -- e.g., 'bars','pharmacies','shops','notary','mobility','property','marketplace'
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  geog GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) STORED,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_recent_locations_user ON public.recent_locations(user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_recent_locations_expires ON public.recent_locations(expires_at);
CREATE INDEX IF NOT EXISTS idx_recent_locations_geog ON public.recent_locations USING GIST(geog);

-- Create recent_activities to allow quick revisit of last actions
CREATE TABLE IF NOT EXISTS public.recent_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- e.g., 'bar_menu','pharmacy_search','nearby_drivers','nearby_passengers','shop_browse','notary_search'
  ref_id TEXT,       -- vendor id, tag id, etc.
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recent_activities_user ON public.recent_activities(user_id, occurred_at DESC);

-- Add expires_at to trips for short-lived nearby searches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN expires_at TIMESTAMPTZ;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_trips_expires_at ON public.trips(expires_at);

COMMIT;

