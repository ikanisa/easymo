-- Enable the PostGIS extension if it's not already enabled.
-- This is required for the 'geography' type.
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create the 'business' table
-- This schema supports geospatial queries for businesses
CREATE TABLE IF NOT EXISTS public.business (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_whatsapp text NULL,
    name text NOT NULL,
    description text NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    category_id text NULL,
    catalog_url text NULL,
    location_text text NULL,
    lat float8 NULL,
    lng float8 NULL,
    owner_user_id uuid NULL,
    -- The location column stores the geographic point data.
    -- SRID 4326 is the standard for GPS coordinates (WGS 84).
    location geography(Point, 4326) NULL,
    status text NULL DEFAULT 'active'
);

-- Comments to explain table choices
COMMENT ON COLUMN public.business.location IS 'Stores the geographical point data for the business, using SRID 4326 for GPS coordinates.';
COMMENT ON COLUMN public.business.id IS 'Primary key, a universally unique identifier for each business.';
COMMENT ON COLUMN public.business.created_at IS 'Timestamp automatically recording when the business was added.';

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_business_location ON public.business USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_business_category ON public.business(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_business_active ON public.business(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_business_owner_whatsapp ON public.business(owner_whatsapp) WHERE owner_whatsapp IS NOT NULL;

-- NOTE: Full business data (1183 records) should be loaded separately via a data import script
-- This migration only creates the table structure
