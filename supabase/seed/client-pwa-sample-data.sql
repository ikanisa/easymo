-- Seed Data for Client PWA
-- Sample venue, menu, and tables for testing
-- Run with: psql $DATABASE_URL -f seed-pwa.sql

BEGIN;

-- Insert sample venue (Heaven Restaurant)
INSERT INTO public.venues (slug, name, logo_url, address, phone, hours, description, is_active)
VALUES (
  'heaven-restaurant',
  'Heaven Restaurant & Bar',
  'https://via.placeholder.com/200',
  'KN 5 Ave, Kigali, Rwanda',
  '+250788123456',
  '{
    "monday": "10:00-23:00",
    "tuesday": "10:00-23:00",
    "wednesday": "10:00-23:00",
    "thursday": "10:00-23:00",
    "friday": "10:00-00:00",
    "saturday": "10:00-00:00",
    "sunday": "12:00-22:00"
  }',
  'Premium dining experience with stunning views of Kigali. Enjoy delicious meals, craft cocktails, and live music.',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = now();

-- Get venue ID for reference
DO $$
DECLARE
  v_venue_id UUID;
  v_appetizers_id UUID;
  v_mains_id UUID;
  v_drinks_id UUID;
  v_desserts_id UUID;
BEGIN
  SELECT id INTO v_venue_id FROM public.venues WHERE slug = 'heaven-restaurant';

  -- Insert menu categories
  INSERT INTO public.menu_categories (venue_id, name, emoji, description, sort_order, is_active)
  VALUES 
    (v_venue_id, 'Appetizers', '🥗', 'Start your meal with our delicious starters', 0, true),
    (v_venue_id, 'Main Courses', '🍽️', 'Hearty main dishes to satisfy your hunger', 1, true),
    (v_venue_id, 'Drinks', '🍺', 'Refreshing beverages and cocktails', 2, true),
    (v_venue_id, 'Desserts', '🍰', 'Sweet treats to end your meal', 3, true)
  ON CONFLICT DO NOTHING
  RETURNING id;

  -- Get category IDs
  SELECT id INTO v_appetizers_id FROM public.menu_categories WHERE venue_id = v_venue_id AND name = 'Appetizers';
  SELECT id INTO v_mains_id FROM public.menu_categories WHERE venue_id = v_venue_id AND name = 'Main Courses';
  SELECT id INTO v_drinks_id FROM public.menu_categories WHERE venue_id = v_venue_id AND name = 'Drinks';
  SELECT id INTO v_desserts_id FROM public.menu_categories WHERE venue_id = v_venue_id AND name = 'Desserts';

  -- Insert menu items - Appetizers
  INSERT INTO public.menu_items (venue_id, category_id, name, description, price, image_url, is_available, is_popular, dietary_tags)
  VALUES
    (v_venue_id, v_appetizers_id, 'Chicken Wings', 'Crispy buffalo wings with blue cheese dip', 5000, 'https://via.placeholder.com/300', true, true, ARRAY['']::text[]),
    (v_venue_id, v_appetizers_id, 'Spring Rolls', 'Fresh vegetable spring rolls with sweet chili sauce', 3500, 'https://via.placeholder.com/300', true, false, ARRAY['vegetarian']::text[]),
    (v_venue_id, v_appetizers_id, 'Bruschetta', 'Toasted bread with tomatoes, basil, and olive oil', 4000, 'https://via.placeholder.com/300', true, false, ARRAY['vegetarian']::text[])
  ON CONFLICT DO NOTHING;

  -- Insert menu items - Mains
  INSERT INTO public.menu_items (venue_id, category_id, name, description, price, image_url, is_available, is_popular, dietary_tags)
  VALUES
    (v_venue_id, v_mains_id, 'Grilled Tilapia', 'Fresh tilapia with lemon butter sauce and vegetables', 12000, 'https://via.placeholder.com/300', true, true, ARRAY['']::text[]),
    (v_venue_id, v_mains_id, 'Beef Burger', 'Juicy beef patty with cheese, lettuce, and fries', 10000, 'https://via.placeholder.com/300', true, true, ARRAY['']::text[]),
    (v_venue_id, v_mains_id, 'Veggie Pasta', 'Penne pasta with mixed vegetables in tomato sauce', 8000, 'https://via.placeholder.com/300', true, false, ARRAY['vegetarian']::text[]),
    (v_venue_id, v_mains_id, 'Chicken Curry', 'Spicy chicken curry with rice', 11000, 'https://via.placeholder.com/300', true, false, ARRAY['spicy']::text[])
  ON CONFLICT DO NOTHING;

  -- Insert menu items - Drinks
  INSERT INTO public.menu_items (venue_id, category_id, name, description, price, image_url, is_available, is_popular, dietary_tags)
  VALUES
    (v_venue_id, v_drinks_id, 'Primus Beer', 'Local Rwandan beer', 2000, 'https://via.placeholder.com/300', true, true, ARRAY['']::text[]),
    (v_venue_id, v_drinks_id, 'Passion Fruit Juice', 'Fresh passion fruit juice', 3000, 'https://via.placeholder.com/300', true, false, ARRAY['vegetarian', 'vegan']::text[]),
    (v_venue_id, v_drinks_id, 'Mojito', 'Classic mojito cocktail', 5000, 'https://via.placeholder.com/300', true, true, ARRAY['']::text[]),
    (v_venue_id, v_drinks_id, 'Coca Cola', 'Soft drink', 1500, 'https://via.placeholder.com/300', true, false, ARRAY['vegetarian', 'vegan']::text[])
  ON CONFLICT DO NOTHING;

  -- Insert menu items - Desserts
  INSERT INTO public.menu_items (venue_id, category_id, name, description, price, image_url, is_available, is_popular, dietary_tags)
  VALUES
    (v_venue_id, v_desserts_id, 'Chocolate Cake', 'Rich chocolate cake with ice cream', 4500, 'https://via.placeholder.com/300', true, true, ARRAY['vegetarian']::text[]),
    (v_venue_id, v_desserts_id, 'Fruit Salad', 'Fresh seasonal fruits', 3500, 'https://via.placeholder.com/300', true, false, ARRAY['vegetarian', 'vegan']::text[])
  ON CONFLICT DO NOTHING;

  -- Insert venue tables
  INSERT INTO public.venue_tables (venue_id, table_number, qr_code, capacity, location, is_active)
  VALUES
    (v_venue_id, '1', 'heaven-restaurant/table/1', 4, 'Indoor', true),
    (v_venue_id, '2', 'heaven-restaurant/table/2', 4, 'Indoor', true),
    (v_venue_id, '3', 'heaven-restaurant/table/3', 2, 'Indoor', true),
    (v_venue_id, '4', 'heaven-restaurant/table/4', 6, 'Patio', true),
    (v_venue_id, '5', 'heaven-restaurant/table/5', 6, 'Patio', true),
    (v_venue_id, '6', 'heaven-restaurant/table/6', 8, 'VIP', true)
  ON CONFLICT DO NOTHING;

END $$;

COMMIT;

-- Verification
SELECT 
  'Venues' as table_name, 
  count(*) as count 
FROM public.venues WHERE slug = 'heaven-restaurant'
UNION ALL
SELECT 
  'Categories', 
  count(*) 
FROM public.menu_categories 
WHERE venue_id = (SELECT id FROM public.venues WHERE slug = 'heaven-restaurant')
UNION ALL
SELECT 
  'Menu Items', 
  count(*) 
FROM public.menu_items 
WHERE venue_id = (SELECT id FROM public.venues WHERE slug = 'heaven-restaurant')
UNION ALL
SELECT 
  'Tables', 
  count(*) 
FROM public.venue_tables 
WHERE venue_id = (SELECT id FROM public.venues WHERE slug = 'heaven-restaurant');
