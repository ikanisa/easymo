-- =====================================================
-- PHASE 1: Bars Table Setup with Deduplication
-- Migration: 20260112160000_phase1_bars_table_setup.sql
-- Purpose: Create bars table structure with lat/lng support
-- =====================================================

BEGIN;

-- 1. Create the 'bars' table with lat/lng columns
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
CREATE INDEX IF NOT EXISTS idx_bars_location ON public.bars USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_bars_lat_lng ON public.bars (lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bars_slug ON public.bars (slug);
CREATE INDEX IF NOT EXISTS idx_bars_country_city ON public.bars (country, city_area);
CREATE INDEX IF NOT EXISTS idx_bars_active ON public.bars (is_active) WHERE is_active = true;

-- 3. Enable RLS
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "bars_read_all" ON public.bars;
CREATE POLICY "bars_read_all" 
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

-- 5. Create updated_at trigger
DROP TRIGGER IF EXISTS set_bars_updated_at ON public.bars;
CREATE TRIGGER set_bars_updated_at
    BEFORE UPDATE ON public.bars
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.bars IS 'Bars and restaurants with geographic location support';
COMMENT ON COLUMN public.bars.location IS 'PostGIS geography point for spatial queries';
COMMENT ON COLUMN public.bars.lat IS 'Latitude extracted from Google Maps URL';
COMMENT ON COLUMN public.bars.lng IS 'Longitude extracted from Google Maps URL';

COMMIT;
