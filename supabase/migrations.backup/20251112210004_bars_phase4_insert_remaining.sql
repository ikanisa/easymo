-- =====================================================
-- PHASE 4: Insert bars data (Part 3 - Remaining records)
-- Migration: 20251112210004_bars_phase4_insert_remaining.sql
-- Description: Insert remaining bars records (101+)
-- =====================================================

BEGIN;

INSERT INTO public.bars (name, location_text, country, city_area, currency, slug)
VALUES
  ('Brown''s Kitchen', NULL, 'Malta', NULL, 'EUR', 'browns-kitchen'),
  ('Sky Lounge', '3329+FH8, KN 51 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'sky-lounge'),
  ('Soul Food', '76 Merchants St, Valletta, Malta', 'Malta', 'Valletta', 'EUR', 'soul-food'),
  ('City of London Bar', 'WF8V+877, George Borg Olivier St, St Julian''s, Malta', 'Malta', 'St Julian''s', 'EUR', 'city-of-london-bar'),
  ('Focacceria Dal Pani', '128 St. Lucia''s Street, Il-Belt Valletta, Malta', 'Malta', 'Valletta', 'EUR', 'focacceria-dal-pani'),
  ('Vecchia Napoli Mellieha', 'Triq Il-Marfa, Il-Mellieħa, Malta', 'Malta', 'Mellieħa', 'EUR', 'vecchia-napoli-mellieha'),
  ('The Chapels Gastrobrewpub', 'Level 3, The Brewhouse, Mdina, Zone 2, Central Business District, Road, Birkirkara CBD 2010, Malta', 'Malta', 'Birkirkara', 'EUR', 'the-chapels-gastrobrewpub'),
  ('Il-Fortizza', 'Il-Fortizza, Is-Swieqi, Malta', 'Malta', 'Swieqi', 'EUR', 'il-fortizza'),
  ('Woodhut Pub & Diner', '283 Tourist St, Qawra SPB 1022, Malta', 'Malta', 'Qawra', 'EUR', 'woodhut-pub-diner'),
  ('Tico Tico', '61 Strait St, Valletta, Malta', 'Malta', 'Valletta', 'EUR', 'tico-tico'),
  ('Spinola Cafe Lounge St Julians', 'Spinola Bay, St. Julian''s, Malta', 'Malta', 'St. Julian''s', 'EUR', 'spinola-cafe-lounge-st-julians'),
  ('Gandhi Tandoori', 'Mosta Road, St Paul''s Bay, Malta', 'Malta', 'St Paul''s Bay', 'EUR', 'gandhi-tandoori'),
  ('Compass Lounge', 'Triq It - Torri Tower road, 1000, Sliema, Malta', 'Malta', 'Sliema', 'EUR', 'compass-lounge'),
  ('Maison Noire Bar & Restaurant', '24F3+WMV, KK 15 Rd, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'maison-noire-bar-restaurant'),
  ('Gorillas Golf Hotel', 'KG 274 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'gorillas-golf-hotel'),
  ('Juru Garden Bar', 'Juru, Rwanda', 'Malta', 'Kigali', 'EUR', 'juru-garden-bar'),
  ('Ubumwe Grande Hotel Kigali', 'KN 67 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'ubumwe-grande-hotel-kigali'),
  ('Billy''s Bistro & Bar', '9 KG 13 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'billys-bistro-bar'),
  ('The Crafty Cat Pub', 'George Borg Oliver, Mall, Tower Road, St Julian''s, Malta', 'Malta', 'St Julian''s', 'EUR', 'the-crafty-cat-pub'),
  ('Wok to Walk', 'St George''s Road, St Julian''s, Malta', 'Malta', 'St Julian''s', 'EUR', 'wok-to-walk'),
  ('Angela''s Valletta', '84 Triq San Gwann, Il-Belt Valletta, Malta', 'Malta', 'Valletta', 'EUR', 'angelas-valletta'),
  ('The Dubliner', 'George Borg Olivier St, St Julian''s, Malta', 'Malta', 'St Julian''s', 'EUR', 'the-dubliner'),
  ('Zion Bar & Restaurant', 'St Thomas Bay, Marsaskala, Malta', 'Malta', 'Marsaskala', 'EUR', 'zion-bar-restaurant'),
  ('Plus 250', 'Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'plus-250'),
  ('East 24 Bar & Grill', 'KK 315 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'east-24-bar-grill'),
  ('Torino Bar & Restaurant', '23G3+CFP, KN 168 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'torino-bar-restaurant'),
  ('Ħelu Manna Gluten Free Kafeterija Valletta', '51 St. John''s Street, Valletta, Malta', 'Malta', 'Valletta', 'EUR', 'helu-manna-gluten-free-kafeterija-valletta'),
  ('AKI', '175 Strait St Corner of St. Street and Santa Lucia St Valletta, Valletta VLT 1455, Malta', 'Malta', 'Valletta', 'EUR', 'aki'),
  ('Pili Pili', '12 KG 303 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'pili-pili'),
  ('Piatto Nero Mediterranean Restaurant', 'Ramla Bay Resort, Triq Ir-Ramla, Il-Mellieħa MLH 7100, Malta', 'Malta', 'Mellieħa', 'EUR', 'piatto-nero-mediterranean-restaurant'),
  ('Kari-Beau Restaurant', 'KK 368 St, 2A, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'kari-beau-restaurant'),
  ('67 Kapitali', '67 Triq l-Ifran Il-Belt Valletta, Valletta VLT 1427, Malta', 'Malta', 'Valletta', 'EUR', '67-kapitali'),
  ('Singita Restaurant', 'ghajn tuffieha bay, Mġarr MGR 2093, Malta', 'Malta', 'Mġarr', 'EUR', 'singita-restaurant'),
  ('Lady Di', '21 Hughes Hallet, Tas-Sliema, Malta', 'Malta', 'Tas-Sliema', 'EUR', 'lady-di'),
  ('The Dragon Chinese restaurant', 'Nawfragju, Valletta, Malta', 'Malta', 'Valletta', 'EUR', 'the-dragon-chinese-restaurant'),
  ('Emerald Café and Restaurant', '70 KG 13 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'emerald-cafe-and-restaurant'),
  ('Cafe Society', '13 Triq San Gwann, Il-Belt Valletta, Malta', 'Malta', 'Valletta', 'EUR', 'cafe-society'),
  ('Vecchia Napoli Qawra', 'Dawret Il - Qawra, Qawra, Malta', 'Malta', 'Qawra', 'EUR', 'vecchia-napoli-qawra'),
  ('Tigne Beach Club', 'Tigné Seafront, Tas-Sliema SLM 3112, Malta', 'Malta', 'Tas-Sliema', 'EUR', 'tigne-beach-club'),
  ('Lino Kiosk', 'St Paul''s Bay, Malta', 'Malta', 'St Paul''s Bay', 'EUR', 'lino-kiosk'),
  ('Jungle Joy Bar - Restaurant', 'Triq il-Gzira, Il-Gżira, Malta', 'Malta', 'Gżira', 'EUR', 'jungle-joy-bar-restaurant'),
  ('King's Gate Gastropub', 'Triq Tal-Hriereb L-Imsida, Msida MSD 1672, Malta', 'Malta', 'Msida', 'EUR', 'kings-gate-gastropub'),
  ('AFTER PARTY BAR & GRILL', 'KN 224 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'after-party-bar-grill'),
  ('Ivy House', 'Triq Tunis, Pembroke, Malta', 'Malta', 'Pembroke', 'EUR', 'ivy-house'),
  ('NAAR Restobar', '1 Triq Censu Tabone, St Julian''s STJ 1017, Malta', 'Malta', 'St Julian''s', 'EUR', 'naar-restobar'),
  ('Mason''s Cafe', 'WG74+9QP, Triq it Torri, Tas-Sliema, Malta', 'Malta', 'Tas-Sliema', 'EUR', 'masons-cafe'),
  ('The Manor Hotel', '64 KG 552 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'the-manor-hotel'),
  ('Fresco''s', 'Fresco''s Restaurant, Tower Road, Sliema SLM 1600, Malta', 'Malta', 'Sliema', 'EUR', 'frescos'),
  ('Hammett''s Mestizo', '11, Triq Schreiber San Giljan, St Julian''s STJ 3081, Malta', 'Malta', 'St Julian''s', 'EUR', 'hammetts-mestizo'),
  ('Fortizza', NULL, 'Malta', NULL, 'EUR', 'fortizza'),
  ('Zion Reggae Bar', 'Triq Paceville, St. Julian''s, Malta', 'Malta', 'St. Julian''s', 'EUR', 'zion-reggae-bar')
ON CONFLICT (slug) DO NOTHING;

COMMIT;
