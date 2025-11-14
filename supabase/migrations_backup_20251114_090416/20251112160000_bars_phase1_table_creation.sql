-- =====================================================
-- PHASE 1: Bars Table Structure Creation
-- Migration: 20251112160000_bars_phase1_table_creation.sql
-- Purpose: Create bars table with all necessary columns and constraints
-- =====================================================

BEGIN;

-- Enable PostGIS if not already enabled (for geography support)
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

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_bars_slug ON public.bars(slug);
CREATE INDEX IF NOT EXISTS idx_bars_country ON public.bars(country) WHERE country IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bars_is_active ON public.bars(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_bars_location ON public.bars USING GIST(location) WHERE location IS NOT NULL;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.update_bars_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
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
DROP POLICY IF EXISTS "bars_public_read" ON public.bars;
CREATE POLICY "bars_public_read" 
  ON public.bars 
  FOR SELECT 
  USING (is_active = true);

DROP POLICY IF EXISTS "bars_service_role_all" ON public.bars;
CREATE POLICY "bars_service_role_all" 
  ON public.bars 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- Add comments
COMMENT ON TABLE public.bars IS 'Stores information about bars and restaurants';
COMMENT ON COLUMN public.bars.location IS 'PostGIS geography point for spatial queries';
COMMENT ON COLUMN public.bars.slug IS 'URL-friendly unique identifier';

COMMIT;
