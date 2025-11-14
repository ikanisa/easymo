-- =====================================================
-- PHASE 1: BARS TABLE CREATION (Core Infrastructure)
-- =====================================================
-- This phase creates the bars table structure with proper indexes and RLS
-- Generated: 2025-11-12 22:14 UTC
-- =====================================================

BEGIN;

-- Enable PostGIS if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Create the 'bars' table with proper structure
CREATE TABLE IF NOT EXISTS public.bars (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
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
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bars_slug ON public.bars(slug);
CREATE INDEX IF NOT EXISTS idx_bars_country ON public.bars(country) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_bars_is_active ON public.bars(is_active);
CREATE INDEX IF NOT EXISTS idx_bars_location ON public.bars USING GIST(location) WHERE location IS NOT NULL;

-- 3. Create updated_at trigger
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
DROP POLICY IF EXISTS "bars_public_read" ON public.bars;
CREATE POLICY "bars_public_read" 
  ON public.bars 
  FOR SELECT 
  TO authenticated, anon
  USING (is_active = true);

DROP POLICY IF EXISTS "bars_service_role_all" ON public.bars;
CREATE POLICY "bars_service_role_all" 
  ON public.bars 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- 6. Grant permissions
GRANT SELECT ON public.bars TO authenticated, anon;
GRANT ALL ON public.bars TO service_role;

-- 7. Add comments
COMMENT ON TABLE public.bars IS 'Stores information about bars and restaurants with geographic data';
COMMENT ON COLUMN public.bars.location IS 'PostGIS geography point for spatial queries (SRID 4326)';
COMMENT ON COLUMN public.bars.slug IS 'URL-friendly unique identifier';

COMMIT;
