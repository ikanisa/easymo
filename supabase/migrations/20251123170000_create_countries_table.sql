-- Migration: Create countries table and seed supported MoMo countries
-- Created: 2025-11-23

BEGIN;

CREATE TABLE IF NOT EXISTS public.countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text UNIQUE NOT NULL,         -- ISO 3166-1 alpha-2 (e.g., RW)
  country_name text NOT NULL,
  phone_code text NOT NULL,                  -- digits only without + (e.g., 250)
  supports_momo boolean NOT NULL DEFAULT false,
  supports_rides boolean NOT NULL DEFAULT false,
  supports_insurance boolean NOT NULL DEFAULT false,
  momo_provider text,                        -- e.g., MTN, M-Pesa, Airtel
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_countries_code ON public.countries(country_code);
CREATE INDEX IF NOT EXISTS idx_countries_phone ON public.countries(phone_code);

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

