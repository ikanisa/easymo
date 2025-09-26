-- Phase A legacy features support (baskets, marketplace, wallet, MoMo, admin audit, insurance OCR queue)
-- Additive-only migration.

BEGIN;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------
-- Profiles (for WA interactions)
-- ------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_e164 text UNIQUE NOT NULL,
  display_name text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_updated'
  ) THEN
    CREATE TRIGGER trg_profiles_updated
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ------------------------------
-- Helper: haversine distance (km)
-- ------------------------------
CREATE OR REPLACE FUNCTION public.haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 2 * 6371 * asin(
    sqrt(
      pow(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) * pow(sin(radians(lng2 - lng1) / 2), 2)
    )
  );
$$;

-- ------------------------------
-- Baskets domain
-- ------------------------------
CREATE TABLE IF NOT EXISTS public.baskets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_profile_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  owner_whatsapp text,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  currency text NOT NULL DEFAULT 'RWF',
  goal_minor integer,
  is_public boolean NOT NULL DEFAULT false,
  share_token text UNIQUE,
  lat double precision,
  lng double precision,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.baskets
  ADD COLUMN IF NOT EXISTS owner_profile_id uuid,
  ADD COLUMN IF NOT EXISTS owner_whatsapp text,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS goal_minor integer,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'RWF',
  ADD COLUMN IF NOT EXISTS share_token text,
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_baskets_updated_v2'
  ) THEN
    CREATE TRIGGER trg_baskets_updated_v2
      BEFORE UPDATE ON public.baskets
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.basket_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  basket_id uuid NOT NULL REFERENCES public.baskets(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  whatsapp text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (basket_id, whatsapp)
);

ALTER TABLE public.basket_members
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS profile_id uuid,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS joined_at timestamptz NOT NULL DEFAULT timezone('utc', now());

