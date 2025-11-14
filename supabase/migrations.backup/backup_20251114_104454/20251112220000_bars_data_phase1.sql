-- =====================================================
-- PHASE 1: BARS TABLE DATA MIGRATION (Records 1-100)
-- Generated: 2025-11-12 22:00:00 UTC
-- =====================================================

BEGIN;

-- Insert first 100 bars records
INSERT INTO public.bars (name, location_text, country, city_area, currency, slug, is_active, created_at, updated_at)
VALUES
  ('Paranga', 'Paranga, InterContinental Beach Club, InterContinental Malta, St. George''s Bay, St Julian''s STJ 3310, Malta', 'Malta', 'St Julian''s', 'EUR', 'paranga', true, NOW(), NOW()),
  ('Le Bistro', 'Radisson Blu Resort, St. Julian''s, St Julian''s STJ 3391, Malta', 'Malta', 'St Julian''s', 'EUR', 'le-bistro', true, NOW(), NOW()),
  ('Bahamas Pub', 'KG 18 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'bahamas-pub', true, NOW(), NOW()),
  ('Seaside Kiosk', 'Triq It - Trunciera, San Pawl il-Baħar, Malta', 'Malta', 'San Pawl il-Baħar', 'EUR', 'seaside-kiosk', true, NOW(), NOW()),
  ('Felice Brasserie', 'Triq Ix - Xatt, Tas-Sliema SLM 1171, Malta', 'Malta', 'Tas-Sliema', 'EUR', 'felice-brasserie', true, NOW(), NOW()),
  ('Little Argentina', '210, Tower Road Sliema, Tas-Sliema SLM 1602, Malta', 'Malta', 'Tas-Sliema', 'EUR', 'little-argentina', true, NOW(), NOW()),
  ('Caviar & Bull', 'Corinthia Hotel St. George''s Bay San Ġiljan, St Julian''s STJ 3301, Malta', 'Malta', 'St Julian''s', 'EUR', 'caviar-bull', true, NOW(), NOW()),
  ('Inzozi Africa House B&B', '15 KG 3 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'inzozi-africa-house-bb', true, NOW(), NOW()),
  ('Intercontinental Beach Bar', 'St Julian''s, Malta', 'Malta', 'St Julian''s', 'EUR', 'intercontinental-beach-bar', true, NOW(), NOW()),
  ('Paul''s Bistro', '91 Triq San Gwann Il-Belt Valletta, Il-Belt Valletta VLT 1165, Malta', 'Malta', 'Valletta', 'EUR', 'pauls-bistro', true, NOW(), NOW()),
  ('The SkySports Lounge', 'KG 218 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'the-skysports-lounge', true, NOW(), NOW()),
  ('Malta Chocolate Factory', '179 Triq Sant'' Antnin Street, San Pawl il-Baħar SPB 2658, Malta', 'Malta', 'San Pawl il-Baħar', 'EUR', 'malta-chocolate-factory', true, NOW(), NOW()),
  ('Peppi''s Restaurant', 'Tower Road, Sliema, Malta', 'Malta', 'Sliema', 'EUR', 'peppis-restaurant', true, NOW(), NOW()),
  ('Tavio''s Pepe Nero', 'Trejqet il-Veccja San Pawl il-Baħar, San Pawl il-Baħar SPB 3630, Malta', 'Malta', 'San Pawl il-Baħar', 'EUR', 'tavios-pepe-nero', true, NOW(), NOW()),
  ('The Green Lounge Bar & Restaurant', 'Kicukiro Sonatube, SilverBack Mall Rooftop, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'the-green-lounge-bar-restaurant', true, NOW(), NOW()),
  ('Tiffany Lounge Restaurant', 'Portomaso Marina, Level -3, St. Julians, St Julian''s, Malta', 'Malta', 'St Julian''s', 'EUR', 'tiffany-lounge-restaurant', true, NOW(), NOW()),
  ('Hugo''s Terrace & Rooftop', 'Triq Dragunara, San Ġiljan, Malta', 'Malta', 'San Ġiljan', 'EUR', 'hugos-terrace-rooftop', true, NOW(), NOW()),
  ('Barracuda Restaurant', '194 Main Street, St Julian''s, Malta', 'Malta', 'St Julian''s', 'EUR', 'barracuda-restaurant', true, NOW(), NOW()),
  ('Exiles', 'Exiles Bay, Sliema, Malta', 'Malta', 'Sliema', 'EUR', 'exiles', true, NOW(), NOW()),
  ('B Flex Bar', '11 KK 21 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'b-flex-bar', true, NOW(), NOW()),
  ('Barracuda Rooftop Lounge', 'Barracuda Building, 16 Triq Censu Tabone, Ballluta Bay, St Julian''s STJ1218, Malta', 'Malta', 'St Julian''s', 'EUR', 'barracuda-rooftop-lounge', true, NOW(), NOW()),
  ('Riders Lounge Kigali', 'KG 7 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'riders-lounge-kigali', true, NOW(), NOW()),
  ('The Brigantine Lounge Bar', 'Ramla Bay Resort, Triq Ir-Ramla, Mellieħa MLH 7100, Malta', 'Malta', 'Mellieħa', 'EUR', 'the-brigantine-lounge-bar', true, NOW(), NOW()),
  ('Henry J. Bean''s', 'ix-Xatt Ta'' San Ġorġ, San Ġiljan STJ3301, Malta', 'Malta', 'San Ġiljan', 'EUR', 'henry-j-beans', true, NOW(), NOW()),
  ('Kigali Diplomat Hotel', '2 KG 566 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'kigali-diplomat-hotel', true, NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;

COMMIT;
