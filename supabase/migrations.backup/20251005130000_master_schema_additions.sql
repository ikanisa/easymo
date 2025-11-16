-- Master schema alignment for easyMO WhatsApp system
-- Additive only: creates missing tables, columns, constraints, indexes per spec

BEGIN;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- CORE TABLES
-- ---------------------------------------------------------------------------

-- profiles adjustments
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS id uuid GENERATED ALWAYS AS (user_id) STORED,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_whatsapp_unique'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_whatsapp_unique UNIQUE (whatsapp_e164);
  END IF;
END $$;

-- contacts table per spec
CREATE TABLE IF NOT EXISTS public.contacts (
  whatsapp_e164 text PRIMARY KEY,
  opted_out boolean NOT NULL DEFAULT false,
  last_inbound_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS opted_out boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_inbound_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc', now());

-- chat_state requires state_key/state columns
ALTER TABLE public.chat_state
  ADD COLUMN IF NOT EXISTS state_key text,
  ADD COLUMN IF NOT EXISTS state jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_state_user_id_unique'
  ) THEN
    ALTER TABLE public.chat_state ADD CONSTRAINT chat_state_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- wa_events needs received_at
ALTER TABLE public.wa_events
  ADD COLUMN IF NOT EXISTS received_at timestamptz NOT NULL DEFAULT timezone('utc', now());

-- app_config alignment
ALTER TABLE public.app_config
  ADD COLUMN IF NOT EXISTS momo_qr_logo_url text,
  ADD COLUMN IF NOT EXISTS redeem_catalog jsonb,
  ADD COLUMN IF NOT EXISTS admin_pin_required boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_config WHERE id = 1) THEN
    INSERT INTO public.app_config (id) VALUES (1);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- MOBILITY / TRIPS
-- ---------------------------------------------------------------------------

ALTER TABLE public.driver_status
  ADD COLUMN IF NOT EXISTS location geography(Point,4326);

