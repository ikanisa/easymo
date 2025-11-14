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

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now());

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
