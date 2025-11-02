BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- User favorites capture common pickup/dropoff shortcuts for passengers.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('home','work','school','other')),
  label text NOT NULL,
  address text,
  geog geography(Point, 4326) NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user
  ON public.user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_kind
  ON public.user_favorites(user_id, kind);
CREATE INDEX IF NOT EXISTS idx_user_favorites_geog
  ON public.user_favorites USING GIST(geog);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_favorites_user_label
  ON public.user_favorites (user_id, lower(label));

DROP TRIGGER IF EXISTS trg_user_favorites_updated ON public.user_favorites;
CREATE TRIGGER trg_user_favorites_updated
  BEFORE UPDATE ON public.user_favorites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Driver parking spots are persistent standby locations for matching.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_parking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label text NOT NULL,
  geog geography(Point, 4326) NOT NULL,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_driver_parking_driver
  ON public.driver_parking(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_parking_active
  ON public.driver_parking(active, driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_parking_geog
  ON public.driver_parking USING GIST(geog);

DROP TRIGGER IF EXISTS trg_driver_parking_updated ON public.driver_parking;
CREATE TRIGGER trg_driver_parking_updated
  BEFORE UPDATE ON public.driver_parking
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Driver availability windows capture weekly recurrence for planning.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parking_id uuid REFERENCES public.driver_parking(id) ON DELETE SET NULL,
  days_of_week int[] NOT NULL,
  start_time_local time NOT NULL,
  end_time_local time NOT NULL,
  timezone text NOT NULL DEFAULT 'Africa/Kigali',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_driver_availability_driver
  ON public.driver_availability(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_availability_active
  ON public.driver_availability(active, driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_availability_start_time
  ON public.driver_availability(start_time_local, end_time_local);

DROP TRIGGER IF EXISTS trg_driver_availability_updated ON public.driver_availability;
CREATE TRIGGER trg_driver_availability_updated
  BEFORE UPDATE ON public.driver_availability
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Recurring trips allow passengers to express repeated journey intents.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recurring_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_recurring_trips_user
  ON public.recurring_trips(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_trips_active
  ON public.recurring_trips(active);
CREATE INDEX IF NOT EXISTS idx_recurring_trips_schedule
  ON public.recurring_trips(time_local, timezone);

DROP TRIGGER IF EXISTS trg_recurring_trips_updated ON public.recurring_trips;
CREATE TRIGGER trg_recurring_trips_updated
  BEFORE UPDATE ON public.recurring_trips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.recurring_trips IS 'Passenger recurring schedules A→B using favorites';
COMMENT ON TABLE public.driver_availability IS 'Driver recurring parking/availability windows';

-- ---------------------------------------------------------------------------
-- Deeplink tokens & audit events for WhatsApp entry flows.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deeplink_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow text NOT NULL CHECK (flow IN ('insurance_attach', 'basket_open', 'generate_qr')),
  token text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  msisdn_e164 text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  multi_use boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  resolved_count integer NOT NULL DEFAULT 0,
  last_resolved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_deeplink_tokens_flow
  ON public.deeplink_tokens(flow);
CREATE INDEX IF NOT EXISTS idx_deeplink_tokens_expires
  ON public.deeplink_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_deeplink_tokens_created_by
  ON public.deeplink_tokens(created_by);

CREATE TABLE IF NOT EXISTS public.deeplink_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES public.deeplink_tokens(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('issued', 'opened', 'expired', 'denied', 'completed')),
  actor_msisdn text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_deeplink_events_token
  ON public.deeplink_events(token_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Router logs persist WhatsApp routing outcomes for debugging & analytics.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.router_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL,
  text_snippet text,
  route_key text,
  status_code text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_router_logs_message_id
  ON public.router_logs (message_id);
CREATE INDEX IF NOT EXISTS idx_router_logs_route_key
  ON public.router_logs (route_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_router_logs_status_code
  ON public.router_logs (status_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_router_logs_created_at
  ON public.router_logs (created_at DESC);

COMMENT ON TABLE public.router_logs IS
  'Logs WhatsApp routing decisions, keeping short snippets and metadata for 90 days.';

COMMIT;
