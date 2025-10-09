-- Schema alignment updates for runtime config, mobility and baskets per master spec

-- app_config additions
BEGIN;
ALTER TABLE public.app_config
  ADD COLUMN IF NOT EXISTS momo_qr_logo_url text,
  ADD COLUMN IF NOT EXISTS redeem_catalog jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS admin_pin_required boolean NOT NULL DEFAULT true;

UPDATE public.app_config
SET admin_pin_required = COALESCE(admin_pin_required, true),
    redeem_catalog = COALESCE(redeem_catalog, '{}'::jsonb)
WHERE id = 1;

-- driver_status geography support
ALTER TABLE public.driver_status
  ADD COLUMN IF NOT EXISTS location geography(Point, 4326);

UPDATE public.driver_status
SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
WHERE location IS NULL AND lat IS NOT NULL AND lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS driver_status_location_gix ON public.driver_status USING GIST (location);

-- trips geography & metadata
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS pickup geography(Point, 4326),
  ADD COLUMN IF NOT EXISTS dropoff geography(Point, 4326),
  ADD COLUMN IF NOT EXISTS pickup_text text,
  ADD COLUMN IF NOT EXISTS dropoff_text text,
  ADD COLUMN IF NOT EXISTS pickup_radius_m integer NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS dropoff_radius_m integer NOT NULL DEFAULT 200;

UPDATE public.trips
SET pickup = ST_SetSRID(ST_MakePoint(pickup_lng, pickup_lat), 4326)
WHERE pickup IS NULL AND pickup_lat IS NOT NULL AND pickup_lng IS NOT NULL;

UPDATE public.trips
SET dropoff = ST_SetSRID(ST_MakePoint(dropoff_lng, dropoff_lat), 4326)
WHERE dropoff IS NULL AND dropoff_lat IS NOT NULL AND dropoff_lng IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trips_status_check_spec') THEN
    ALTER TABLE public.trips ADD CONSTRAINT trips_status_check_spec CHECK (status IN ('open', 'matched', 'cancelled', 'expired', 'archived'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS trips_pickup_gix ON public.trips USING GIST (pickup);
CREATE INDEX IF NOT EXISTS trips_dropoff_gix ON public.trips USING GIST (dropoff);
CREATE INDEX IF NOT EXISTS trips_status_role_idx ON public.trips (status, role);

-- basket schema enrichment
ALTER TABLE public.baskets
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS momo_number_or_code text,
  ADD COLUMN IF NOT EXISTS join_token text,
  ADD COLUMN IF NOT EXISTS join_token_revoked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.baskets
SET join_token = COALESCE(join_token, share_token)
WHERE join_token IS NULL AND share_token IS NOT NULL;

ALTER TABLE public.baskets
  ADD CONSTRAINT baskets_status_check CHECK (status::text IN ('open', 'locked', 'closed', 'archived')) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_baskets_join_token ON public.baskets (join_token) WHERE join_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.basket_joins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  basket_id uuid NOT NULL REFERENCES public.baskets(id) ON DELETE CASCADE,
  whatsapp text,
  user_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  invite_source text,
  status text NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  processed_at timestamptz
);

ALTER TABLE public.basket_joins
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invite_source text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_basket_joins_unique ON public.basket_joins (basket_id, COALESCE(whatsapp, ''));
CREATE INDEX IF NOT EXISTS idx_basket_joins_status ON public.basket_joins (status, created_at DESC);

ALTER TABLE public.basket_members
  ADD COLUMN IF NOT EXISTS joined_via text,
  ADD COLUMN IF NOT EXISTS join_reference text;

ALTER TABLE public.basket_contributions
  ADD COLUMN IF NOT EXISTS momo_reference text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- validate new constraints where possible
COMMIT;
