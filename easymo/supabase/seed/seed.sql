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
