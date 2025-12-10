-- =====================================================
-- BARS MIGRATION - PHASE 1: CREATE TABLE
-- Generated: 2025-11-12 22:14 UTC
-- Description: Create bars table structure with all necessary columns
-- =====================================================

BEGIN;

-- Enable PostGIS if not already enabled (required for geography columns)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Create the 'bars' table with all necessary columns
CREATE TABLE IF NOT EXISTS public.bars (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    location_text text,
    country text,
    city_area text,
    currency text,
    momo_code text,
    phone text,
    lat double precision,
    lng double precision,
    location geography(POINT, 4326),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bars_slug ON public.bars(slug);
CREATE INDEX IF NOT EXISTS idx_bars_country ON public.bars(country) WHERE country IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bars_city_area ON public.bars(city_area) WHERE city_area IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bars_is_active ON public.bars(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_bars_location ON public.bars USING GIST(location) WHERE location IS NOT NULL;

-- 3. Add updated_at trigger
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

-- 4. Enable RLS
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies
-- Public read access for active bars
CREATE POLICY "bars_public_read" ON public.bars
  FOR SELECT
  USING (is_active = true);

-- Service role full access
CREATE POLICY "bars_service_role_full_access" ON public.bars
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.bars TO anon, authenticated;
GRANT ALL ON public.bars TO service_role;

-- Add comment
COMMENT ON TABLE public.bars IS 'Bars and restaurants table with location data';

COMMIT;
