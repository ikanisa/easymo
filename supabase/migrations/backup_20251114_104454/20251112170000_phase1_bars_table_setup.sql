-- =====================================================
-- PHASE 1: Bars Table Setup & Data Migration
-- Generated: 2025-11-12 17:00:00 UTC
-- Description: Create bars table with PostGIS support and insert initial data
-- =====================================================

BEGIN;

-- Enable PostGIS extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Drop existing bars table if it exists (for clean slate)
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
    is_active boolean NOT NULL DEFAULT true,
    lat double precision,
    lng double precision,
    location geography(POINT, 4326),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_bars_slug ON public.bars(slug);
CREATE INDEX idx_bars_name ON public.bars(name);
CREATE INDEX idx_bars_country ON public.bars(country);
CREATE INDEX idx_bars_is_active ON public.bars(is_active) WHERE is_active = true;
CREATE INDEX idx_bars_location ON public.bars USING GIST(location);

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

-- Enable RLS
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public read access for active bars"
    ON public.bars
    FOR SELECT
    USING (is_active = true);

CREATE POLICY "Service role full access"
    ON public.bars
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.bars TO anon, authenticated;
GRANT ALL ON public.bars TO service_role;

-- Add comment
COMMENT ON TABLE public.bars IS 'Bars and restaurants database with geographic location support';

COMMIT;
