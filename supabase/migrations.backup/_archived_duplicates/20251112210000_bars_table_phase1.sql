-- =====================================================
-- PHASE 1: Bars Table Creation and Data Migration
-- Generated: 2025-11-12 21:00 UTC
-- Description: Create bars table with proper schema and insert data
-- =====================================================

BEGIN;

-- 1. Create the 'bars' table with geography support
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
CREATE INDEX IF NOT EXISTS idx_bars_country ON public.bars(country);
CREATE INDEX IF NOT EXISTS idx_bars_city_area ON public.bars(city_area);
CREATE INDEX IF NOT EXISTS idx_bars_location ON public.bars USING GIST (location) WHERE location IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bars_active ON public.bars(is_active) WHERE is_active = true;

-- 3. Enable RLS
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies
DROP POLICY IF EXISTS "bars_public_read" ON public.bars;
CREATE POLICY "bars_public_read" ON public.bars
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "bars_service_role_all" ON public.bars;
CREATE POLICY "bars_service_role_all" ON public.bars
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 5. Create updated_at trigger
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

COMMIT;