CREATE TABLE IF NOT EXISTS public.basket_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  basket_id uuid NOT NULL REFERENCES public.baskets(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  amount_minor integer NOT NULL,
  currency text NOT NULL DEFAULT 'RWF',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.basket_contributions
  ADD COLUMN IF NOT EXISTS amount_minor integer,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'RWF',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc', now());

CREATE INDEX IF NOT EXISTS idx_basket_members_basket ON public.basket_members (basket_id);
CREATE INDEX IF NOT EXISTS idx_basket_contrib_basket ON public.basket_contributions (basket_id);
CREATE INDEX IF NOT EXISTS idx_baskets_public_status ON public.baskets (is_public, status);

-- Basket RPC helpers
CREATE OR REPLACE FUNCTION public.basket_create(
  _profile_id uuid,
  _whatsapp text,
  _name text,
  _is_public boolean,
  _goal_minor integer
)
RETURNS TABLE(basket_id uuid, share_token text, qr_url text)
LANGUAGE plpgsql
AS $$
DECLARE
  v_basket_id uuid;
  v_token text;
BEGIN
  v_token := upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
  INSERT INTO public.baskets (owner_profile_id, owner_whatsapp, name, is_public, goal_minor, share_token)
  VALUES (_profile_id, _whatsapp, _name, COALESCE(_is_public, false), _goal_minor, v_token)
  RETURNING id INTO v_basket_id;

  INSERT INTO public.basket_members (basket_id, profile_id, whatsapp, role)
  VALUES (v_basket_id, _profile_id, COALESCE(_whatsapp, ''), 'owner')
  ON CONFLICT DO NOTHING;

  basket_id := v_basket_id;
  share_token := v_token;
  qr_url := 'https://quickchart.io/qr?text=JB:' || v_token;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.basket_join_by_code(
  _profile_id uuid,
  _whatsapp text,
  _code text
)
RETURNS TABLE(basket_id uuid, basket_name text)
LANGUAGE plpgsql
AS $$
DECLARE
  v_token text;
  v_basket public.baskets;
BEGIN
  IF _code IS NULL OR length(_code) < 4 THEN
    RETURN;
  END IF;
  v_token := upper(regexp_replace(_code, '^JB[:\-]?', ''));
  SELECT * INTO v_basket FROM public.baskets WHERE share_token = v_token LIMIT 1;
  IF v_basket.id IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.basket_members (basket_id, profile_id, whatsapp, role)
  VALUES (v_basket.id, _profile_id, COALESCE(_whatsapp, ''), 'member')
  ON CONFLICT (basket_id, whatsapp) DO UPDATE SET role = EXCLUDED.role;
  basket_id := v_basket.id;
  basket_name := v_basket.name;
  RETURN NEXT;
END;
$$;

-- helper returning whatsapp for profile ids
CREATE OR REPLACE FUNCTION public.profile_wa(_profile_id uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT whatsapp_e164 FROM public.profiles WHERE user_id = _profile_id;
$$;

CREATE OR REPLACE FUNCTION public.basket_list_mine(_profile_id uuid)
RETURNS TABLE(id uuid, name text, status text, member_count integer, balance_minor integer, currency text)
LANGUAGE sql
AS $$
  SELECT b.id,
         b.name,
         b.status,
         (SELECT count(*) FROM public.basket_members bm WHERE bm.basket_id = b.id) AS member_count,
         COALESCE((SELECT sum(amount_minor) FROM public.basket_contributions bc WHERE bc.basket_id = b.id), 0) AS balance_minor,
         b.currency
  FROM public.baskets b
  WHERE EXISTS (
    SELECT 1 FROM public.basket_members m
    WHERE m.basket_id = b.id
      AND (
        (_profile_id IS NOT NULL AND m.profile_id = _profile_id)
        OR (
          COALESCE(public.profile_wa(_profile_id), '') <> ''
          AND m.whatsapp = public.profile_wa(_profile_id)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.basket_discover_nearby(
  _profile_id uuid,
  _lat double precision,
  _lng double precision,
  _limit integer DEFAULT 10
)
RETURNS TABLE(id uuid, name text, description text, distance_km double precision, member_count integer)
LANGUAGE sql
AS $$
  SELECT b.id,
         b.name,
         b.description,
         CASE
           WHEN b.lat IS NULL OR b.lng IS NULL THEN NULL
           ELSE public.haversine_km(b.lat, b.lng, _lat, _lng)
         END AS distance_km,
         (SELECT count(*) FROM public.basket_members bm WHERE bm.basket_id = b.id) AS member_count
  FROM public.baskets b
  WHERE b.is_public = true AND b.status::text = 'open'
  ORDER BY distance_km NULLS LAST, b.created_at DESC
  LIMIT COALESCE(_limit, 10);
$$;

CREATE OR REPLACE FUNCTION public.basket_detail(
  _profile_id uuid,
  _basket_id uuid
)
RETURNS TABLE(
  id uuid,
  name text,
  status text,
  member_count integer,
  balance_minor integer,
  goal_minor integer,
  currency text,
  share_token text,
  is_owner boolean,
  owner_name text,
  owner_whatsapp text,
  last_activity timestamptz
)
LANGUAGE sql
AS $$
  SELECT b.id,
         b.name,
         b.status,
         (SELECT count(*) FROM public.basket_members bm WHERE bm.basket_id = b.id) AS member_count,
         COALESCE((SELECT sum(amount_minor) FROM public.basket_contributions bc WHERE bc.basket_id = b.id), 0) AS balance_minor,
         b.goal_minor,
         b.currency,
         b.share_token,
         (b.owner_profile_id = _profile_id OR b.owner_whatsapp = public.profile_wa(_profile_id)) AS is_owner,
         (SELECT display_name FROM public.profiles p WHERE p.user_id = b.owner_profile_id) AS owner_name,
         b.owner_whatsapp,
         GREATEST(
           b.updated_at,
           COALESCE((SELECT max(bm.joined_at) FROM public.basket_members bm WHERE bm.basket_id = b.id), b.updated_at),
           COALESCE((SELECT max(bc.created_at) FROM public.basket_contributions bc WHERE bc.basket_id = b.id), b.updated_at)
         ) AS last_activity
  FROM public.baskets b
  WHERE b.id = _basket_id;
$$;

CREATE OR REPLACE FUNCTION public.basket_generate_qr(
  _profile_id uuid,
  _basket_id uuid
)
RETURNS TABLE(qr_url text)
LANGUAGE sql
AS $$
  SELECT 'https://quickchart.io/qr?text=JB:' || COALESCE(share_token, '') AS qr_url
  FROM public.baskets
  WHERE id = _basket_id;
$$;

CREATE OR REPLACE FUNCTION public.basket_close(_profile_id uuid, _basket_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.baskets
  SET status = 'closed', updated_at = timezone('utc', now())
  WHERE id = _basket_id AND (owner_profile_id = _profile_id OR owner_profile_id IS NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.basket_leave(_profile_id uuid, _basket_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.basket_members
  WHERE basket_id = _basket_id
    AND (profile_id = _profile_id OR (SELECT whatsapp_e164 FROM public.profiles WHERE user_id = _profile_id) = whatsapp);
END;
$$;

-- ------------------------------
-- Marketplace businesses
-- ------------------------------
CREATE TABLE IF NOT EXISTS public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_whatsapp text NOT NULL,
  name text NOT NULL,
  description text,
  catalog_url text,
  location_text text,
  lat double precision,
  lng double precision,
  category text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_businesses_active ON public.businesses (is_active);

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS owner_whatsapp text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS catalog_url text,
  ADD COLUMN IF NOT EXISTS location_text text,
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

DROP FUNCTION IF EXISTS public.nearby_businesses(double precision, double precision, text, integer);
DROP FUNCTION IF EXISTS public.nearby_businesses(double precision, double precision, text, text, integer);

CREATE OR REPLACE FUNCTION public.nearby_businesses(
  _lat double precision,
  _lng double precision,
  _viewer text,
  _category text DEFAULT NULL,
  _limit integer DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  owner_whatsapp text,
  name text,
  description text,
  location_text text,
  category text,
  distance_km double precision
)
LANGUAGE sql
AS $$
  SELECT b.id,
         b.owner_whatsapp,
         b.name,
         b.description,
         b.location_text,
         b.category,
         CASE
           WHEN b.lat IS NULL OR b.lng IS NULL THEN NULL
           ELSE public.haversine_km(b.lat, b.lng, _lat, _lng)
         END AS distance_km
  FROM public.businesses b
  WHERE b.is_active = true
    AND (
      _category IS NULL OR _category = '' OR
      lower(coalesce(b.category, 'other')) = lower(_category)
    )
  ORDER BY distance_km NULLS LAST, b.created_at DESC
  LIMIT COALESCE(_limit, 10);
$$;

CREATE OR REPLACE FUNCTION public.marketplace_add_business(
  _owner text,
  _name text,
  _description text,
  _catalog text,
  _category text,
  _lat double precision,
  _lng double precision
)
RETURNS uuid
LANGUAGE sql
AS $$
  INSERT INTO public.businesses (owner_whatsapp, name, description, catalog_url, category, lat, lng)
  VALUES (_owner, _name, _description, _catalog, _category, _lat, _lng)
  RETURNING id;
$$;

-- ------------------------------
-- Wallet domain
-- ------------------------------
CREATE TABLE IF NOT EXISTS public.wallet_accounts (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  balance_minor integer NOT NULL DEFAULT 0,
  pending_minor integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'RWF',
  tokens integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  amount_minor integer NOT NULL,
  currency text NOT NULL DEFAULT 'RWF',
  direction text NOT NULL DEFAULT 'credit',
  description text,
  occurred_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.wallet_earn_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  description text,
  reward_tokens integer,
  referral_code text,
  share_text text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.wallet_redeem_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  description text,
  cost_tokens integer,
  instructions text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.wallet_promoters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text,
  whatsapp text,
  tokens integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_profile ON public.wallet_transactions (profile_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_earn_active ON public.wallet_earn_actions (is_active);
CREATE INDEX IF NOT EXISTS idx_wallet_redeem_active ON public.wallet_redeem_options (is_active);

CREATE OR REPLACE FUNCTION public.wallet_summary(_profile_id uuid)
RETURNS TABLE(balance_minor integer, pending_minor integer, currency text, tokens integer)
LANGUAGE sql
AS $$
  SELECT balance_minor, pending_minor, currency, tokens
  FROM public.wallet_accounts
  WHERE profile_id = _profile_id;
$$;

CREATE OR REPLACE FUNCTION public.wallet_transactions_recent(_profile_id uuid, _limit integer DEFAULT 5)
RETURNS SETOF public.wallet_transactions
LANGUAGE sql
AS $$
  SELECT * FROM public.wallet_transactions
  WHERE profile_id = _profile_id
  ORDER BY occurred_at DESC
  LIMIT COALESCE(_limit, 5);
$$;

CREATE OR REPLACE FUNCTION public.wallet_earn_actions(_profile_id uuid, _limit integer DEFAULT 10)
RETURNS SETOF public.wallet_earn_actions
LANGUAGE sql
AS $$
  SELECT * FROM public.wallet_earn_actions
  WHERE is_active = true
  ORDER BY created_at DESC
  LIMIT COALESCE(_limit, 10);
$$;

CREATE OR REPLACE FUNCTION public.wallet_redeem_options(_profile_id uuid)
RETURNS SETOF public.wallet_redeem_options
LANGUAGE sql
AS $$
  SELECT * FROM public.wallet_redeem_options WHERE is_active = true ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.wallet_top_promoters(_limit integer DEFAULT 9)
RETURNS SETOF public.wallet_promoters
LANGUAGE sql
AS $$
  SELECT * FROM public.wallet_promoters ORDER BY tokens DESC, updated_at DESC LIMIT COALESCE(_limit, 9);
$$;

-- ------------------------------
-- MoMo QR requests log
-- ------------------------------
CREATE TABLE IF NOT EXISTS public.momo_qr_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_wa_id text NOT NULL,
  target_value text NOT NULL,
  target_type text NOT NULL,
  amount_minor integer,
  qr_url text,
  ussd_code text,
  tel_uri text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.momo_qr_requests
  ADD COLUMN IF NOT EXISTS requester_wa_id text,
  ADD COLUMN IF NOT EXISTS target_value text,
  ADD COLUMN IF NOT EXISTS target_type text,
  ADD COLUMN IF NOT EXISTS amount_minor integer,
  ADD COLUMN IF NOT EXISTS qr_url text,
  ADD COLUMN IF NOT EXISTS ussd_code text,
  ADD COLUMN IF NOT EXISTS tel_uri text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc', now());

CREATE INDEX IF NOT EXISTS idx_momo_qr_requests_requester ON public.momo_qr_requests (requester_wa_id, created_at DESC);

-- ------------------------------
-- Insurance OCR queue
-- ------------------------------
CREATE TABLE IF NOT EXISTS public.insurance_media_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  wa_id text,
  storage_path text NOT NULL,
  mime_type text,
  caption text,
  status text NOT NULL DEFAULT 'queued',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE OR REPLACE FUNCTION public.insurance_queue_media(
  _profile_id uuid,
  _wa_id text,
  _storage_path text,
  _mime_type text,
  _caption text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.insurance_media_queue (profile_id, wa_id, storage_path, mime_type, caption)
  VALUES (_profile_id, _wa_id, _storage_path, _mime_type, _caption);
END;
$$;

-- ------------------------------
-- Admin audit & alerts
-- ------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_wa text,
  action text NOT NULL,
  target text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.admin_alert_prefs (
  wa_id text PRIMARY KEY,
  want_alerts boolean NOT NULL DEFAULT true,
  channels text[] NOT NULL DEFAULT ARRAY['whatsapp'],
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.admin_pin_sessions (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id text NOT NULL,
  unlocked_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.admin_submissions (
  reference text PRIMARY KEY,
  applicant_name text,
  status text NOT NULL DEFAULT 'pending',
  submitted_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE OR REPLACE FUNCTION public.admin_sub_command(
  _action text,
  _reference text,
  _actor text
)
RETURNS TABLE(status text)
LANGUAGE plpgsql
AS $$
DECLARE
  v_status text;
BEGIN
  IF _action IS NULL OR _reference IS NULL THEN
    status := 'invalid';
    RETURN NEXT;
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_submissions WHERE reference = _reference) THEN
    INSERT INTO public.admin_submissions (reference, applicant_name)
    VALUES (_reference, NULL)
    ON CONFLICT (reference) DO NOTHING;
  END IF;
  IF _action = 'approve' THEN
    UPDATE public.admin_submissions SET status = 'approved' WHERE reference = _reference;
    v_status := 'approved';
  ELSIF _action = 'reject' THEN
    UPDATE public.admin_submissions SET status = 'rejected' WHERE reference = _reference;
    v_status := 'rejected';
  ELSE
    v_status := 'unknown_action';
  END IF;
  INSERT INTO public.admin_audit_log (actor_wa, action, target, details)
  VALUES (_actor, 'sub_' || _action, _reference, jsonb_build_object('reference', _reference));
  status := v_status;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_sub_list_pending(_limit integer DEFAULT 10)
RETURNS TABLE(reference text, name text, submitted_at timestamptz)
LANGUAGE sql
AS $$
  SELECT reference, applicant_name, submitted_at
  FROM public.admin_submissions
  WHERE status = 'pending'
  ORDER BY submitted_at ASC
  LIMIT COALESCE(_limit, 10);
$$;

-- ------------------------------
-- Seed minimal defaults (idempotent)
-- ------------------------------
INSERT INTO public.wallet_earn_actions (id, title, description, reward_tokens, referral_code, share_text)
VALUES (
  gen_random_uuid(), 'Invite a friend', 'Share referral link to earn tokens', 10, 'REF123', 'Join easyMO!'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.wallet_redeem_options (id, title, description, cost_tokens, instructions)
VALUES (
  gen_random_uuid(), 'MoMo airtime', 'Redeem tokens for airtime top-up', 50, 'Contact support with code.'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.wallet_promoters (id, display_name, whatsapp, tokens)
VALUES (
  gen_random_uuid(), 'Top Promoter', '+250700000000', 120
)
ON CONFLICT DO NOTHING;
COMMIT;
