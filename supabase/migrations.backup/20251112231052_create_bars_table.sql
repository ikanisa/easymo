-- Migration: Create and populate bars table
-- Date: 2025-11-12
-- Description: Creates bars table with proper schema and inserts bar data

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

-- 2. Add RLS policies
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;

-- Public read access for active bars
CREATE POLICY "bars_public_read" ON public.bars
  FOR SELECT
  USING (is_active = true);

-- Service role full access
CREATE POLICY "bars_service_role_all" ON public.bars
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Add updated_at trigger
CREATE OR REPLACE FUNCTION public.update_bars_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_bars_updated_at
  BEFORE UPDATE ON public.bars
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bars_updated_at();

-- 4. Insert bar data (first 50 records - Phase 1)
INSERT INTO public.bars (name, location_text, country, city_area, currency, slug)
VALUES
  ('Paranga', 'Paranga, InterContinental Beach Club, InterContinental Malta, St. George''s Bay, St Julian''s STJ 3310, Malta', 'Malta', 'St Julian''s', 'EUR', 'paranga'),
  ('Le Bistro', 'Radisson Blu Resort, St. Julian''s, St Julian''s STJ 3391, Malta', 'Malta', 'St Julian''s', 'EUR', 'le-bistro'),
  ('Bahamas Pub', 'KG 18 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'bahamas-pub'),
  ('Seaside Kiosk', 'Triq It - Trunciera, San Pawl il-Baħar, Malta', 'Malta', 'San Pawl il-Baħar', 'EUR', 'seaside-kiosk'),
  ('Felice Brasserie', 'Triq Ix - Xatt, Tas-Sliema SLM 1171, Malta', 'Malta', 'Tas-Sliema', 'EUR', 'felice-brasserie')
ON CONFLICT (slug) DO NOTHING;

COMMIT;
