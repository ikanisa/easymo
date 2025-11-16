-- Migration: Bars Table Phase 3 (Records 51-75)
-- Generated: 2025-11-12 22:00 UTC
-- Phase: 3 of 4

BEGIN;

-- Insert Phase 3 data (25 records)
INSERT INTO public.bars (name, location_text, country, city_area, currency, slug)
VALUES
  ('Open Waters', 'WFGQ+44X, ix-Xatt Ta'' San Ġorġ, San Ġiljan, Malta', 'Malta', 'San Ġiljan', 'EUR', 'open-waters'),
  ('CKYC Lounge', 'KN 196 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'ckyc-lounge'),
  ('Cuba Campus Hub', 'University Campus, Msida, Malta', 'Malta', 'Msida', 'EUR', 'cuba-campus-hub'),
  ('Chez Guiness Bar', '24VC+93P, KG 129 St, Kigali, Rwanda', 'Malta', 'Kigali', 'EUR', 'chez-guiness-bar'),
  ('Bayside Restaurant', 'Dawret Il-Gzejjer, San Pawl il-Baħar, Malta', 'Malta', 'San Pawl il-Baħar', 'EUR', 'bayside-restaurant'),
  ('L'' Ostricaio Paceville. St. Julians', 'Triq Ball, San Ġiljan, Malta', 'Malta', 'San Ġiljan', 'EUR', 'l-ostricaio-paceville-st-julians'),
  ('Kigali Marriott Hotel', 'KN 3 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'kigali-marriott-hotel'),
  ('Marina Terrace', 'Marina Terrace, Portamaso Marina, St Julian''s PTM01, Malta', 'Malta', 'St Julian''s', 'EUR', 'marina-terrace'),
  ('Agence Pub', '24Q7+MH3, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'agence-pub'),
  ('Cuba Shoreline', NULL, 'Malta', NULL, 'EUR', 'cuba-shoreline'),
  ('House of Flavors', 'Paceville, St. Julian''s, Malta', 'Malta', 'Paceville', 'EUR', 'house-of-flavors'),
  ('NOM NOM Paceville', 'Triq id-Dragunara, San Ġiljan, Malta', 'Malta', 'San Ġiljan', 'EUR', 'nom-nom-paceville'),
  ('HQ LOUNGE', 'KK 15 RD AND, KK 22 AVE, JUNCTION, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'hq-lounge'),
  ('Okurama Asian Fusion', NULL, 'Malta', NULL, 'EUR', 'okurama-asian-fusion'),
  ('Trattoria da Nennella', '76 St George''s Road St Julian''s, St Julian''s STJ 3205, Malta', 'Malta', 'St Julian''s', 'EUR', 'trattoria-da-nennella'),
  ('The Londoner British Pub Sliema', NULL, 'Malta', NULL, 'EUR', 'the-londoner-british-pub-sliema'),
  ('Maracana Rwanda', 'KK 698 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'maracana-rwanda'),
  ('Great Wall Chinese Restaurant', '3 KG 624 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'great-wall-chinese-restaurant'),
  ('Era Ora Steakhouse', 'Barracuda Building, Balluta Bay, St Julian''s, Malta', 'Malta', 'St Julian''s', 'EUR', 'era-ora-steakhouse'),
  ('The Capitol City Bar', '172 Merchants St, Valletta VLT 1462, Malta', 'Malta', 'Valletta', 'EUR', 'the-capitol-city-bar'),
  ('Déjà Vu', '13 KG 169 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'deja-vu'),
  ('Peppermint', 'WFFQ+FVH, Triq il-Wilga, St Julian''s, Malta', 'Malta', 'St Julian''s', 'EUR', 'peppermint'),
  ('La Pira Maltese Kitchen', '35 Merchants St, Valletta VLT 1171, Malta', 'Malta', 'Valletta', 'EUR', 'la-pira-maltese-kitchen'),
  ('CARRINGTON Resto-Bar', '24W6+7JJ, KG 233 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'carrington-resto-bar'),
  ('Surfside', NULL, 'Malta', NULL, 'EUR', 'surfside')
ON CONFLICT (slug) DO NOTHING;

COMMIT;
