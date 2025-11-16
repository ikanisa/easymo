-- =====================================================
-- PHASE 1: Create bars table with PostGIS support
-- Generated: 2025-11-12 21:00 UTC
-- Description: Creates the bars table structure
-- =====================================================

BEGIN;

-- Enable PostGIS if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create the 'bars' table
CREATE TABLE IF NOT EXISTS public.bars (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL,
    name text NOT NULL,
    location_text text,
    country text,
    city_area text,
    currency text,
    momo_code text,
    is_active boolean NOT NULL DEFAULT true,
    lat double precision,
    lng double precision,
    location geography(POINT, 4326),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT bars_slug_key UNIQUE (slug)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bars_slug ON public.bars(slug);
CREATE INDEX IF NOT EXISTS idx_bars_location ON public.bars USING GIST(location) WHERE location IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bars_active ON public.bars(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_bars_country ON public.bars(country);

-- Enable RLS
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "bars_public_read" ON public.bars
  FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

CREATE POLICY "bars_service_role_all" ON public.bars
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_bars_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bars_updated_at
  BEFORE UPDATE ON public.bars
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bars_updated_at();

-- Add comment
COMMENT ON TABLE public.bars IS 'Bars and restaurants with location data';

COMMIT;
