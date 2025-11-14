-- =====================================================
-- PHASE 1: Bars Table Creation
-- Purpose: Create the bars table structure with all columns
-- =====================================================

BEGIN;

-- Enable PostGIS if not already enabled (needed for geography columns)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create the bars table
CREATE TABLE IF NOT EXISTS public.bars (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL,
    name text NOT NULL,
    location_text text,
    country text,
    city_area text,
    currency text,
    momo_code text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT bars_slug_key UNIQUE (slug)
);

-- Add comment
COMMENT ON TABLE public.bars IS 'Stores bar and restaurant information for the EasyMO platform';

-- Enable RLS
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "bars_public_read" ON public.bars
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "bars_service_role_all" ON public.bars
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.bars TO authenticated, anon;
GRANT ALL ON public.bars TO service_role;

COMMIT;
