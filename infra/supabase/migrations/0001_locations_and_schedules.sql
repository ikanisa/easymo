BEGIN;

-- Ensure spatial extension available for geography columns
CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------------------------
-- Passenger saved locations (favorites)
-- ---------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_user_favorites_user
  ON public.user_favorites (user_id);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user_kind
  ON public.user_favorites (user_id, kind);

CREATE INDEX IF NOT EXISTS idx_user_favorites_geog
  ON public.user_favorites
  USING GIST (geog);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_favorites_default_per_kind
  ON public.user_favorites (user_id, kind)
  WHERE is_default;

CREATE TRIGGER trg_user_favorites_updated
  BEFORE UPDATE ON public.user_favorites
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Driver standing/parking locations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_parking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  geog geography(Point, 4326) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_driver_parking_driver
  ON public.driver_parking (driver_id);

CREATE INDEX IF NOT EXISTS idx_driver_parking_active
  ON public.driver_parking (driver_id, active);

CREATE INDEX IF NOT EXISTS idx_driver_parking_geog
  ON public.driver_parking
  USING GIST (geog);

CREATE TRIGGER trg_driver_parking_updated
  BEFORE UPDATE ON public.driver_parking
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Driver recurring availability windows
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parking_id uuid REFERENCES public.driver_parking(id) ON DELETE SET NULL,
  days_of_week smallint[] NOT NULL CHECK (
    days_of_week <@ ARRAY[0,1,2,3,4,5,6]
  ),
  start_time_local time NOT NULL,
  end_time_local time NOT NULL,
  timezone text NOT NULL DEFAULT 'Africa/Kigali',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_driver_availability_driver
  ON public.driver_availability (driver_id);

CREATE INDEX IF NOT EXISTS idx_driver_availability_active
  ON public.driver_availability (driver_id, active);

CREATE INDEX IF NOT EXISTS idx_driver_availability_days
  ON public.driver_availability USING GIN (days_of_week);

CREATE TRIGGER trg_driver_availability_updated
  BEFORE UPDATE ON public.driver_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Passenger recurring trips based on favorites
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recurring_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origin_favorite_id uuid NOT NULL REFERENCES public.user_favorites(id) ON DELETE CASCADE,
  dest_favorite_id uuid NOT NULL REFERENCES public.user_favorites(id) ON DELETE CASCADE,
  days_of_week smallint[] NOT NULL CHECK (
    days_of_week <@ ARRAY[0,1,2,3,4,5,6]
  ),
  time_local time NOT NULL,
  timezone text NOT NULL DEFAULT 'Africa/Kigali',
  radius_km numeric(6,2) NOT NULL DEFAULT 10.00 CHECK (radius_km > 0),
  active boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_recurring_trips_user
  ON public.recurring_trips (user_id);

CREATE INDEX IF NOT EXISTS idx_recurring_trips_active
  ON public.recurring_trips (user_id, active);

CREATE INDEX IF NOT EXISTS idx_recurring_trips_schedule
  ON public.recurring_trips USING GIN (days_of_week);

CREATE TRIGGER trg_recurring_trips_updated
  BEFORE UPDATE ON public.recurring_trips
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMIT;
