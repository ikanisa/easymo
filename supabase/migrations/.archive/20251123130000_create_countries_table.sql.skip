-- Transaction wrapper for production safety
BEGIN;

-- Migration: Create Countries Table
-- Created: 2025-11-23
-- Purpose: Filter MOMO QR code availability by country.

CREATE TABLE IF NOT EXISTS public.countries (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    code text NOT NULL UNIQUE, -- ISO 2-letter code
    phone_code text NOT NULL, -- e.g. 250
    momo_supported boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Seed Data
INSERT INTO public.countries (name, code, phone_code, momo_supported)
VALUES 
    ('Rwanda', 'RW', '250', true),
    ('Burundi', 'BI', '257', true),
    ('DR Congo', 'CD', '243', true),
    ('Tanzania', 'TZ', '255', true),
    ('Zambia', 'ZM', '260', true),
    ('Malta', 'MT', '356', false),
    ('Canada', 'CA', '1', false)
ON CONFLICT (code) DO UPDATE SET 
    momo_supported = EXCLUDED.momo_supported,
    phone_code = EXCLUDED.phone_code;

-- Enable RLS
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone (service role and authenticated)
CREATE POLICY "Allow public read access" ON public.countries FOR SELECT USING (true);

GRANT ALL ON public.countries TO service_role;
GRANT SELECT ON public.countries TO authenticated;
GRANT SELECT ON public.countries TO anon;

COMMIT;
