-- EasyMO Client PWA - Seed Data
BEGIN;

-- Insert sample venue
INSERT INTO public.venues (id, name, slug, description, logo_url, currency, is_active, payment_methods)
VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'Heaven Restaurant & Bar',
  'heaven-bar',
  'Premium dining in Kigali',
  null,
  'RWF',
  true,
  '[{"type": "momo", "enabled": true}, {"type": "cash", "enabled": true}]'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- Insert categories
INSERT INTO public.menu_categories (id, venue_id, name, slug, emoji, display_order)
VALUES
  ('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'Appetizers', 'appetizers', '🥗', 1),
  ('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'Main Dishes', 'mains', '🍕', 2),
  ('650e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', 'Drinks', 'drinks', '🍺', 3),
  ('650e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', 'Desserts', 'desserts', '🍰', 4)
ON CONFLICT (venue_id, slug) DO NOTHING;

-- Insert menu items
INSERT INTO public.menu_items (venue_id, category_id, name, description, price, emoji, is_available, is_popular, is_vegetarian, prep_time_minutes)
VALUES
  ('550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', 'Caesar Salad', 'Fresh romaine lettuce, parmesan, croutons', 8000, '🥗', true, false, true, 10),
  ('550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', 'Spring Rolls', 'Crispy vegetable spring rolls', 5000, '🥟', true, false, true, 15),
  ('550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440002', 'Margherita Pizza', 'Classic tomato sauce, mozzarella, basil', 12000, '🍕', true, true, true, 20),
  ('550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440002', 'Beef Burger', 'Angus beef, cheese, special sauce', 15000, '🍔', true, true, false, 25),
  ('550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440003', 'Primus Beer', 'Ice cold lager beer', 1500, '🍺', true, true, true, 2),
  ('550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440003', 'Fresh Juice', 'Orange or passion fruit', 3000, '🧃', true, false, true, 5),
  ('550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440004', 'Chocolate Cake', 'Rich chocolate with vanilla ice cream', 6000, '🍰', true, true, true, 5);

COMMIT;
