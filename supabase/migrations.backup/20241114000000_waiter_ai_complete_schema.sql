BEGIN;

-- Complete Waiter AI Database Schema
-- This migration adds all missing tables required for the Waiter AI agent

-- 1. Menu items (enhanced with all required fields)
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID,
  category_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  image_url TEXT,
  tags TEXT[],
  dietary_info JSONB DEFAULT '{}',
  available BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Menu categories
CREATE TABLE IF NOT EXISTS menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Orders (completed orders)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID,
  table_number TEXT,
  status TEXT DEFAULT 'pending',
  total_amount NUMERIC(10, 2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  special_requests TEXT,
  estimated_time INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Order items
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(10, 2) NOT NULL,
  options JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  method TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  provider_transaction_id TEXT,
  provider_response JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 6. Feedback
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  categories JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view available menu items" ON menu_items;
DROP POLICY IF EXISTS "Anyone can view menu categories" ON menu_categories;
DROP POLICY IF EXISTS "Users can view their orders" ON orders;
DROP POLICY IF EXISTS "Users can create orders" ON orders;
DROP POLICY IF EXISTS "Users can update their orders" ON orders;
DROP POLICY IF EXISTS "Users can view their order items" ON order_items;
DROP POLICY IF EXISTS "Users can view their payments" ON payments;
DROP POLICY IF EXISTS "Users can manage their feedback" ON feedback;

-- RLS Policies
CREATE POLICY "Anyone can view available menu items"
  ON menu_items FOR SELECT
  USING (available = true);

CREATE POLICY "Anyone can view menu categories"
  ON menu_categories FOR SELECT
  USING (true);

CREATE POLICY "Users can view their orders"
  ON orders FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can create orders"
  ON orders FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can update their orders"
  ON orders FOR UPDATE
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can view their order items"
  ON order_items FOR SELECT
  USING (order_id IN (SELECT id FROM orders WHERE user_id = auth.uid() OR user_id IS NULL));

CREATE POLICY "Users can view their payments"
  ON payments FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can manage their feedback"
  ON feedback FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(available);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_feedback_order_id ON feedback(order_id);

-- Full-text search on menu
CREATE INDEX IF NOT EXISTS idx_menu_items_fts 
  ON menu_items USING gin(to_tsvector('english', name || ' ' || coalesce(description, '')));

-- Triggers
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample menu data
INSERT INTO menu_categories (name, description, sort_order) VALUES
  ('Starters', 'Appetizers and small plates', 1),
  ('Main Courses', 'Main dishes and entrees', 2),
  ('Desserts', 'Sweet treats and desserts', 3),
  ('Beverages', 'Drinks and cocktails', 4)
ON CONFLICT DO NOTHING;

-- Get category IDs
DO $$
DECLARE
  cat_starters UUID;
  cat_mains UUID;
  cat_desserts UUID;
  cat_beverages UUID;
BEGIN
  SELECT id INTO cat_starters FROM menu_categories WHERE name = 'Starters' LIMIT 1;
  SELECT id INTO cat_mains FROM menu_categories WHERE name = 'Main Courses' LIMIT 1;
  SELECT id INTO cat_desserts FROM menu_categories WHERE name = 'Desserts' LIMIT 1;
  SELECT id INTO cat_beverages FROM menu_categories WHERE name = 'Beverages' LIMIT 1;

  -- Insert sample menu items
  INSERT INTO menu_items (category_id, name, description, price, tags, dietary_info, available) VALUES
    (cat_starters, 'Caesar Salad', 'Fresh romaine, parmesan, croutons', 8.99, ARRAY['salad', 'vegetarian'], '{"vegetarian": true}', true),
    (cat_starters, 'Bruschetta', 'Toasted bread with tomatoes and basil', 7.99, ARRAY['italian', 'vegan'], '{"vegan": true, "gluten-free": false}', true),
    (cat_starters, 'Soup of the Day', 'Ask your server', 6.99, ARRAY['soup'], '{}', true),
    (cat_mains, 'Grilled Salmon', 'Atlantic salmon with vegetables', 22.99, ARRAY['fish', 'gluten-free'], '{"gluten-free": true}', true),
    (cat_mains, 'Ribeye Steak', '12oz ribeye, choice of sides', 32.99, ARRAY['beef', 'gluten-free'], '{"gluten-free": true}', true),
    (cat_mains, 'Pasta Primavera', 'Fresh vegetables in garlic sauce', 16.99, ARRAY['pasta', 'vegetarian'], '{"vegetarian": true}', true),
    (cat_mains, 'Chicken Alfredo', 'Creamy pasta with grilled chicken', 18.99, ARRAY['pasta', 'chicken'], '{}', true),
    (cat_desserts, 'Chocolate Lava Cake', 'Warm chocolate cake with vanilla ice cream', 8.99, ARRAY['chocolate', 'dessert'], '{"vegetarian": true}', true),
    (cat_desserts, 'Tiramisu', 'Classic Italian dessert', 7.99, ARRAY['italian', 'dessert'], '{"vegetarian": true}', true),
    (cat_desserts, 'Cheesecake', 'New York style cheesecake', 7.99, ARRAY['dessert'], '{"vegetarian": true}', true),
    (cat_beverages, 'House Wine', 'Red or White', 8.00, ARRAY['wine'], '{}', true),
    (cat_beverages, 'Craft Beer', 'Ask about our selection', 6.50, ARRAY['beer'], '{}', true),
    (cat_beverages, 'Soft Drink', 'Coca-Cola, Sprite, etc.', 2.99, ARRAY['soda'], '{}', true),
    (cat_beverages, 'Coffee', 'Freshly brewed', 3.50, ARRAY['coffee'], '{"vegan": true}', true)
  ON CONFLICT DO NOTHING;
END $$;

-- Insert sample wine pairings (if not already done)
INSERT INTO wine_pairings (dish, wine, description) VALUES
  ('Grilled Salmon', 'Chardonnay', 'A buttery Chardonnay complements the richness of salmon'),
  ('Ribeye Steak', 'Cabernet Sauvignon', 'Bold red wine pairs perfectly with red meat'),
  ('Pasta Primavera', 'Pinot Grigio', 'Light white wine enhances vegetable flavors'),
  ('Chicken Alfredo', 'Sauvignon Blanc', 'Crisp white wine cuts through creamy sauce')
ON CONFLICT DO NOTHING;

COMMIT;
