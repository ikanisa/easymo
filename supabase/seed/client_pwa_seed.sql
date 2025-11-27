-- Client PWA Seed Data
-- Demo venue with complete menu
-- Run after main migration

BEGIN;

-- ============================================================================
-- SEED DEMO VENUE: Heaven Bar & Restaurant
-- ============================================================================

-- Insert venue
INSERT INTO public.venues (slug, name, logo_url, address, phone, hours, description) VALUES
('heaven-bar', 'Heaven Bar & Restaurant', '/venues/heaven-logo.png', 'KG 123 St, Kimihurura, Kigali', '+250 788 123 456', 
 '{
   "mon": "10:00-23:00",
   "tue": "10:00-23:00",
   "wed": "10:00-23:00",
   "thu": "10:00-23:00",
   "fri": "10:00-01:00",
   "sat": "10:00-01:00",
   "sun": "12:00-22:00"
 }'::jsonb,
 'Premium bar and restaurant in the heart of Kigali'
);

-- Get venue ID for foreign keys
DO $$
DECLARE
  v_venue_id UUID;
  v_appetizers_id UUID;
  v_mains_id UUID;
  v_desserts_id UUID;
  v_drinks_id UUID;
  v_cocktails_id UUID;
  v_wine_id UUID;
BEGIN
  -- Get venue ID
  SELECT id INTO v_venue_id FROM public.venues WHERE slug = 'heaven-bar';

  -- ============================================================================
  -- CATEGORIES
  -- ============================================================================
  
  INSERT INTO public.menu_categories (venue_id, name, emoji, description, sort_order) VALUES
  (v_venue_id, 'Appetizers', '🍟', 'Start your meal right', 1) RETURNING id INTO v_appetizers_id;
  
  INSERT INTO public.menu_categories (venue_id, name, emoji, description, sort_order) VALUES
  (v_venue_id, 'Main Courses', '🍕', 'Hearty and delicious', 2) RETURNING id INTO v_mains_id;
  
  INSERT INTO public.menu_categories (venue_id, name, emoji, description, sort_order) VALUES
  (v_venue_id, 'Desserts', '🍰', 'Sweet endings', 3) RETURNING id INTO v_desserts_id;
  
  INSERT INTO public.menu_categories (venue_id, name, emoji, description, sort_order) VALUES
  (v_venue_id, 'Drinks', '🍺', 'Beers and soft drinks', 4) RETURNING id INTO v_drinks_id;
  
  INSERT INTO public.menu_categories (venue_id, name, emoji, description, sort_order) VALUES
  (v_venue_id, 'Cocktails', '🍹', 'Signature cocktails', 5) RETURNING id INTO v_cocktails_id;
  
  INSERT INTO public.menu_categories (venue_id, name, emoji, description, sort_order) VALUES
  (v_venue_id, 'Wine', '🍷', 'Fine wines', 6) RETURNING id INTO v_wine_id;

  -- ============================================================================
  -- APPETIZERS
  -- ============================================================================
  
  INSERT INTO public.menu_items (venue_id, category_id, name, description, price, currency, is_popular, is_vegetarian, prep_time_minutes) VALUES
  (v_venue_id, v_appetizers_id, 'French Fries', 'Crispy golden fries served with ketchup and mayo', 3000, 'RWF', true, true, 10),
  (v_venue_id, v_appetizers_id, 'Chicken Wings', 'Spicy buffalo wings served with blue cheese dip (6 pcs)', 5000, 'RWF', true, false, 15),
  (v_venue_id, v_appetizers_id, 'Mozzarella Sticks', 'Breaded mozzarella with marinara sauce (5 pcs)', 4500, 'RWF', false, true, 12),
  (v_venue_id, v_appetizers_id, 'Calamari Rings', 'Lightly battered and fried, served with aioli', 6000, 'RWF', false, false, 15),
  (v_venue_id, v_appetizers_id, 'Spring Rolls', 'Crispy vegetable spring rolls (4 pcs)', 3500, 'RWF', false, true, 10);

  -- ============================================================================
  -- MAIN COURSES
  -- ============================================================================
  
  INSERT INTO public.menu_items (venue_id, category_id, name, description, price, currency, is_popular, is_vegetarian, is_spicy, prep_time_minutes) VALUES
  (v_venue_id, v_mains_id, 'Margherita Pizza', 'Classic tomato sauce, fresh mozzarella, and basil', 12000, 'RWF', true, true, false, 20),
  (v_venue_id, v_mains_id, 'Pepperoni Pizza', 'Tomato sauce, mozzarella, and spicy pepperoni', 14000, 'RWF', true, false, false, 20),
  (v_venue_id, v_mains_id, 'BBQ Chicken Pizza', 'BBQ sauce, grilled chicken, red onions, and cilantro', 15000, 'RWF', true, false, false, 22),
  (v_venue_id, v_mains_id, 'Beef Burger', 'Angus beef patty, cheese, bacon, lettuce, tomato, and fries', 8000, 'RWF', true, false, false, 18),
  (v_venue_id, v_mains_id, 'Veggie Burger', 'House-made veggie patty with avocado and fries', 7000, 'RWF', false, true, false, 18),
  (v_venue_id, v_mains_id, 'Grilled Salmon', 'Atlantic salmon with lemon butter sauce and veggies', 18000, 'RWF', true, false, false, 25),
  (v_venue_id, v_mains_id, 'Chicken Tikka Masala', 'Creamy tomato curry with basmati rice', 10000, 'RWF', false, false, true, 22),
  (v_venue_id, v_mains_id, 'Pasta Carbonara', 'Creamy pasta with bacon and parmesan', 9000, 'RWF', false, false, false, 18),
  (v_venue_id, v_mains_id, 'Vegetable Stir-Fry', 'Mixed vegetables in soy-ginger sauce with rice', 7500, 'RWF', false, true, false, 15);

  -- ============================================================================
  -- DESSERTS
  -- ============================================================================
  
  INSERT INTO public.menu_items (venue_id, category_id, name, description, price, currency, is_vegetarian, prep_time_minutes) VALUES
  (v_venue_id, v_desserts_id, 'Chocolate Lava Cake', 'Warm chocolate cake with molten center, served with ice cream', 5000, 'RWF', true, 12),
  (v_venue_id, v_desserts_id, 'Tiramisu', 'Classic Italian coffee-flavored dessert', 4500, 'RWF', true, 5),
  (v_venue_id, v_desserts_id, 'Cheesecake', 'New York style cheesecake with berry compote', 4000, 'RWF', true, 5),
  (v_venue_id, v_desserts_id, 'Ice Cream Sundae', 'Three scoops with toppings of your choice', 3500, 'RWF', true, 5),
  (v_venue_id, v_desserts_id, 'Apple Pie', 'Warm apple pie with vanilla ice cream', 4000, 'RWF', true, 10);

  -- ============================================================================
  -- DRINKS
  -- ============================================================================
  
  INSERT INTO public.menu_items (venue_id, category_id, name, description, price, currency, prep_time_minutes) VALUES
  (v_venue_id, v_drinks_id, 'Primus Beer', 'Local Rwandan beer (330ml)', 1500, 'RWF', 2),
  (v_venue_id, v_drinks_id, 'Mutzig Beer', 'Premium lager (330ml)', 1500, 'RWF', 2),
  (v_venue_id, v_drinks_id, 'Skol Beer', 'Refreshing lager (330ml)', 1500, 'RWF', 2),
  (v_venue_id, v_drinks_id, 'Coca-Cola', 'Classic Coke (330ml)', 1000, 'RWF', 1),
  (v_venue_id, v_drinks_id, 'Fanta Orange', 'Orange soda (330ml)', 1000, 'RWF', 1),
  (v_venue_id, v_drinks_id, 'Sprite', 'Lemon-lime soda (330ml)', 1000, 'RWF', 1),
  (v_venue_id, v_drinks_id, 'Bottled Water', 'Still mineral water (500ml)', 500, 'RWF', 1),
  (v_venue_id, v_drinks_id, 'Fresh Orange Juice', 'Freshly squeezed orange juice', 2000, 'RWF', 5),
  (v_venue_id, v_drinks_id, 'Iced Tea', 'Lemon iced tea', 1500, 'RWF', 3);

  -- ============================================================================
  -- COCKTAILS
  -- ============================================================================
  
  INSERT INTO public.menu_items (venue_id, category_id, name, description, price, currency, is_popular, prep_time_minutes) VALUES
  (v_venue_id, v_cocktails_id, 'Mojito', 'White rum, mint, lime, soda water', 6000, 'RWF', true, 5),
  (v_venue_id, v_cocktails_id, 'Margarita', 'Tequila, triple sec, lime juice', 6000, 'RWF', true, 5),
  (v_venue_id, v_cocktails_id, 'Piña Colada', 'Rum, coconut cream, pineapple juice', 6500, 'RWF', true, 5),
  (v_venue_id, v_cocktails_id, 'Cosmopolitan', 'Vodka, triple sec, cranberry juice, lime', 6500, 'RWF', false, 5),
  (v_venue_id, v_cocktails_id, 'Long Island Iced Tea', 'Five spirits, cola, lemon', 7000, 'RWF', false, 5),
  (v_venue_id, v_cocktails_id, 'Passion Fruit Martini', 'Vodka, passion fruit, vanilla', 7000, 'RWF', true, 5),
  (v_venue_id, v_cocktails_id, 'Kigali Sunset', 'House special - rum, mango, lime, grenadine', 7500, 'RWF', true, 5);

  -- ============================================================================
  -- WINE
  -- ============================================================================
  
  INSERT INTO public.menu_items (venue_id, category_id, name, description, price, currency, prep_time_minutes) VALUES
  (v_venue_id, v_wine_id, 'Chardonnay (Glass)', 'California white wine', 4000, 'RWF', 2),
  (v_venue_id, v_wine_id, 'Sauvignon Blanc (Glass)', 'New Zealand white wine', 4500, 'RWF', 2),
  (v_venue_id, v_wine_id, 'Cabernet Sauvignon (Glass)', 'Chilean red wine', 4500, 'RWF', 2),
  (v_venue_id, v_wine_id, 'Merlot (Glass)', 'French red wine', 5000, 'RWF', 2),
  (v_venue_id, v_wine_id, 'Rosé (Glass)', 'Provence rosé wine', 4500, 'RWF', 2),
  (v_venue_id, v_wine_id, 'Prosecco (Glass)', 'Italian sparkling wine', 5000, 'RWF', 2),
  (v_venue_id, v_wine_id, 'House Red (Bottle)', 'Full-bodied red blend', 25000, 'RWF', 2),
  (v_venue_id, v_wine_id, 'House White (Bottle)', 'Crisp white blend', 25000, 'RWF', 2);

END $$;

COMMIT;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
\echo 'Seed data inserted successfully!'
\echo 'Demo venue: Heaven Bar & Restaurant (slug: heaven-bar)'
\echo '- 6 categories'
\echo '- 50+ menu items'
\echo ''
\echo 'Test URL: http://localhost:3002/heaven-bar?table=5'