CREATE INDEX IF NOT EXISTS driver_status_location_gix ON public.driver_status USING gist (location);

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS pickup geography(Point,4326),
  ADD COLUMN IF NOT EXISTS dropoff geography(Point,4326),
  ADD COLUMN IF NOT EXISTS pickup_text text,
  ADD COLUMN IF NOT EXISTS dropoff_text text,
  ADD COLUMN IF NOT EXISTS pickup_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS pickup_lon double precision GENERATED ALWAYS AS (CASE WHEN pickup IS NULL THEN NULL ELSE ST_X(pickup::geometry) END) STORED,
  ADD COLUMN IF NOT EXISTS pickup_lat double precision GENERATED ALWAYS AS (CASE WHEN pickup IS NULL THEN NULL ELSE ST_Y(pickup::geometry) END) STORED,
  ADD COLUMN IF NOT EXISTS dropoff_lon double precision GENERATED ALWAYS AS (CASE WHEN dropoff IS NULL THEN NULL ELSE ST_X(dropoff::geometry) END) STORED,
  ADD COLUMN IF NOT EXISTS dropoff_lat double precision GENERATED ALWAYS AS (CASE WHEN dropoff IS NULL THEN NULL ELSE ST_Y(dropoff::geometry) END) STORED;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trips_role_check'
  ) THEN
    ALTER TABLE public.trips ADD CONSTRAINT trips_role_check CHECK (role IN ('driver','passenger'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trips_vehicle_type_check'
  ) THEN
    ALTER TABLE public.trips ADD CONSTRAINT trips_vehicle_type_check CHECK (vehicle_type IN ('moto','cab','lifan','truck','other'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trips_status_check'
  ) THEN
    ALTER TABLE public.trips ADD CONSTRAINT trips_status_check CHECK (status IN ('open','matched','closed','expired','cancelled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS trips_status_idx ON public.trips (status);
CREATE INDEX IF NOT EXISTS trips_role_idx ON public.trips (role);
CREATE INDEX IF NOT EXISTS trips_vehicle_idx ON public.trips (vehicle_type);
CREATE INDEX IF NOT EXISTS trips_created_idx ON public.trips (created_at DESC);
CREATE INDEX IF NOT EXISTS trips_pickup_gix ON public.trips USING gist (pickup);
CREATE INDEX IF NOT EXISTS trips_dropoff_gix ON public.trips USING gist (dropoff);
CREATE INDEX IF NOT EXISTS trips_open_pickup_gix ON public.trips USING gist (pickup) WHERE status = 'open';

-- ---------------------------------------------------------------------------
-- BASKETS DOMAIN
-- ---------------------------------------------------------------------------

ALTER TABLE public.baskets
  ADD COLUMN IF NOT EXISTS creator_user_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS momo_number_or_code text,
  ADD COLUMN IF NOT EXISTS join_token text,
  ADD COLUMN IF NOT EXISTS join_token_revoked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text;

DO $$
DECLARE
  bad_status_count integer;
  bad_type_count integer;
BEGIN
  SELECT COUNT(*) INTO bad_type_count FROM public.baskets WHERE type IS NOT NULL AND type::text NOT IN ('public','private');
  IF bad_type_count = 0 AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'baskets_type_check') THEN
    ALTER TABLE public.baskets ADD CONSTRAINT baskets_type_check CHECK (type::text IN ('public','private'));
  END IF;

  SELECT COUNT(*) INTO bad_status_count FROM public.baskets WHERE status IS NOT NULL AND status::text NOT IN ('open','closed');
  IF bad_status_count = 0 AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'baskets_status_check') THEN
    ALTER TABLE public.baskets ADD CONSTRAINT baskets_status_check CHECK (status::text IN ('open','closed'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'baskets_join_token_unique') THEN
    ALTER TABLE public.baskets ADD CONSTRAINT baskets_join_token_unique UNIQUE (join_token);
  END IF;
END $$;

ALTER TABLE public.basket_members
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'basket_members_unique') THEN
    ALTER TABLE public.basket_members ADD CONSTRAINT basket_members_unique UNIQUE (basket_id, user_id);
  END IF;
END $$;

-- contributions table as specified
CREATE TABLE IF NOT EXISTS public.contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  basket_id uuid NOT NULL REFERENCES public.baskets(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  amount numeric,
  currency text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- basket joins table
CREATE TABLE IF NOT EXISTS public.basket_joins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  basket_id uuid NOT NULL REFERENCES public.baskets(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  via_token boolean,
  source text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- ---------------------------------------------------------------------------
-- MARKETPLACE
-- ---------------------------------------------------------------------------

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location geography(Point,4326),
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'businesses_status_check') THEN
    ALTER TABLE public.businesses ADD CONSTRAINT businesses_status_check CHECK (status IN ('pending','approved','hidden'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS businesses_location_gix ON public.businesses USING gist (location);
CREATE INDEX IF NOT EXISTS businesses_status_idx ON public.businesses (status);

-- ---------------------------------------------------------------------------
-- INSURANCE
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.insurance_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  file_path text,
  raw_ocr jsonb,
  extracted jsonb,
  status text NOT NULL DEFAULT 'received',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  assigned_admin uuid REFERENCES public.profiles(user_id)
);

ALTER TABLE public.insurance_leads
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'received',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'insurance_leads_status_check') THEN
    ALTER TABLE public.insurance_leads ADD CONSTRAINT insurance_leads_status_check CHECK (status IN ('received','ocr_ok','ocr_error','reviewed'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- WALLET / REFERRALS
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.referral_links (
  user_id uuid REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  code text NOT NULL,
  short_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (user_id, code)
);

CREATE UNIQUE INDEX IF NOT EXISTS referral_links_code_key ON public.referral_links(code);

CREATE TABLE IF NOT EXISTS public.referral_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text,
  clicked_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ip text,
  user_agent text,
  country_guess text
);

CREATE TABLE IF NOT EXISTS public.referral_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text,
  sharer_user_id uuid REFERENCES public.profiles(user_id),
  joiner_user_id uuid REFERENCES public.profiles(user_id),
  first_message_at timestamptz,
  credited boolean NOT NULL DEFAULT false,
  credited_tokens int NOT NULL DEFAULT 0,
  reason text
);

CREATE TABLE IF NOT EXISTS public.wallets (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  balance_tokens int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  delta_tokens int,
  type text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

DO $$
DECLARE
  bad_wallet_type integer;
BEGIN
  SELECT COUNT(*) INTO bad_wallet_type FROM public.wallet_ledger WHERE type IS NOT NULL AND type NOT IN ('referral_credit','redeem','adjust','reversal','welcome_bonus');
  IF bad_wallet_type = 0 AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallet_ledger_type_check') THEN
    ALTER TABLE public.wallet_ledger ADD CONSTRAINT wallet_ledger_type_check CHECK (type IN ('referral_credit','redeem','adjust','reversal','welcome_bonus'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS wallet_ledger_user_idx ON public.wallet_ledger (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.promo_rules (
  id int PRIMARY KEY DEFAULT 1,
  tokens_per_new_user int NOT NULL DEFAULT 10,
  welcome_bonus int,
  daily_cap_per_sharer int
);

CREATE TABLE IF NOT EXISTS public.leaderboard_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_window text,
  generated_at timestamptz,
  top9 jsonb,
  your_rank_map jsonb
);

ALTER TABLE public.leaderboard_snapshots
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS snapshot_window text,
  ADD COLUMN IF NOT EXISTS generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS top9 jsonb,
  ADD COLUMN IF NOT EXISTS your_rank_map jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leaderboard_snapshots_pkey'
  ) THEN
    ALTER TABLE public.leaderboard_snapshots
      ADD CONSTRAINT leaderboard_snapshots_pkey PRIMARY KEY (id);
  END IF;
END $$;

CREATE OR REPLACE VIEW public.leaderboard_snapshots_v AS
  SELECT id, snapshot_window AS window, generated_at, top9, your_rank_map
  FROM public.leaderboard_snapshots;

-- ---------------------------------------------------------------------------
-- MOMO QR
-- ---------------------------------------------------------------------------

ALTER TABLE public.momo_qr_requests
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(user_id),
  ADD COLUMN IF NOT EXISTS msisdn_or_code text,
  ADD COLUMN IF NOT EXISTS amount numeric,
  ADD COLUMN IF NOT EXISTS ussd text,
  ADD COLUMN IF NOT EXISTS tel_uri text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc', now());

CREATE INDEX IF NOT EXISTS momo_qr_requests_user_idx ON public.momo_qr_requests (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- ADMIN / DIAGNOSTICS
-- ---------------------------------------------------------------------------

ALTER TABLE public.admin_audit_log
  ADD COLUMN IF NOT EXISTS admin_user_id uuid REFERENCES public.profiles(user_id),
  ADD COLUMN IF NOT EXISTS target_id text,
  ADD COLUMN IF NOT EXISTS before jsonb,
  ADD COLUMN IF NOT EXISTS after jsonb,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc', now());

ALTER TABLE public.admin_alert_prefs
  ADD COLUMN IF NOT EXISTS admin_user_id uuid REFERENCES public.profiles(user_id),
  ADD COLUMN IF NOT EXISTS alert_key text,
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.admin_alert_prefs'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public.admin_alert_prefs ADD CONSTRAINT admin_alert_prefs_pk PRIMARY KEY (admin_user_id, alert_key);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- INDEX / TRIGGER SAFETY CHECKS
-- ---------------------------------------------------------------------------

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
COMMIT;
