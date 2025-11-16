-- Enable the PostGIS extension if it's not already enabled.
-- This is required for the 'geography' type.
-- Phase 2: Business Table Creation

BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;

-- Drop the table if it exists to start fresh (optional, use with caution)
-- DROP TABLE IF EXISTS public.business;

-- Create the 'business' table
-- This schema is based on your column specifications.
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

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_business_owner_whatsapp ON public.business(owner_whatsapp);
CREATE INDEX IF NOT EXISTS idx_business_category ON public.business(category_id);
CREATE INDEX IF NOT EXISTS idx_business_is_active ON public.business(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_business_status ON public.business(status);
CREATE INDEX IF NOT EXISTS idx_business_location ON public.business USING GIST(location);

-- Enable RLS
ALTER TABLE public.business ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can read active businesses"
  ON public.business
  FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

CREATE POLICY "Users can manage their own businesses"
  ON public.business
  FOR ALL
  TO authenticated
  USING (owner_whatsapp = auth.jwt()->>'phone' OR owner_user_id = auth.uid())
  WITH CHECK (owner_whatsapp = auth.jwt()->>'phone' OR owner_user_id = auth.uid());

CREATE POLICY "Service role can manage all businesses"
  ON public.business
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comments to explain table choices
COMMENT ON COLUMN public.business.location IS 'Stores the geographical point data for the business, using SRID 4326 for GPS coordinates.';
COMMENT ON COLUMN public.business.id IS 'Primary key, a universally unique identifier for each business.';
COMMENT ON COLUMN public.business.created_at IS 'Timestamp automatically recording when the business was added.';

COMMIT;
