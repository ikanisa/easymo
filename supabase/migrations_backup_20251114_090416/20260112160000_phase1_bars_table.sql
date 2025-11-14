-- =====================================================
-- PHASE 1: BARS TABLE CREATION AND DATA INSERTION
-- Migration: 20260112160000_phase1_bars_table.sql
-- Generated: 2025-11-12 16:50:42 UTC
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

-- 2. Enable RLS on bars table
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies for bars table
CREATE POLICY "bars_public_read" ON public.bars
    FOR SELECT
    USING (is_active = true);

CREATE POLICY "bars_service_role_all" ON public.bars
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 4. Create updated_at trigger
CREATE TRIGGER update_bars_updated_at
    BEFORE UPDATE ON public.bars
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Insert data into the 'bars' table (Part 1 of 4 - First 100 records)
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
  ('The Green Lounge Bar & Restaurant', 'Kicukiro Sonatube, SilverBack Mall Rooftop, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'the-green-lounge-bar-restaurant'),
  ('Tiffany Lounge Restaurant', 'Portomaso Marina, Level -3, St. Julians, St Julian''s, Malta', 'Malta', 'St Julian''s', 'EUR', 'tiffany-lounge-restaurant'),
  ('Hugo''s Terrace & Rooftop', 'Triq Dragunara, San Ġiljan, Malta', 'Malta', 'San Ġiljan', 'EUR', 'hugos-terrace-rooftop'),
  ('Barracuda Restaurant', '194 Main Street, St Julian''s, Malta', 'Malta', 'St Julian''s', 'EUR', 'barracuda-restaurant'),
  ('Exiles', 'Exiles Bay, Sliema, Malta', 'Malta', 'Sliema', 'EUR', 'exiles'),
  ('B Flex Bar', '11 KK 21 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'b-flex-bar'),
  ('Barracuda Rooftop Lounge', 'Barracuda Building, 16 Triq Censu Tabone, Ballluta Bay, St Julian''s STJ1218, Malta', 'Malta', 'St Julian''s', 'EUR', 'barracuda-rooftop-lounge'),
  ('Riders Lounge Kigali', 'KG 7 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'riders-lounge-kigali'),
  ('The Brigantine Lounge Bar', 'Ramla Bay Resort, Triq Ir-Ramla, Mellieħa MLH 7100, Malta', 'Malta', 'Mellieħa', 'EUR', 'the-brigantine-lounge-bar'),
  ('Henry J. Bean''s', 'ix-Xatt Ta'' San Ġorġ, San Ġiljan STJ3301, Malta', 'Malta', 'San Ġiljan', 'EUR', 'henry-j-beans'),
  ('Kigali Diplomat Hotel', '2 KG 566 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'kigali-diplomat-hotel')
ON CONFLICT (slug) DO NOTHING;

COMMIT;
