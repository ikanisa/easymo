-- =====================================================
-- PHASE 1: CREATE BARS TABLE WITH POSTGIS
-- =====================================================
-- Migration: Create bars table structure
-- Date: 2025-11-12
-- Description: Phase 1 - Create bars table with PostGIS support

BEGIN;

-- Ensure PostGIS is enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create the bars table
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

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_bars_slug ON public.bars(slug);
CREATE INDEX IF NOT EXISTS idx_bars_country ON public.bars(country);
CREATE INDEX IF NOT EXISTS idx_bars_is_active ON public.bars(is_active);
CREATE INDEX IF NOT EXISTS idx_bars_location_gist ON public.bars USING GIST(location);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_bars_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_bars_updated_at ON public.bars;
CREATE TRIGGER trigger_update_bars_updated_at
  BEFORE UPDATE ON public.bars
  FOR EACH ROW
  EXECUTE FUNCTION update_bars_updated_at();

-- Enable RLS
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Anyone can read active bars" ON public.bars;
CREATE POLICY "Anyone can read active bars"
  ON public.bars
  FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

DROP POLICY IF EXISTS "Service role can manage all bars" ON public.bars;
CREATE POLICY "Service role can manage all bars"
  ON public.bars
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.bars IS 'Bars and restaurants table with location data';

COMMIT;
