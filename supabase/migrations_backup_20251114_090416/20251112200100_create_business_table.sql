-- Migration: Create and populate business table
-- Date: 2025-11-12
-- Description: Creates business table with geography support for location data

BEGIN;

-- 1. Create the 'business' table
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
    location geography(Point, 4326) NULL,
    status text NULL DEFAULT 'active'
);

-- 2. Add comments
COMMENT ON COLUMN public.business.location IS 'Stores the geographical point data for the business, using SRID 4326 for GPS coordinates.';
COMMENT ON COLUMN public.business.id IS 'Primary key, a universally unique identifier for each business.';
COMMENT ON COLUMN public.business.created_at IS 'Timestamp automatically recording when the business was added.';

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_business_name ON public.business(name);
CREATE INDEX IF NOT EXISTS idx_business_category ON public.business(category_id);
CREATE INDEX IF NOT EXISTS idx_business_owner_whatsapp ON public.business(owner_whatsapp);
CREATE INDEX IF NOT EXISTS idx_business_is_active ON public.business(is_active);
CREATE INDEX IF NOT EXISTS idx_business_location ON public.business USING GIST(location);

-- 4. Enable RLS
ALTER TABLE public.business ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies
CREATE POLICY "Businesses are viewable by everyone"
  ON public.business FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Users can insert their own businesses"
  ON public.business FOR INSERT
  TO authenticated
  WITH CHECK (owner_whatsapp = (auth.jwt()->>'phone'));

CREATE POLICY "Users can update their own businesses"
  ON public.business FOR UPDATE
  TO authenticated
  USING (owner_whatsapp = (auth.jwt()->>'phone'));

CREATE POLICY "Service role can manage all businesses"
  ON public.business FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 6. Create function to clean duplicates
CREATE OR REPLACE FUNCTION public.clean_business_duplicates()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Keep only the oldest record for each name+location_text combination
  DELETE FROM public.business
  WHERE id NOT IN (
    SELECT DISTINCT ON (LOWER(name), LOWER(COALESCE(location_text, ''))) id
    FROM public.business
    ORDER BY LOWER(name), LOWER(COALESCE(location_text, '')), created_at ASC
  );
END;
$$;

COMMIT;
