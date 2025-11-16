-- =====================================================
-- PHASE 1: BARS TABLE DATA MIGRATION (Records 1-25)
-- Generated: 2025-11-12 21:00 UTC
-- Description: First batch of 25 bars records
-- =====================================================

BEGIN;

-- Insert bars data (batch 1 of 4)
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
