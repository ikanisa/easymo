-- Migration script to create and populate the 'bars' table.
-- Generated at: 2025-11-12 16:50:42 UTC

BEGIN;

-- 1. Create the 'bars' table with lat and lng columns
CREATE TABLE IF NOT EXISTS public.bars (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL,
    name text NOT NULL,
    location_text text,
    country text,
    city_area text,
    currency text,
    momo_code text,
    lat double precision,
    lng double precision,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT bars_slug_key UNIQUE (slug)
);

-- Add indexes for geospatial queries
CREATE INDEX IF NOT EXISTS idx_bars_lat_lng ON public.bars(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bars_country_city ON public.bars(country, city_area);
CREATE INDEX IF NOT EXISTS idx_bars_active ON public.bars(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow public read access to active bars
CREATE POLICY "Anyone can read active bars"
  ON public.bars
  FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

-- Service role has full access
CREATE POLICY "Service role can manage bars"
  ON public.bars
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Insert data into the 'bars' table
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
  ('Paul''s Bistro', '91 Triq San Gwann Il-Belt Valletta, Il-Belt Valletta VLT 1165, Malta', 'Malta', 'Valletta', 'EUR', 'pauls-bistro'),
  ('The SkySports Lounge', 'KG 218 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'the-skysports-lounge'),
  ('Malta Chocolate Factory', '179 Triq Sant'' Antnin Street, San Pawl il-Baħar SPB 2658, Malta', 'Malta', 'San Pawl il-Baħar', 'EUR', 'malta-chocolate-factory'),
  ('Peppi''s Restaurant', 'Tower Road, Sliema, Malta', 'Malta', 'Sliema', 'EUR', 'peppis-restaurant'),
  ('Tavio''s Pepe Nero', 'Trejqet il-Veccja San Pawl il-Baħar, San Pawl il-Baħar SPB 3630, Malta', 'Malta', 'San Pawl il-Baħar', 'EUR', 'tavios-pepe-nero'),
  ('The Green Lounge Bar & Restaurant', 'Kicukiro Sonatube, SilverBack Mall Rooftop, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'the-green-lounge-bar-restaurant')
ON CONFLICT (slug) DO NOTHING;

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_bars_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_bars_updated_at
  BEFORE UPDATE ON public.bars
  FOR EACH ROW
  EXECUTE FUNCTION update_bars_updated_at();

COMMIT;
