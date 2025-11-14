-- =====================================================
-- PHASE 1: BARS TABLE CREATION AND DATA MIGRATION
-- Generated: 2025-11-12 22:00:00 UTC
-- Description: Create bars table and populate with bar data
-- =====================================================

BEGIN;

-- 1. Create the 'bars' table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.bars (
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

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bars_slug ON public.bars(slug);
CREATE INDEX IF NOT EXISTS idx_bars_name ON public.bars(name);
CREATE INDEX IF NOT EXISTS idx_bars_country ON public.bars(country);
CREATE INDEX IF NOT EXISTS idx_bars_city_area ON public.bars(city_area);
CREATE INDEX IF NOT EXISTS idx_bars_location ON public.bars USING GIST(location) WHERE location IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bars_is_active ON public.bars(is_active) WHERE is_active = true;

-- 3. Enable RLS
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies
DROP POLICY IF EXISTS "Public read access to active bars" ON public.bars;
CREATE POLICY "Public read access to active bars"
    ON public.bars
    FOR SELECT
    TO anon, authenticated
    USING (is_active = true);

DROP POLICY IF EXISTS "Service role full access to bars" ON public.bars;
CREATE POLICY "Service role full access to bars"
    ON public.bars
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 5. Add updated_at trigger
CREATE OR REPLACE FUNCTION public.update_bars_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_bars_updated_at ON public.bars;
CREATE TRIGGER set_bars_updated_at
    BEFORE UPDATE ON public.bars
    FOR EACH ROW
    EXECUTE FUNCTION public.update_bars_updated_at();

-- 6. Insert bar data (with deduplication)
INSERT INTO public.bars (name, location_text, country, city_area, currency, slug)
VALUES
  ('Paranga', 'Paranga, InterContinental Beach Club, InterContinental Malta, St. George''s Bay, St Julian''s STJ 3310, Malta', 'Malta', 'St Julian''s', 'EUR', 'paranga'),
  ('Le Bistro', 'Radisson Blu Resort, St. Julian''s, St Julian''s STJ 3391, Malta', 'Malta', 'St Julian''s', 'EUR', 'le-bistro'),
  ('Bahamas Pub', 'KG 18 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'bahamas-pub'),
  ('Seaside Kiosk', 'Triq It - Trunciera, San Pawl il-Baħar, Malta', 'Malta', 'San Pawl il-Baħar', 'EUR', 'seaside-kiosk'),
  ('Felice Brasserie', 'Triq Ix - Xatt, Tas-Sliema SLM 1171, Malta', 'Malta', 'Tas-Sliema', 'EUR', 'felice-brasserie'),
  ('Little Argentina', '210, Tower Road Sliema, Tas-Sliema SLM 1602, Malta', 'Malta', 'Tas-Sliema', 'EUR', 'little-argentina'),
  ('Caviar & Bull', 'Corinthia Hotel St. George''s Bay San Ġiljan, St Julian''s STJ 3301, Malta', 'Malta', 'St Julian''s', 'EUR', 'caviar-bull'),
  ('Inzozi Africa House B&B', '15 KG 3 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'inzozi-africa-house-bb'),
  ('Intercontinental Beach Bar', 'St Julian''s, Malta', 'Malta', 'St Julian''s', 'EUR', 'intercontinental-beach-bar'),
  ('Paul''s Bistro', '91 Triq San Gwann Il-Belt Valletta, Il-Belt Valletta VLT 1165, Malta', 'Malta', 'Valletta', 'EUR', 'pauls-bistro')
ON CONFLICT (slug) DO NOTHING;

COMMIT;
