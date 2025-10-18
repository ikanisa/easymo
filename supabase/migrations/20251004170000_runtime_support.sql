-- Runtime support tables for WhatsApp flows (state, config, mobility, contacts)
-- Additive migration only.

-- Configuration table consumed by wa-webhook runtime
BEGIN;
CREATE TABLE IF NOT EXISTS public.app_config (
  id integer PRIMARY KEY,
  search_radius_km double precision DEFAULT 10,
  max_results integer DEFAULT 9,
  subscription_price numeric(10,2) DEFAULT 0,
  wa_bot_number_e164 text,
  admin_numbers text[] DEFAULT ARRAY[]::text[],
  insurance_admin_numbers text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.app_config
  ADD COLUMN IF NOT EXISTS search_radius_km double precision DEFAULT 10,
  ADD COLUMN IF NOT EXISTS max_results integer DEFAULT 9,
  ADD COLUMN IF NOT EXISTS subscription_price numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wa_bot_number_e164 text,
  ADD COLUMN IF NOT EXISTS admin_numbers text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS insurance_admin_numbers text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_app_config_updated'
  ) THEN
    CREATE TRIGGER trg_app_config_updated
      BEFORE UPDATE ON public.app_config
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$
DECLARE
  _id public.app_config.id%TYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_config) THEN
    SELECT CASE
             WHEN atttypid = 'bool'::regtype THEN TRUE::public.app_config.id%TYPE
             ELSE 1::public.app_config.id%TYPE
           END
    INTO _id
    FROM pg_attribute
    WHERE attrelid = 'public.app_config'::regclass
      AND attname = 'id';

    INSERT INTO public.app_config (id, search_radius_km, max_results, subscription_price, wa_bot_number_e164)
    VALUES (_id, 10, 9, 0, '+250780000000')
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Chat state persistence for WA router
CREATE TABLE IF NOT EXISTS public.chat_state (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_chat_state_updated'
  ) THEN
    CREATE TRIGGER trg_chat_state_updated
      BEFORE UPDATE ON public.chat_state
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Idempotency log for inbound WA messages
CREATE TABLE IF NOT EXISTS public.wa_events (
  wa_message_id text PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Opt-in/opt-out registry used by router guards
CREATE TABLE IF NOT EXISTS public.contacts (
  msisdn_e164 text PRIMARY KEY,
  opted_out boolean NOT NULL DEFAULT false,
  opted_in boolean NOT NULL DEFAULT true,
  opt_out_ts timestamptz,
  opt_in_ts timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_contacts_updated'
  ) THEN
    CREATE TRIGGER trg_contacts_updated
      BEFORE UPDATE ON public.contacts
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Mobility presence for nearby lookup
CREATE TABLE IF NOT EXISTS public.driver_status (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  vehicle_type text NOT NULL,
  last_seen timestamptz NOT NULL DEFAULT timezone('utc', now()),
  lat double precision,
  lng double precision,
  online boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.driver_status
  ADD COLUMN IF NOT EXISTS vehicle_type text,
  ADD COLUMN IF NOT EXISTS last_seen timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS online boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_driver_status_updated'
  ) THEN
    CREATE TRIGGER trg_driver_status_updated
      BEFORE UPDATE ON public.driver_status
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Trip requests logged by scheduling flow
CREATE TABLE IF NOT EXISTS public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  role text NOT NULL,
  vehicle_type text NOT NULL,
  pickup_lat double precision,
  pickup_lng double precision,
  dropoff_lat double precision,
  dropoff_lng double precision,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS creator_user_id uuid,
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS vehicle_type text,
  ADD COLUMN IF NOT EXISTS pickup_lat double precision,
  ADD COLUMN IF NOT EXISTS pickup_lng double precision,
  ADD COLUMN IF NOT EXISTS dropoff_lat double precision,
  ADD COLUMN IF NOT EXISTS dropoff_lng double precision,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_trips_updated'
  ) THEN
    CREATE TRIGGER trg_trips_updated
      BEFORE UPDATE ON public.trips
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_trips_role ON public.trips(role, vehicle_type);

-- Optional Pro access credits
CREATE TABLE IF NOT EXISTS public.mobility_pro_access (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  credits_left integer NOT NULL DEFAULT 0,
  granted_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_mobility_pro_access_updated'
  ) THEN
    CREATE TRIGGER trg_mobility_pro_access_updated
      BEFORE UPDATE ON public.mobility_pro_access
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Helper to derive masked reference code for WA contact
CREATE OR REPLACE FUNCTION public.profile_ref_code(_profile_id uuid)
RETURNS text
LANGUAGE sql
AS $$
  SELECT COALESCE(metadata->>'ref_code',
                  upper(substring(md5(COALESCE(whatsapp_e164, '')) FROM 1 FOR 6)))
  FROM public.profiles
  WHERE user_id = _profile_id;
$$;

