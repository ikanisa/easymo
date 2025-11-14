-- =====================================================
-- PHASE 1: Create Bars Table Structure
-- Migration: 20251112220000_bars_phase1_table_structure.sql
-- Description: Create the bars table with proper schema
-- =====================================================

BEGIN;

-- Enable PostGIS if not already enabled (for geography columns)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Drop the table if it exists to start fresh
DROP TABLE IF EXISTS public.bars CASCADE;

-- Create the 'bars' table with all required columns
CREATE TABLE public.bars (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    location_text text,
    country text,
    city_area text,
    currency text,
    momo_code text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    lat double precision,
    lng double precision,
    location geography(Point, 4326),
    CONSTRAINT bars_slug_key UNIQUE (slug)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_bars_slug ON public.bars(slug);
CREATE INDEX IF NOT EXISTS idx_bars_name ON public.bars(name);
CREATE INDEX IF NOT EXISTS idx_bars_country ON public.bars(country);
CREATE INDEX IF NOT EXISTS idx_bars_city_area ON public.bars(city_area);
CREATE INDEX IF NOT EXISTS idx_bars_is_active ON public.bars(is_active);
CREATE INDEX IF NOT EXISTS idx_bars_location ON public.bars USING GIST(location);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.update_bars_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_bars_updated_at ON public.bars;
CREATE TRIGGER set_bars_updated_at
  BEFORE UPDATE ON public.bars
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bars_updated_at();

-- Enable RLS
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Public read access for active bars
CREATE POLICY "Public can read active bars"
  ON public.bars
  FOR SELECT
  TO public, authenticated, anon
  USING (is_active = true);

-- Service role full access
CREATE POLICY "Service role full access to bars"
  ON public.bars
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comments
COMMENT ON TABLE public.bars IS 'Bars and restaurants directory';
COMMENT ON COLUMN public.bars.location IS 'Geographic point data using SRID 4326 (WGS 84)';
COMMENT ON COLUMN public.bars.slug IS 'URL-friendly unique identifier';

COMMIT;
