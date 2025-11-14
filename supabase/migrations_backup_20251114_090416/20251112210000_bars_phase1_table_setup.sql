-- =====================================================
-- BARS MIGRATION - PHASE 1: Table Setup
-- Generated: 2025-11-12 21:00 UTC
-- Purpose: Create bars table with proper schema
-- Records: 0 (structure only)
-- =====================================================

BEGIN;

-- Enable PostGIS if not already enabled (for geography type)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create the 'bars' table with proper structure
CREATE TABLE IF NOT EXISTS public.bars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    location_text TEXT,
    country TEXT,
    city_area TEXT,
    currency TEXT,
    momo_code TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    location GEOGRAPHY(POINT, 4326),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_bars_slug ON public.bars(slug);
CREATE INDEX IF NOT EXISTS idx_bars_country ON public.bars(country);
CREATE INDEX IF NOT EXISTS idx_bars_city_area ON public.bars(city_area);
CREATE INDEX IF NOT EXISTS idx_bars_location ON public.bars USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_bars_active ON public.bars(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "bars_public_read" ON public.bars;
CREATE POLICY "bars_public_read" 
  ON public.bars 
  FOR SELECT 
  USING (is_active = true);

DROP POLICY IF EXISTS "bars_service_role_full" ON public.bars;
CREATE POLICY "bars_service_role_full" 
  ON public.bars 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.update_bars_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_bars_updated_at ON public.bars;
CREATE TRIGGER trigger_update_bars_updated_at
  BEFORE UPDATE ON public.bars
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bars_updated_at();

-- Add comment
COMMENT ON TABLE public.bars IS 'Bars and restaurants directory with location data';

COMMIT;
