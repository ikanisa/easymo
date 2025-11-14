-- Migration: Bars Table Phase 2 (Records 26-50)
-- Generated: 2025-11-12 22:00 UTC
-- Phase: 2 of 4

BEGIN;

-- Insert Phase 2 data (25 records)
INSERT INTO public.bars (name, location_text, country, city_area, currency, slug)
VALUES
  ('Vecchia Napoli @ Salini Resort. Naxxar', 'Triq Is-Salini Naxxar, In-Naxxar NXR 9030, Malta', 'Malta', 'Naxxar', 'EUR', 'vecchia-napoli-salini-resort-naxxar'),
  ('Sakura Japanese Cuisine Lounge', 'Triq Paceville, St. Julian''s, Malta', 'Malta', 'St. Julian''s', 'EUR', 'sakura-japanese-cuisine-lounge'),
  ('Cork''s', '58 Triq San Gorg, St Julian''s STJ 3205, Malta', 'Malta', 'St Julian''s', 'EUR', 'corks'),
  ('HAVANA BAR AND RESTO', '3322+G97, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'havana-bar-and-resto'),
  ('Cocobean', 'KG 5 Ave, A, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'cocobean'),
  ('Jollof Kigali', 'KG 18 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'jollof-kigali'),
  ('Hôtel Chez Lando', 'KG 201 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'hotel-chez-lando'),
  ('Peperino Pizza Cucina Verace', NULL, 'Malta', NULL, 'EUR', 'peperino-pizza-cucina-verace'),
  ('Tropical Bar-Restaurant-Rounge', '4 KK 371 St, Kigali, Rwanda', 'Malta', 'Kigali', 'EUR', 'tropical-bar-restaurant-rounge'),
  ('Hotel Villa Portofino Kigali', 'House No. 119, KG 9 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'hotel-villa-portofino-kigali'),
  ('Roasters CHOMAZONE Restaurant', 'KK 6 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'roasters-chomazone-restaurant'),
  ('Meze Fresh', 'KG 550 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'meze-fresh'),
  ('Exiles', NULL, 'Malta', NULL, 'EUR', 'exiles-2'),
  ('Sandy Waters', 'X8CX+CRX, Triq Il-Marfa, Il-Mellieħa, Malta', 'Malta', 'Mellieħa', 'EUR', 'sandy-waters'),
  ('Xemxija Pitstop', 'Xatt Il-Pwales, San Pawl il-Baħar, Malta', 'Malta', 'San Pawl il-Baħar', 'EUR', 'xemxija-pitstop'),
  ('Victoria Gastropub', 'Islet Promanade, St Paul''s Bay, Malta', 'Malta', 'St Paul''s Bay', 'EUR', 'victoria-gastropub'),
  ('Bar Nyenyeri', 'KK 31 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'bar-nyenyeri'),
  ('Paddock Bar', 'KK 367 #2, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'paddock-bar'),
  ('Medasia Fusion Lounge', 'Paceville, St. Julian''s, Malta', 'Malta', 'Paceville', 'EUR', 'medasia-fusion-lounge'),
  ('Bus Stop Lounge', NULL, 'Malta', NULL, 'EUR', 'bus-stop-lounge'),
  ('White Wine And Food', 'St. George''s Bay San Ġiljan, St Julian''s STJ 3302, Malta', 'Malta', 'St Julian''s', 'EUR', 'white-wine-and-food'),
  ('La Sanitas', 'KK 341 St, #20, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'la-sanitas'),
  ('Sharma Ethnic Cuisines', '52 Villa Rosa, Is-Swieqi SWQ 3344, Malta', 'Malta', 'Swieqi', 'EUR', 'sharma-ethnic-cuisines'),
  ('Doma Marsascala', NULL, 'Malta', NULL, 'EUR', 'doma-marsascala'),
  ('The Grid Kigali', 'Kigali Business Centre, KN 5 Rd, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'the-grid-kigali')
ON CONFLICT (slug) DO NOTHING;

COMMIT;
