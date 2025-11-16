-- =====================================================
-- BARS MIGRATION - PHASE 1: Table Creation
-- Date: 2026-01-12
-- Description: Create bars table with proper schema
-- Records: 0 (table structure only)
-- =====================================================

BEGIN;

-- 1. Create the 'bars' table
CREATE TABLE IF NOT EXISTS public.bars (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL,
    name text NOT NULL,
    location_text text,
    country text,
    city_area text,
    currency text,
    momo_code text,
    lat double precision,
    lng double precision,
    location geography(POINT, 4326),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT bars_slug_key UNIQUE (slug)
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bars_slug ON public.bars(slug);
CREATE INDEX IF NOT EXISTS idx_bars_country ON public.bars(country) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_bars_location ON public.bars USING GIST (location) WHERE location IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bars_active ON public.bars(is_active);

-- 3. Enable RLS
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Public read access to active bars
CREATE POLICY "Public can view active bars"
  ON public.bars
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Service role full access
CREATE POLICY "Service role full access bars"
  ON public.bars
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. Add updated_at trigger
CREATE OR REPLACE FUNCTION public.update_bars_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bars_updated_at
  BEFORE UPDATE ON public.bars
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bars_updated_at();

-- 6. Add comments
COMMENT ON TABLE public.bars IS 'Bars and restaurants directory with location data';
COMMENT ON COLUMN public.bars.slug IS 'Unique URL-friendly identifier';
COMMENT ON COLUMN public.bars.location IS 'Geographic point (PostGIS)';
COMMENT ON COLUMN public.bars.lat IS 'Latitude coordinate';
COMMENT ON COLUMN public.bars.lng IS 'Longitude coordinate';

COMMIT;
