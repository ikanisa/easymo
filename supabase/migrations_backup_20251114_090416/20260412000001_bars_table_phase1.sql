-- =====================================================
-- PHASE 1: BARS TABLE DEPLOYMENT
-- Migration script to create and populate the 'bars' table.
-- Generated at: 2025-11-12 16:50:42 UTC
-- =====================================================

BEGIN;

-- 1. Create the 'bars' table
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

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bars_slug ON public.bars(slug);
CREATE INDEX IF NOT EXISTS idx_bars_active ON public.bars(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_bars_country_city ON public.bars(country, city_area);

-- 3. Enable RLS
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies
DROP POLICY IF EXISTS "bars_read_all" ON public.bars;
CREATE POLICY "bars_read_all" 
  ON public.bars 
  FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "bars_service_role_full_access" ON public.bars;
CREATE POLICY "bars_service_role_full_access" 
  ON public.bars 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- 5. Grant permissions
GRANT SELECT ON public.bars TO authenticated, anon;
GRANT ALL ON public.bars TO service_role;

-- 6. Add updated_at trigger
CREATE TRIGGER set_bars_updated_at 
  BEFORE UPDATE ON public.bars
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
