-- =====================================================
-- BARS TABLE MIGRATION - PHASE 1: CREATE TABLE
-- Generated: 2025-11-12 16:50:42 UTC
-- Purpose: Create bars table structure with proper schema
-- =====================================================

BEGIN;

-- Enable PostGIS extension if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Drop existing table if it exists to start fresh
DROP TABLE IF EXISTS public.bars CASCADE;

-- Create the 'bars' table with complete schema
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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bars_slug ON public.bars(slug);
CREATE INDEX IF NOT EXISTS idx_bars_country ON public.bars(country);
CREATE INDEX IF NOT EXISTS idx_bars_is_active ON public.bars(is_active);
CREATE INDEX IF NOT EXISTS idx_bars_location ON public.bars USING GIST(location);

-- Add comments for documentation
COMMENT ON TABLE public.bars IS 'Stores bar and restaurant information with location data';
COMMENT ON COLUMN public.bars.location IS 'Geographic point data using SRID 4326 for GPS coordinates';
COMMENT ON COLUMN public.bars.slug IS 'URL-friendly unique identifier';

-- Enable Row Level Security
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Allow public read access to active bars
CREATE POLICY "bars_public_read" 
    ON public.bars 
    FOR SELECT 
    USING (is_active = true);

-- Allow service role full access
CREATE POLICY "bars_service_full_access" 
    ON public.bars 
    FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.bars TO anon, authenticated;
GRANT ALL ON public.bars TO service_role;

COMMIT;
