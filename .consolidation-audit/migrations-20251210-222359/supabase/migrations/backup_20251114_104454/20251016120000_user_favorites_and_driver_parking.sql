BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;

-- Passenger favorites (home, work, school, other)
CREATE TABLE IF NOT EXISTS public.user_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('home','work','school','other')),
  label text NOT NULL,
  address text,
  geog geography(Point, 4326) NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON public.user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_kind ON public.user_favorites(user_id, kind);
CREATE INDEX IF NOT EXISTS idx_user_favorites_geog ON public.user_favorites USING GIST(geog);

CREATE TRIGGER trg_user_favorites_updated
  BEFORE UPDATE ON public.user_favorites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Driver parking locations (regular standing spots)
CREATE TABLE IF NOT EXISTS public.driver_parking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  geog geography(Point, 4326) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_driver_parking_driver ON public.driver_parking(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_parking_geog ON public.driver_parking USING GIST(geog);

CREATE TRIGGER trg_driver_parking_updated
  BEFORE UPDATE ON public.driver_parking
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Recurring trips for passengers (A→B with schedule)
CREATE TABLE IF NOT EXISTS public.recurring_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origin_favorite_id uuid NOT NULL REFERENCES public.user_favorites(id) ON DELETE CASCADE,
  dest_favorite_id uuid NOT NULL REFERENCES public.user_favorites(id) ON DELETE CASCADE,
  days_of_week int[] NOT NULL,
  time_local time NOT NULL,
  timezone text NOT NULL DEFAULT 'Africa/Kigali',
  radius_km numeric NOT NULL DEFAULT 10,
  active boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_recurring_trips_user ON public.recurring_trips(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_trips_active ON public.recurring_trips(active);

CREATE TRIGGER trg_recurring_trips_updated
  BEFORE UPDATE ON public.recurring_trips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Driver availability windows (optional; additive)
CREATE TABLE IF NOT EXISTS public.driver_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parking_id uuid REFERENCES public.driver_parking(id) ON DELETE SET NULL,
  days_of_week int[] NOT NULL,
  start_time_local time NOT NULL,
  end_time_local time NOT NULL,
  timezone text NOT NULL DEFAULT 'Africa/Kigali',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_driver_availability_driver ON public.driver_availability(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_availability_active ON public.driver_availability(active);

CREATE TRIGGER trg_driver_availability_updated
  BEFORE UPDATE ON public.driver_availability
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.recurring_trips IS 'Passenger recurring schedules A→B using favorites';
COMMENT ON TABLE public.driver_availability IS 'Driver recurring parking/availability windows';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_parking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_favorites_owner_manage ON public.user_favorites;
CREATE POLICY user_favorites_owner_manage ON public.user_favorites
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS driver_parking_owner_manage ON public.driver_parking;
CREATE POLICY driver_parking_owner_manage ON public.driver_parking
  FOR ALL USING (auth.uid() = driver_id)
  WITH CHECK (auth.uid() = driver_id);

DROP POLICY IF EXISTS recurring_trips_owner_manage ON public.recurring_trips;
CREATE POLICY recurring_trips_owner_manage ON public.recurring_trips
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS driver_availability_owner_manage ON public.driver_availability;
CREATE POLICY driver_availability_owner_manage ON public.driver_availability
  FOR ALL USING (auth.uid() = driver_id)
  WITH CHECK (auth.uid() = driver_id);

COMMIT;
