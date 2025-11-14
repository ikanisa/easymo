-- Migration: Bars Table - Phase 1 (Bars 1-30)
-- Date: 2025-11-12
-- Description: First batch of 30 bars with location data

BEGIN;

-- Insert Phase 1 bars (1-30)
INSERT INTO public.bars (name, location_text, country, city_area, currency, slug, momo_code, is_active)
VALUES
  ('Paranga', 'Paranga, InterContinental Beach Club, InterContinental Malta, St. George''s Bay, St Julian''s STJ 3310, Malta', 'Malta', 'St Julian''s', 'EUR', 'paranga', NULL, true),
  ('Le Bistro', 'Radisson Blu Resort, St. Julian''s, St Julian''s STJ 3391, Malta', 'Malta', 'St Julian''s', 'EUR', 'le-bistro', NULL, true),
  ('Bahamas Pub', 'KG 18 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'bahamas-pub', NULL, true),
  ('Seaside Kiosk', 'Triq It - Trunciera, San Pawl il-Baħar, Malta', 'Malta', 'San Pawl il-Baħar', 'EUR', 'seaside-kiosk', NULL, true),
  ('Felice Brasserie', 'Triq Ix - Xatt, Tas-Sliema SLM 1171, Malta', 'Malta', 'Tas-Sliema', 'EUR', 'felice-brasserie', NULL, true),
  ('Little Argentina', '210, Tower Road Sliema, Tas-Sliema SLM 1602, Malta', 'Malta', 'Tas-Sliema', 'EUR', 'little-argentina', NULL, true),
  ('Caviar & Bull', 'Corinthia Hotel St. George''s Bay San Ġiljan, St Julian''s STJ 3301, Malta', 'Malta', 'St Julian''s', 'EUR', 'caviar-bull', NULL, true),
  ('Inzozi Africa House B&B', '15 KG 3 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'inzozi-africa-house-bb', NULL, true),
  ('Intercontinental Beach Bar', 'St Julian''s, Malta', 'Malta', 'St Julian''s', 'EUR', 'intercontinental-beach-bar', NULL, true),
  ('Paul''s Bistro', '91 Triq San Gwann Il-Belt Valletta, Il-Belt Valletta VLT 1165, Malta', 'Malta', 'Valletta', 'EUR', 'pauls-bistro', NULL, true),
  ('The SkySports Lounge', 'KG 218 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'the-skysports-lounge', NULL, true),
  ('Malta Chocolate Factory', '179 Triq Sant'' Antnin Street, San Pawl il-Baħar SPB 2658, Malta', 'Malta', 'San Pawl il-Baħar', 'EUR', 'malta-chocolate-factory', NULL, true),
  ('Peppi''s Restaurant', 'Tower Road, Sliema, Malta', 'Malta', 'Sliema', 'EUR', 'peppis-restaurant', NULL, true),
  ('Tavio''s Pepe Nero', 'Trejqet il-Veccja San Pawl il-Baħar, San Pawl il-Baħar SPB 3630, Malta', 'Malta', 'San Pawl il-Baħar', 'EUR', 'tavios-pepe-nero', NULL, true),
  ('The Green Lounge Bar & Restaurant', 'Kicukiro Sonatube, SilverBack Mall Rooftop, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'the-green-lounge-bar-restaurant', NULL, true),
  ('Tiffany Lounge Restaurant', 'Portomaso Marina, Level -3, St. Julians, St Julian''s, Malta', 'Malta', 'St Julian''s', 'EUR', 'tiffany-lounge-restaurant', NULL, true),
  ('Hugo''s Terrace & Rooftop', 'Triq Dragunara, San Ġiljan, Malta', 'Malta', 'San Ġiljan', 'EUR', 'hugos-terrace-rooftop', NULL, true),
  ('Barracuda Restaurant', '194 Main Street, St Julian''s, Malta', 'Malta', 'St Julian''s', 'EUR', 'barracuda-restaurant', NULL, true),
  ('Exiles', 'Exiles Bay, Sliema, Malta', 'Malta', 'Sliema', 'EUR', 'exiles', NULL, true),
  ('B Flex Bar', '11 KK 21 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'b-flex-bar', NULL, true),
  ('Barracuda Rooftop Lounge', 'Barracuda Building, 16 Triq Censu Tabone, Ballluta Bay, St Julian''s STJ1218, Malta', 'Malta', 'St Julian''s', 'EUR', 'barracuda-rooftop-lounge', NULL, true),
  ('Riders Lounge Kigali', 'KG 7 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'riders-lounge-kigali', NULL, true),
  ('The Brigantine Lounge Bar', 'Ramla Bay Resort, Triq Ir-Ramla, Mellieħa MLH 7100, Malta', 'Malta', 'Mellieħa', 'EUR', 'the-brigantine-lounge-bar', NULL, true),
  ('Henry J. Bean''s', 'ix-Xatt Ta'' San Ġorġ, San Ġiljan STJ3301, Malta', 'Malta', 'San Ġiljan', 'EUR', 'henry-j-beans', NULL, true),
  ('Kigali Diplomat Hotel', '2 KG 566 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'kigali-diplomat-hotel', NULL, true),
  ('Vecchia Napoli @ Salini Resort. Naxxar', 'Triq Is-Salini Naxxar, In-Naxxar NXR 9030, Malta', 'Malta', 'Naxxar', 'EUR', 'vecchia-napoli-salini-resort-naxxar', NULL, true),
  ('Sakura Japanese Cuisine Lounge', 'Triq Paceville, St. Julian''s, Malta', 'Malta', 'St. Julian''s', 'EUR', 'sakura-japanese-cuisine-lounge', NULL, true),
  ('Cork''s', '58 Triq San Gorg, St Julian''s STJ 3205, Malta', 'Malta', 'St Julian''s', 'EUR', 'corks', NULL, true),
  ('HAVANA BAR AND RESTO', '3322+G97, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'havana-bar-and-resto', NULL, true),
  ('Cocobean', 'KG 5 Ave, A, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'cocobean', NULL, true)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
