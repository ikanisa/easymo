-- =====================================================
-- BARS MIGRATION - PHASE 1: Table Creation
-- Generated at: 2025-11-12 16:50:42 UTC
-- Description: Creates the bars table structure with all columns
-- =====================================================

BEGIN;

-- 1. Create the 'bars' table with all required columns
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

-- 2. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_bars_slug ON public.bars(slug);
CREATE INDEX IF NOT EXISTS idx_bars_name ON public.bars(name);
CREATE INDEX IF NOT EXISTS idx_bars_country ON public.bars(country);
CREATE INDEX IF NOT EXISTS idx_bars_is_active ON public.bars(is_active);

-- 3. Add updated_at trigger
CREATE OR REPLACE FUNCTION public.update_bars_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_bars_updated_at ON public.bars;
CREATE TRIGGER trigger_update_bars_updated_at
  BEFORE UPDATE ON public.bars
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bars_updated_at();

-- 4. Enable RLS
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;

-- 5. Add RLS policies
DROP POLICY IF EXISTS "Anyone can read active bars" ON public.bars;
CREATE POLICY "Anyone can read active bars"
  ON public.bars
  FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

DROP POLICY IF EXISTS "Service role can manage all bars" ON public.bars;
CREATE POLICY "Service role can manage all bars"
  ON public.bars
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 6. Add comment
COMMENT ON TABLE public.bars IS 'Stores bar and restaurant information with location data';

COMMIT;
