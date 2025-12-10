-- =====================================================
-- PHASE 1: Bars Table Structure & Core Setup
-- Migration: 20260501000000_bars_phase1_table_structure.sql
-- Purpose: Create bars table with proper structure, add lat/lng columns
-- =====================================================

BEGIN;

-- Enable PostGIS if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create the bars table with complete structure
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
    
    -- Geographic coordinates
    lat double precision,
    lng double precision,
    location geography(POINT, 4326),
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bars_slug ON public.bars(slug);
CREATE INDEX IF NOT EXISTS idx_bars_name ON public.bars(name);
CREATE INDEX IF NOT EXISTS idx_bars_location ON public.bars USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_bars_country_city ON public.bars(country, city_area);
CREATE INDEX IF NOT EXISTS idx_bars_is_active ON public.bars(is_active) WHERE is_active = true;

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

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.bars_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS bars_updated_at_trigger ON public.bars;
CREATE TRIGGER bars_updated_at_trigger
    BEFORE UPDATE ON public.bars
    FOR EACH ROW
    EXECUTE FUNCTION public.bars_update_updated_at();

-- Function to sync location geography from lat/lng
CREATE OR REPLACE FUNCTION public.bars_sync_location()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
        NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-sync location
DROP TRIGGER IF EXISTS bars_sync_location_trigger ON public.bars;
CREATE TRIGGER bars_sync_location_trigger
    BEFORE INSERT OR UPDATE OF lat, lng ON public.bars
    FOR EACH ROW
    EXECUTE FUNCTION public.bars_sync_location();

COMMIT;
