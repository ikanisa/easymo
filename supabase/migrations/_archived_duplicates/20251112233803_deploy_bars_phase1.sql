-- Phase 1: Deploy first 100 bars (Rwanda locations)
-- Generated at: 2025-11-12 22:15 UTC

BEGIN;

-- First, remove duplicates from bars table based on slug
DELETE FROM public.bars a USING public.bars b
WHERE a.id < b.id AND a.slug = b.slug;

-- Insert first 100 bars (Bahamas Pub to Kigali Marriott Hotel)
INSERT INTO public.bars (name, location_text, country, city_area, currency, slug, is_active, created_at, updated_at)
VALUES
  ('Bahamas Pub', 'KG 18 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'bahamas-pub', true, NOW(), NOW()),
  ('Inzozi Africa House B&B', '15 KG 3 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'inzozi-africa-house-bb', true, NOW(), NOW()),
  ('The SkySports Lounge', 'KG 218 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'the-skysports-lounge', true, NOW(), NOW()),
  ('The Green Lounge Bar & Restaurant', 'Kicukiro Sonatube, SilverBack Mall Rooftop, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'the-green-lounge-bar-restaurant', true, NOW(), NOW()),
  ('B Flex Bar', '11 KK 21 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'b-flex-bar', true, NOW(), NOW()),
  ('Riders Lounge Kigali', 'KG 7 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'riders-lounge-kigali', true, NOW(), NOW()),
  ('Kigali Diplomat Hotel', '2 KG 566 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'kigali-diplomat-hotel', true, NOW(), NOW()),
  ('HAVANA BAR AND RESTO', '3322+G97, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'havana-bar-and-resto', true, NOW(), NOW()),
  ('Cocobean', 'KG 5 Ave, A, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'cocobean', true, NOW(), NOW()),
  ('Jollof Kigali', 'KG 18 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'jollof-kigali', true, NOW(), NOW()),
  ('Hôtel Chez Lando', 'KG 201 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'hotel-chez-lando', true, NOW(), NOW()),
  ('Hotel Villa Portofino Kigali', 'House No. 119, KG 9 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'hotel-villa-portofino-kigali', true, NOW(), NOW()),
  ('Roasters CHOMAZONE Restaurant', 'KK 6 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'roasters-chomazone-restaurant', true, NOW(), NOW()),
  ('Meze Fresh', 'KG 550 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'meze-fresh', true, NOW(), NOW()),
  ('Bar Nyenyeri', 'KK 31 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'bar-nyenyeri', true, NOW(), NOW()),
  ('Paddock Bar', 'KK 367 #2, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'paddock-bar', true, NOW(), NOW()),
  ('La Sanitas', 'KK 341 St, #20, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'la-sanitas', true, NOW(), NOW()),
  ('The Grid Kigali', 'Kigali Business Centre, KN 5 Rd, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'the-grid-kigali', true, NOW(), NOW()),
  ('CKYC Lounge', 'KN 196 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'ckyc-lounge', true, NOW(), NOW()),
  ('Kigali Marriott Hotel', 'KN 3 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'kigali-marriott-hotel', true, NOW(), NOW())
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  location_text = EXCLUDED.location_text,
  country = EXCLUDED.country,
  city_area = EXCLUDED.city_area,
  currency = EXCLUDED.currency,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

COMMIT;
