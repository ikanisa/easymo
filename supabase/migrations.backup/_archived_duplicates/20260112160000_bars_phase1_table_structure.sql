-- =====================================================
-- BARS MIGRATION - PHASE 1: Table Structure
-- Generated: 2025-11-12 16:50:42 UTC
-- Purpose: Create bars table with proper structure and indexes
-- =====================================================

BEGIN;

-- 1. Ensure PostGIS extension is enabled (for geography type)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Create the 'bars' table with all necessary columns
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
    
    -- Geographic coordinates
    lat double precision,
    lng double precision,
    location geography(POINT, 4326),
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT bars_slug_key UNIQUE (slug)
);

-- 3. Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_bars_slug ON public.bars(slug);
CREATE INDEX IF NOT EXISTS idx_bars_country_city ON public.bars(country, city_area);
CREATE INDEX IF NOT EXISTS idx_bars_location_gist ON public.bars USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_bars_is_active ON public.bars(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_bars_lat_lng ON public.bars(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- 4. Add updated_at trigger
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

-- 5. Enable RLS
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies
-- Public read access for active bars
DROP POLICY IF EXISTS "bars_public_read" ON public.bars;
CREATE POLICY "bars_public_read"
  ON public.bars
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Service role has full access
DROP POLICY IF EXISTS "bars_service_role_all" ON public.bars;
CREATE POLICY "bars_service_role_all"
  ON public.bars
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 7. Grant permissions
GRANT SELECT ON public.bars TO anon, authenticated;
GRANT ALL ON public.bars TO service_role;

-- 8. Add table comment
COMMENT ON TABLE public.bars IS 'Bars and restaurants directory with geographic location support';
COMMENT ON COLUMN public.bars.location IS 'PostGIS geography point (SRID 4326) for precise location queries';
COMMENT ON COLUMN public.bars.slug IS 'URL-friendly unique identifier';

COMMIT;
