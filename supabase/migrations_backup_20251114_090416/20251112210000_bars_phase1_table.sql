-- =====================================================
-- BARS MIGRATION - PHASE 1: Create Table Structure
-- Generated: 2025-11-12 21:00 UTC
-- =====================================================

BEGIN;

-- Enable PostGIS if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create the bars table with proper schema
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
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT bars_slug_key UNIQUE (slug)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_bars_slug ON public.bars(slug);
CREATE INDEX IF NOT EXISTS idx_bars_country ON public.bars(country);
CREATE INDEX IF NOT EXISTS idx_bars_is_active ON public.bars(is_active);
CREATE INDEX IF NOT EXISTS idx_bars_name ON public.bars USING gin(name gin_trgm_ops);

-- Enable RLS
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "bars_public_read" ON public.bars;
CREATE POLICY "bars_public_read" 
  ON public.bars 
  FOR SELECT 
  USING (is_active = true);

DROP POLICY IF EXISTS "bars_service_role_full_access" ON public.bars;
CREATE POLICY "bars_service_role_full_access" 
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

COMMENT ON TABLE public.bars IS 'Bars and restaurants table with location and contact information';

COMMIT;
