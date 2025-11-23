-- Migration: Create countries table and seed data
-- Created: 2025-11-23
-- Purpose: Support country-specific features like MOMO QR codes

BEGIN;

CREATE TABLE IF NOT EXISTS public.countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE, -- ISO 2-letter code
  phone_code text NOT NULL, -- e.g. 250
  momo_supported boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Insert seed data
INSERT INTO public.countries (name, code, phone_code, momo_supported)
VALUES
  ('Rwanda', 'RW', '250', true),
  ('Burundi', 'BI', '257', true),
  ('DR Congo', 'CD', '243', true),
  ('Tanzania', 'TZ', '255', true),
  ('Zambia', 'ZM', '260', true),
  ('Malta', 'MT', '356', false),
  ('Canada', 'CA', '1', false)
ON CONFLICT (code) DO UPDATE
SET momo_supported = EXCLUDED.momo_supported;

COMMIT;
