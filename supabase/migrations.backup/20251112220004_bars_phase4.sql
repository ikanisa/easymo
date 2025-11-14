-- Migration: Bars Table Phase 4 (Records 76-100 - Final batch)
-- Generated: 2025-11-12 22:00 UTC
-- Phase: 4 of 4

BEGIN;

-- Insert Phase 4 data (remaining 25 records)
INSERT INTO public.bars (name, location_text, country, city_area, currency, slug)
VALUES
  ('Cuba Campus Hub', NULL, 'Malta', NULL, 'EUR', 'cuba-campus-hub-2'),
  ('Cincinnati Bar & Grill', '2 KK 341 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'cincinnati-bar-grill'),
  ('Lemigo Hotel', 'KG 624 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'lemigo-hotel'),
  ('Lou's Bistro', 'Tigné Seafront, Tas-Sliema, Malta', 'Malta', 'Tas-Sliema', 'EUR', 'lous-bistro'),
  ('Opa! Mediterranean Fusion', '163 Triq Ix - Xatt, Tas-Sliema, Malta', 'Malta', 'Tas-Sliema', 'EUR', 'opa-mediterranean-fusion'),
  ('Mojitos Beach Terrace', 'Triq Ir-Ramla, Il-Mellieħa MLH 7100, Malta', 'Malta', 'Mellieħa', 'EUR', 'mojitos-beach-terrace'),
  ('Gourmet Bar & Grill', '114 Gourmet Bar&Grill TRIQ IL-HGEJJEG BUGIBBA, SAN PAWL IL-BAHAR Saint Paul''s Bay, St Paul''s Bay SPB 2821, Malta', 'Malta', 'St Paul''s Bay', 'EUR', 'gourmet-bar-grill'),
  ('Okurama Asian Fusion', 'St. George''s Bay, St. Julian''s, Malta', 'Malta', 'St. Julian''s', 'EUR', 'okurama-asian-fusion-2'),
  ('Suki Asian Snacks', 'Republic St, Valletta VLT 1117, Malta', 'Malta', 'Valletta', 'EUR', 'suki-asian-snacks'),
  ('San Giovanni Valletta', 'St. John''s Square Valletta, Il-Belt Valletta VLT 1150, Malta', 'Malta', 'Valletta', 'EUR', 'san-giovanni-valletta'),
  ('Grand Legacy Hotel', '24Q7+6J, KN 3 Rd, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'grand-legacy-hotel'),
  ('The Bridge Bar', 'VGW7+FCP, Liesse, Il-Belt Valletta, Malta', 'Malta', 'Valletta', 'EUR', 'the-bridge-bar'),
  ('The Brew Bar Grill', 'Triq Paceville, St. Julian''s, Malta', 'Malta', 'St. Julian''s', 'EUR', 'the-brew-bar-grill'),
  ('1926 La Vie', 'Qui-Si-Sana Seafront Sliema SLM, Sliema 3503, Malta', 'Malta', 'Sliema', 'EUR', '1926-la-vie'),
  ('Dolce Sicilia Paceville', 'STJ3141 Triq Dragonara,nr 89, St Julian''s STJ 3141, Malta', 'Malta', 'St Julian''s', 'EUR', 'dolce-sicilia-paceville'),
  ('CUBA Restaurant. Shoreline Mall. Kalkara', 'The Shoreline Mall, Smart City, Kalkara SCM 1001, Malta', 'Malta', 'Kalkara', 'EUR', 'cuba-restaurant-shoreline-mall-kalkara'),
  ('The Londoner British Pub Sliema', 'Triq ix-Xatt, Sliema, Malta', 'Malta', 'Sliema', 'EUR', 'the-londoner-british-pub-sliema-2'),
  ('The Hatter Irish Pub', '34 Triq Gerry Zammit, Il-Gżira GZR 1660, Malta', 'Malta', 'Gżira', 'EUR', 'the-hatter-irish-pub'),
  ('Maxima Bar & Restaurant', 'Maxima, Marfa Road, Mellieħa, Malta', 'Malta', 'Mellieħa', 'EUR', 'maxima-bar-restaurant'),
  ('Ventuno Restaurant', 'Marfa Road, Mellieħa, Malta', 'Malta', 'Mellieħa', 'EUR', 'ventuno-restaurant'),
  ('9 Ball Cafe', '366 Tourist St, St Paul''s Bay, Malta', 'Malta', 'St Paul''s Bay', 'EUR', '9-ball-cafe'),
  ('White Tower Lido', 'Il-Bajja ta Torri L Abjad, Mellieħa, Malta', 'Malta', 'Mellieħa', 'EUR', 'white-tower-lido'),
  ('Cafe Cuba St Julians', 'St. George''s Bay, St. Julian''s, Malta', 'Malta', 'St. Julian''s', 'EUR', 'cafe-cuba-st-julians'),
  ('Burrows Bar & Restaurant', 'Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'burrows-bar-restaurant'),
  ('The B Lounge', 'KN 168 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'the-b-lounge')
ON CONFLICT (slug) DO NOTHING;

COMMIT;
