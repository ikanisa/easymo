-- =====================================================
-- BARS MIGRATION - PHASE 1: Table Structure & Extensions
-- =====================================================
-- This phase creates the bars table with proper structure
-- Date: 2025-11-12
-- Description: Initial bars table with geography support

BEGIN;

-- Enable PostGIS if not already enabled (idempotent)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Drop existing bars table if it exists (clean slate)
DROP TABLE IF EXISTS public.bars CASCADE;

-- Create the bars table with proper structure
CREATE TABLE public.bars (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
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
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX idx_bars_slug ON public.bars(slug);
CREATE INDEX idx_bars_country ON public.bars(country);
CREATE INDEX idx_bars_city_area ON public.bars(city_area);
CREATE INDEX idx_bars_is_active ON public.bars(is_active) WHERE is_active = true;
CREATE INDEX idx_bars_location ON public.bars USING GIST(location) WHERE location IS NOT NULL;

-- Enable RLS
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can read active bars"
    ON public.bars
    FOR SELECT
    TO authenticated, anon
    USING (is_active = true);

CREATE POLICY "Service role full access"
    ON public.bars
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_bars_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_bars_updated_at
    BEFORE UPDATE ON public.bars
    FOR EACH ROW
    EXECUTE FUNCTION update_bars_updated_at();

-- Add comments
COMMENT ON TABLE public.bars IS 'Bars and restaurants with geographic location support';
COMMENT ON COLUMN public.bars.location IS 'Geographic point (PostGIS) for spatial queries';
COMMENT ON COLUMN public.bars.slug IS 'URL-friendly unique identifier';

COMMIT;
