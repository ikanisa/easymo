-- easyMO seed data (additive only)

-- Bar + menu
INSERT INTO public.bars (id, slug, name, location_text, country, city_area, currency, is_active)
VALUES ('00000000-0000-0000-0000-000000000101', 'sunset-bar', 'Sunset Bar', 'Kigali City Tower', 'RW', 'Nyarugenge', 'RWF', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.bar_numbers (bar_id, number_e164, role, is_active)
VALUES ('00000000-0000-0000-0000-000000000101', '+250700000010', 'manager', true)
ON CONFLICT (bar_id, number_e164) DO NOTHING;

INSERT INTO public.customers (id, wa_id, display_name)
VALUES ('00000000-0000-0000-0000-000000000111', '+250700000001', 'Demo Customer')
ON CONFLICT (wa_id) DO NOTHING;

INSERT INTO public.menus (id, bar_id, version, status, source)
VALUES ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', 1, 'published', 'manual')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.categories (id, bar_id, menu_id, name, sort_order)
VALUES ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', 'Meals', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.items (id, bar_id, menu_id, category_id, name, price_minor, currency, sort_order)
VALUES ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000301', 'Grilled Chicken', 8000, 'RWF', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.bar_tables (id, bar_id, label, qr_payload)
VALUES ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000101', 'T1', 'B:sunset-bar T:T1 K:seed')
ON CONFLICT (id) DO NOTHING;

-- Produce catalog seeds
INSERT INTO public.produce_catalog (
  id,
  commodity,
  variety,
  market_code,
  grade,
  unit,
  min_order,
  price_floor,
  price_ceiling,
  synonyms,
  localized_names,
  metadata
) VALUES
  (
    '00000000-0000-0000-0000-00000000f101',
    'cassava',
    'bonoua_white',
    'ci-abidjan',
    'export',
    'kg',
    100,
    0.45,
    0.62,
    ARRAY['manioc', 'manioc blanc', 'agbelima'],
    jsonb_build_object('fr', 'Manioc blanc Bonoua', 'en', 'Bonoua White Cassava'),
    jsonb_build_object('variety_label', 'Bonoua White', 'notes', 'Preferred export peel with <12% humidity')
  ),
  (
    '00000000-0000-0000-0000-00000000f102',
    'cassava',
    'bonoua_white',
    'sn-dakar',
    'industrial',
    'bag',
    50,
    28,
    34,
    ARRAY['manioc', 'manioc blanc'],
    jsonb_build_object('fr', 'Manioc blanc Bonoua', 'en', 'Bonoua White Cassava'),
    jsonb_build_object('variety_label', 'Bonoua White', 'bag_weight_kg', 50)
  ),
  (
    '00000000-0000-0000-0000-00000000f103',
    'plantain',
    'ala_ta',
    'sn-dakar',
    'premium',
    'bunch',
    30,
    5.5,
    7.2,
    ARRAY['banane plantain', 'ala-ta'],
    jsonb_build_object('fr', 'Banane plantain Ala Ta', 'en', 'Ala Ta Plantain'),
    jsonb_build_object('variety_label', 'Ala Ta', 'calibration', '40-45kg per crate')
  ),
  (
    '00000000-0000-0000-0000-00000000f104',
    'yam',
    'pona',
    'gh-accra',
    'export',
    'tuber',
    40,
    2.9,
    3.5,
    ARRAY['pona', 'puna'],
    jsonb_build_object('en', 'Pona Yam'),
    jsonb_build_object('variety_label', 'Pona', 'size_class', '4-5kg tubers')
  ),
  (
    '00000000-0000-0000-0000-00000000f105',
    'maize',
    'obatanpa',
    'gh-accra',
    'grade_1',
    'bag',
    30,
    42,
    48,
    ARRAY['obatanpa', 'maize', 'corn'],
    jsonb_build_object('en', 'Obatanpa Maize'),
    jsonb_build_object('moisture', '12-13%', 'bag_weight_kg', 100)
  ),
  (
    '00000000-0000-0000-0000-00000000f106',
    'hibiscus',
    'sabdariffa',
    'ci-abidjan',
    'sun_dried',
    'kg',
    15,
    2.1,
    2.6,
    ARRAY['bissap', 'roselle'],
    jsonb_build_object('fr', 'Bissap rouge', 'en', 'Sun-dried Hibiscus'),
    jsonb_build_object('color', 'deep_red', 'impurity', '<2%')
  )
ON CONFLICT (market_code, commodity, variety, grade) DO UPDATE
SET
  unit = EXCLUDED.unit,
  min_order = EXCLUDED.min_order,
  price_floor = EXCLUDED.price_floor,
  price_ceiling = EXCLUDED.price_ceiling,
  synonyms = EXCLUDED.synonyms,
  localized_names = EXCLUDED.localized_names,
  metadata = public.produce_catalog.metadata || EXCLUDED.metadata,
  updated_at = now();

-- WhatsApp Home Menu: Business Broker Agent (Buy & Sell)
INSERT INTO public.whatsapp_home_menu_items (
  key,
  name,
  is_active,
  active_countries,
  display_order,
  icon,
  country_specific_names
) VALUES (
  'business_broker_agent',
  'Buy and Sell',
  true,
  ARRAY['RW', 'BI', 'TZ', 'CD', 'ZM', 'TG', 'MT'],
  4,
  '🛒',
  jsonb_build_object(
    'RW', jsonb_build_object('name', 'Kugura & Kugurisha', 'description', 'Find businesses & services near you'),
    'MT', jsonb_build_object('name', 'Buy & Sell', 'description', 'Find businesses & services near you'),
    'BI', jsonb_build_object('name', 'Acheter & Vendre', 'description', 'Trouvez entreprises et services'),
    'TZ', jsonb_build_object('name', 'Nunua & Uza', 'description', 'Pata biashara karibu nawe'),
    'CD', jsonb_build_object('name', 'Acheter & Vendre', 'description', 'Trouvez entreprises près de vous'),
    'ZM', jsonb_build_object('name', 'Buy & Sell', 'description', 'Find businesses near you'),
    'TG', jsonb_build_object('name', 'Acheter & Vendre', 'description', 'Trouvez entreprises')
  )
) ON CONFLICT (key) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  active_countries = EXCLUDED.active_countries,
  display_order = EXCLUDED.display_order,
  country_specific_names = EXCLUDED.country_specific_names;

-- WhatsApp Home Menu: Farmer Agent
INSERT INTO public.whatsapp_home_menu_items (
  key,
  name,
  is_active,
  active_countries,
  display_order,
  icon,
  country_specific_names
) VALUES (
  'farmer_agent',
  'Farmers & Buyers',
  true,
  ARRAY['RW', 'CI', 'SN', 'GH', 'KE', 'TZ', 'UG'],
  15,
  '🌾',
  jsonb_build_object(
    'RW', jsonb_build_object('name', 'Abahinzi n''Abaguzi', 'description', 'Gura no kugurisha ibihingwa'),
    'CI', jsonb_build_object('name', 'Agriculteurs et Acheteurs', 'description', 'Acheter et vendre des produits agricoles'),
    'SN', jsonb_build_object('name', 'Fermiers et Acheteurs', 'description', 'Connecter fermiers et acheteurs'),
    'GH', jsonb_build_object('name', 'Farmers & Buyers', 'description', 'Connect farmers with buyers'),
    'KE', jsonb_build_object('name', 'Farmers & Buyers', 'description', 'Connect farmers with buyers'),
    'TZ', jsonb_build_object('name', 'Wakulima na Wanunuzi', 'description', 'Unganisha wakulima na wanunuzi'),
    'UG', jsonb_build_object('name', 'Farmers & Buyers', 'description', 'Connect farmers with buyers')
  )
) ON CONFLICT (key) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  active_countries = EXCLUDED.active_countries,
  display_order = EXCLUDED.display_order,
  country_specific_names = EXCLUDED.country_specific_names;
