-- =====================================================
-- PHASE 1: Bars Table Setup with PostGIS
-- =====================================================
-- Purpose: Create bars table with geographic support
-- Dependencies: PostGIS extension must be enabled
-- =====================================================

BEGIN;

-- Enable PostGIS if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create bars table with all necessary columns
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
    
    -- Geographic data
    lat double precision,
    lng double precision,
    location geography(POINT, 4326),
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT bars_slug_key UNIQUE (slug),
    CONSTRAINT valid_coordinates CHECK (
        (lat IS NULL AND lng IS NULL) OR 
        (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180)
    )
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_bars_slug ON public.bars(slug);
CREATE INDEX IF NOT EXISTS idx_bars_active ON public.bars(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_bars_country_city ON public.bars(country, city_area);
CREATE INDEX IF NOT EXISTS idx_bars_location ON public.bars USING GIST(location) WHERE location IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bars_coords ON public.bars(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Enable RLS
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;

-- RLS Policies
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

-- Function to update geography from lat/lng
CREATE OR REPLACE FUNCTION public.update_bars_location()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
        NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update location
DROP TRIGGER IF EXISTS trg_bars_update_location ON public.bars;
CREATE TRIGGER trg_bars_update_location
    BEFORE INSERT OR UPDATE OF lat, lng ON public.bars
    FOR EACH ROW
    EXECUTE FUNCTION public.update_bars_location();

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_bars_updated_at ON public.bars;
CREATE TRIGGER trg_bars_updated_at
    BEFORE UPDATE ON public.bars
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
