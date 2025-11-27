-- Client PWA Test Data Seed
-- Creates a sample venue with menu items for testing
-- Created: 2025-11-27

BEGIN;

-- Insert test venue
INSERT INTO public.venues (slug, name, logo_url, address, phone, hours) VALUES
('heaven-bar', 'Heaven Bar & Restaurant', 'https://placehold.co/200x200/f9a825/0a0a0a?text=Heaven', 
 'KG 123 St, Kigali, Rwanda', '+250788123456',
 '{"mon": "10:00-23:00", "tue": "10:00-23:00", "wed": "10:00-23:00", "thu": "10:00-23:00", "fri": "10:00-01:00", "sat": "10:00-01:00", "sun": "12:00-22:00"}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- Get venue ID and insert categories and items
DO $$
DECLARE
  v_id UUID;
  cat_appetizers UUID;
  cat_mains UUID;
  cat_drinks UUID;
  cat_desserts UUID;
BEGIN
  SELECT id INTO v_id FROM venues WHERE slug = 'heaven-bar';

  -- Insert categories
  INSERT INTO menu_categories (venue_id, name, emoji, sort_order) 
  VALUES (v_id, 'Appetizers', '🍟', 1) 
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_appetizers;

  INSERT INTO menu_categories (venue_id, name, emoji, sort_order) 
  VALUES (v_id, 'Main Courses', '🍕', 2)
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_mains;

  INSERT INTO menu_categories (venue_id, name, emoji, sort_order) 
  VALUES (v_id, 'Drinks', '🍺', 3)
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_drinks;

  INSERT INTO menu_categories (venue_id, name, emoji, sort_order) 
  VALUES (v_id, 'Desserts', '🍰', 4)
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_desserts;

  -- Get category IDs if already exist
  IF cat_appetizers IS NULL THEN
    SELECT id INTO cat_appetizers FROM menu_categories WHERE venue_id = v_id AND name = 'Appetizers';
  END IF;
  IF cat_mains IS NULL THEN
    SELECT id INTO cat_mains FROM menu_categories WHERE venue_id = v_id AND name = 'Main Courses';
  END IF;
  IF cat_drinks IS NULL THEN
    SELECT id INTO cat_drinks FROM menu_categories WHERE venue_id = v_id AND name = 'Drinks';
  END IF;
  IF cat_desserts IS NULL THEN
    SELECT id INTO cat_desserts FROM menu_categories WHERE venue_id = v_id AND name = 'Desserts';
  END IF;

  -- Insert Appetizers
  INSERT INTO menu_items (venue_id, category_id, name, description, price, emoji, is_popular, is_vegetarian, prep_time_minutes) 
  VALUES 
  (v_id, cat_appetizers, 'French Fries', 'Crispy golden fries with special sauce', 3000.00, '🍟', true, true, 10),
  (v_id, cat_appetizers, 'Chicken Wings', 'Spicy buffalo wings (6 pcs)', 5000.00, '🍗', true, false, 15),
  (v_id, cat_appetizers, 'Spring Rolls', 'Vegetable spring rolls (4 pcs)', 4000.00, '🥟', false, true, 12),
  (v_id, cat_appetizers, 'Mozzarella Sticks', 'Deep fried mozzarella (6 pcs)', 4500.00, '🧀', false, true, 12),
  (v_id, cat_appetizers, 'Nachos', 'Tortilla chips with cheese & salsa', 5500.00, '🌮', true, true, 8)
  ON CONFLICT DO NOTHING;

  -- Insert Main Courses
  INSERT INTO menu_items (venue_id, category_id, name, description, price, emoji, is_popular, is_vegetarian, is_spicy, prep_time_minutes) 
  VALUES 
  (v_id, cat_mains, 'Margherita Pizza', 'Classic tomato & mozzarella', 12000.00, '🍕', true, true, false, 20),
  (v_id, cat_mains, 'Pepperoni Pizza', 'Tomato, mozzarella & pepperoni', 14000.00, '🍕', true, false, false, 20),
  (v_id, cat_mains, 'Beef Burger', 'Angus beef with cheese & bacon', 8000.00, '🍔', true, false, false, 18),
  (v_id, cat_mains, 'Veggie Burger', 'Plant-based patty with avocado', 7000.00, '🍔', false, true, false, 18),
  (v_id, cat_mains, 'Grilled Chicken', 'Herb-marinated grilled chicken breast', 10000.00, '🍗', false, false, false, 25),
  (v_id, cat_mains, 'Pasta Carbonara', 'Creamy pasta with bacon', 9000.00, '🍝', false, false, false, 15),
  (v_id, cat_mains, 'Fish & Chips', 'Beer-battered fish with fries', 11000.00, '🐟', false, false, false, 22),
  (v_id, cat_mains, 'Beef Steak', 'Grilled ribeye steak (250g)', 18000.00, '🥩', true, false, false, 30)
  ON CONFLICT DO NOTHING;

  -- Insert Drinks
  INSERT INTO menu_items (venue_id, category_id, name, description, price, emoji, is_popular, is_vegetarian, prep_time_minutes) 
  VALUES 
  (v_id, cat_drinks, 'Primus Beer', 'Local beer (330ml)', 1500.00, '🍺', true, true, 2),
  (v_id, cat_drinks, 'Heineken', 'International beer (330ml)', 2000.00, '🍺', false, true, 2),
  (v_id, cat_drinks, 'Coca-Cola', 'Soft drink (330ml)', 1000.00, '🥤', false, true, 1),
  (v_id, cat_drinks, 'Fanta Orange', 'Soft drink (330ml)', 1000.00, '🥤', false, true, 1),
  (v_id, cat_drinks, 'Fresh Orange Juice', 'Freshly squeezed (250ml)', 2000.00, '🍊', false, true, 5),
  (v_id, cat_drinks, 'Coffee', 'Hot espresso', 1500.00, '☕', true, true, 3),
  (v_id, cat_drinks, 'Cappuccino', 'Espresso with steamed milk', 2000.00, '☕', false, true, 4),
  (v_id, cat_drinks, 'Red Wine', 'House red wine (glass)', 3500.00, '🍷', false, true, 2),
  (v_id, cat_drinks, 'White Wine', 'House white wine (glass)', 3500.00, '🍷', false, true, 2)
  ON CONFLICT DO NOTHING;

  -- Insert Desserts
  INSERT INTO menu_items (venue_id, category_id, name, description, price, emoji, is_popular, is_vegetarian, prep_time_minutes) 
  VALUES 
  (v_id, cat_desserts, 'Chocolate Cake', 'Rich chocolate layer cake', 4000.00, '🍰', true, true, 5),
  (v_id, cat_desserts, 'Cheesecake', 'New York style cheesecake', 4500.00, '🍰', true, true, 5),
  (v_id, cat_desserts, 'Ice Cream', 'Vanilla, chocolate, or strawberry', 2500.00, '🍨', false, true, 3),
  (v_id, cat_desserts, 'Apple Pie', 'Homemade apple pie with ice cream', 4000.00, '🥧', false, true, 8),
  (v_id, cat_desserts, 'Tiramisu', 'Classic Italian dessert', 5000.00, '🍰', true, true, 5)
  ON CONFLICT DO NOTHING;

END $$;

COMMIT;
