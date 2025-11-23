-- Migration: Create countries table and seed supported MoMo countries
-- Created: 2025-11-23

BEGIN;

CREATE TABLE IF NOT EXISTS public.countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'countries' AND column_name = 'country_code') THEN
    ALTER TABLE public.countries ADD COLUMN country_code text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'countries' AND column_name = 'country_name') THEN
    ALTER TABLE public.countries ADD COLUMN country_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'countries' AND column_name = 'phone_code') THEN
    ALTER TABLE public.countries ADD COLUMN phone_code text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'countries' AND column_name = 'supports_momo') THEN
    ALTER TABLE public.countries ADD COLUMN supports_momo boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'countries' AND column_name = 'supports_rides') THEN
    ALTER TABLE public.countries ADD COLUMN supports_rides boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'countries' AND column_name = 'supports_insurance') THEN
    ALTER TABLE public.countries ADD COLUMN supports_insurance boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'countries' AND column_name = 'momo_provider') THEN
    ALTER TABLE public.countries ADD COLUMN momo_provider text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'countries' AND column_name = 'created_at') THEN
    ALTER TABLE public.countries ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'countries' AND column_name = 'updated_at') THEN
    ALTER TABLE public.countries ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- Indexes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_countries_code') THEN
    CREATE INDEX idx_countries_code ON public.countries(country_code);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_countries_phone') THEN
    CREATE INDEX idx_countries_phone ON public.countries(phone_code);
  END IF;
END $$;

-- Seed initial set
INSERT INTO public.countries (country_code, country_name, phone_code, supports_momo, supports_rides, supports_insurance, momo_provider)
VALUES
  ('MT', 'Malta', '356', false, false, false, NULL),
  ('CA', 'Canada', '1',   false, false, false, NULL),
  ('RW', 'Rwanda', '250', true,  true,  true,  'MTN'),
  ('BI', 'Burundi', '257', true,  true,  true,  'Lumitel'),
  ('CD', 'DR Congo', '243', true,  true,  true,  'Vodacom'),
  ('TZ', 'Tanzania', '255', true,  true,  true,  'M-Pesa'),
  ('ZM', 'Zambia',   '260', true,  true,  true,  'Airtel')
ON CONFLICT (country_code) DO UPDATE
SET country_name = EXCLUDED.country_name,
    phone_code = EXCLUDED.phone_code,
    supports_momo = EXCLUDED.supports_momo,
    supports_rides = EXCLUDED.supports_rides,
    supports_insurance = EXCLUDED.supports_insurance,
    momo_provider = EXCLUDED.momo_provider,
    updated_at = now();

COMMIT;