-- Nearby drivers lookup for WhatsApp flows
CREATE OR REPLACE FUNCTION public.recent_drivers_near(
  in_lat double precision,
  in_lng double precision,
  in_vehicle_type text,
  in_radius_km double precision,
  in_max integer
)
RETURNS TABLE(
  ref_code text,
  whatsapp_e164 text,
  last_seen timestamptz
)
LANGUAGE sql
AS $$
  SELECT
    public.profile_ref_code(ds.user_id) AS ref_code,
    p.whatsapp_e164,
    ds.last_seen
  FROM public.driver_status ds
  JOIN public.profiles p ON p.user_id = ds.user_id
  WHERE ds.online = true
    AND p.whatsapp_e164 IS NOT NULL
    AND (in_vehicle_type IS NULL OR ds.vehicle_type = in_vehicle_type)
    AND ds.lat IS NOT NULL AND ds.lng IS NOT NULL
    AND (
      in_radius_km IS NULL
      OR public.haversine_km(ds.lat, ds.lng, in_lat, in_lng) <= in_radius_km
    )
  ORDER BY ds.last_seen DESC
  LIMIT COALESCE(in_max, 9);
$$;

-- Nearby passenger trips lookup
CREATE OR REPLACE FUNCTION public.recent_passenger_trips_near(
  in_lat double precision,
  in_lng double precision,
  in_vehicle_type text,
  in_radius_km double precision,
  in_max integer
)
RETURNS TABLE(
  trip_id uuid,
  ref_code text,
  whatsapp_e164 text,
  created_at timestamptz
)
LANGUAGE sql
AS $$
  SELECT
    t.id,
    public.profile_ref_code(t.creator_user_id) AS ref_code,
    p.whatsapp_e164,
    t.created_at
  FROM public.trips t
  JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'passenger'
    AND p.whatsapp_e164 IS NOT NULL
    AND (in_vehicle_type IS NULL OR t.vehicle_type = in_vehicle_type)
    AND t.pickup_lat IS NOT NULL AND t.pickup_lng IS NOT NULL
    AND (
      in_radius_km IS NULL
      OR public.haversine_km(t.pickup_lat, t.pickup_lng, in_lat, in_lng) <= in_radius_km
    )
  ORDER BY t.created_at DESC
  LIMIT COALESCE(in_max, 9);
$$;

-- Gatekeeping helper for Pro feature usage
CREATE OR REPLACE FUNCTION public.gate_pro_feature(_user_id uuid)
RETURNS TABLE(access boolean, used_credit boolean, credits_left integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_rec public.mobility_pro_access;
  v_access boolean := false;
  v_used boolean := false;
  v_left integer := 0;
BEGIN
  SELECT * INTO v_rec FROM public.mobility_pro_access WHERE user_id = _user_id;
  IF v_rec.user_id IS NULL THEN
    RETURN QUERY SELECT false, false, 0;
    RETURN;
  END IF;
  v_left := COALESCE(v_rec.credits_left, 0);
  IF v_rec.granted_until IS NOT NULL AND v_rec.granted_until >= timezone('utc', now()) THEN
    v_access := true;
  ELSIF v_left > 0 THEN
    v_access := true;
  END IF;
  RETURN QUERY SELECT v_access, v_used, v_left;
END;
$$;

-- Convenience seed: grant default Pro access to bootstrap testing
INSERT INTO public.mobility_pro_access (user_id, credits_left, granted_until)
SELECT user_id, 5, timezone('utc', now()) + interval '30 days'
FROM public.profiles
WHERE user_id NOT IN (SELECT user_id FROM public.mobility_pro_access)
LIMIT 0; -- no-op seed to keep migration additive without assumptions

DROP FUNCTION IF EXISTS public.match_drivers_for_trip(uuid, integer, boolean);
DROP FUNCTION IF EXISTS public.match_passengers_for_trip(uuid, integer, boolean);

-- Placeholder matching helpers (return empty result set until matchmaking implemented)
CREATE OR REPLACE FUNCTION public.match_drivers_for_trip(
  _trip_id uuid,
  _limit integer DEFAULT 9,
  _prefer_dropoff boolean DEFAULT false
)
RETURNS TABLE(driver_user_id uuid, whatsapp_e164 text, distance_km double precision)
LANGUAGE sql
AS $$
  SELECT NULL::uuid AS driver_user_id,
         NULL::text AS whatsapp_e164,
         NULL::double precision AS distance_km
  WHERE false;
$$;

CREATE OR REPLACE FUNCTION public.match_passengers_for_trip(
  _trip_id uuid,
  _limit integer DEFAULT 9,
  _prefer_dropoff boolean DEFAULT false
)
RETURNS TABLE(passenger_user_id uuid, whatsapp_e164 text, distance_km double precision)
LANGUAGE sql
AS $$
  SELECT NULL::uuid AS passenger_user_id,
         NULL::text AS whatsapp_e164,
         NULL::double precision AS distance_km
  WHERE false;
$$;
COMMIT;
