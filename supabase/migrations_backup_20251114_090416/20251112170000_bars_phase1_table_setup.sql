-- =====================================================
-- PHASE 1: BARS TABLE SETUP
-- Migration: 20251112170000_bars_phase1_table_setup.sql
-- Purpose: Create bars table with PostGIS support
-- =====================================================

BEGIN;

-- Ensure PostGIS is enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create the bars table
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bars_slug ON public.bars(slug);
CREATE INDEX IF NOT EXISTS idx_bars_is_active ON public.bars(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_bars_country ON public.bars(country);
CREATE INDEX IF NOT EXISTS idx_bars_location ON public.bars USING GIST(location);

-- Enable RLS
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Public read access to bars" ON public.bars;
CREATE POLICY "Public read access to bars" 
    ON public.bars 
    FOR SELECT 
    TO authenticated, anon
    USING (is_active = true);

DROP POLICY IF EXISTS "Service role full access to bars" ON public.bars;
CREATE POLICY "Service role full access to bars" 
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

DROP TRIGGER IF EXISTS update_bars_updated_at ON public.bars;
CREATE TRIGGER update_bars_updated_at
    BEFORE UPDATE ON public.bars
    FOR EACH ROW
    EXECUTE FUNCTION public.update_bars_updated_at();

COMMIT;
