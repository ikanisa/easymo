BEGIN;

-- =========================================
-- WAITER AI COMPLETE SCHEMA MIGRATION
-- =========================================
-- Full schema for Waiter AI agent including:
-- - Conversations & Messages
-- - Menu & Orders
-- - Payments & Feedback
-- - Reservations & Wine Pairings
-- =========================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =========================================
-- CONVERSATIONS & MESSAGES
-- =========================================

CREATE TABLE IF NOT EXISTS waiter_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id TEXT,
  table_number TEXT,
  language TEXT DEFAULT 'en' CHECK (language IN ('en', 'fr', 'es', 'pt', 'de')),
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS waiter_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES waiter_conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- MENU SYSTEM
-- =========================================

CREATE TABLE IF NOT EXISTS menu_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES menu_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  image_url TEXT,
  tags TEXT[] DEFAULT '{}',
  dietary_info JSONB DEFAULT '{}',
  available BOOLEAN DEFAULT true,
  preparation_time INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- DRAFT ORDERS & CART
-- =========================================

CREATE TABLE IF NOT EXISTS draft_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES waiter_conversations(id) ON DELETE SET NULL,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal DECIMAL(10, 2) DEFAULT 0 CHECK (subtotal >= 0),
  tax DECIMAL(10, 2) DEFAULT 0 CHECK (tax >= 0),
  total DECIMAL(10, 2) DEFAULT 0 CHECK (total >= 0),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'cancelled')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS draft_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draft_order_id UUID REFERENCES draft_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
  total_price DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  options JSONB DEFAULT '{}',
  special_requests TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- ORDERS & ORDER ITEMS
-- =========================================

CREATE TABLE IF NOT EXISTS waiter_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES waiter_conversations(id) ON DELETE SET NULL,
  restaurant_id TEXT,
  table_number TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0),
  tax DECIMAL(10, 2) DEFAULT 0 CHECK (tax >= 0),
  tip DECIMAL(10, 2) DEFAULT 0 CHECK (tip >= 0),
  total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
  currency TEXT DEFAULT 'USD' CHECK (length(currency) = 3),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'successful', 'failed', 'refunded')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS waiter_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES waiter_orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
  total_price DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  options JSONB DEFAULT '{}',
  special_requests TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'served')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- PAYMENTS
-- =========================================

CREATE TABLE IF NOT EXISTS waiter_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES waiter_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (length(currency) = 3),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('momo', 'revolut', 'card', 'cash')),
  provider_transaction_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'successful', 'failed', 'refunded')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- WINE PAIRINGS
-- =========================================

CREATE TABLE IF NOT EXISTS wine_pairings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dish_name TEXT NOT NULL,
  dish_category TEXT,
  wine_name TEXT NOT NULL,
  wine_type TEXT CHECK (wine_type IN ('red', 'white', 'rose', 'sparkling', 'dessert')),
  wine_region TEXT,
  pairing_notes TEXT,
  confidence_score DECIMAL(3, 2) DEFAULT 0.5 CHECK (confidence_score BETWEEN 0 AND 1),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- RESERVATIONS
-- =========================================

CREATE TABLE IF NOT EXISTS waiter_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_code TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id TEXT,
  guest_name TEXT NOT NULL,
  guest_email TEXT,
  guest_phone TEXT,
  reservation_datetime TIMESTAMPTZ NOT NULL,
  party_size INTEGER NOT NULL CHECK (party_size > 0 AND party_size <= 20),
  special_requests TEXT,
  dietary_restrictions JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- FEEDBACK & RATINGS
-- =========================================

CREATE TABLE IF NOT EXISTS waiter_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES waiter_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  food_rating INTEGER CHECK (food_rating BETWEEN 1 AND 5),
  service_rating INTEGER CHECK (service_rating BETWEEN 1 AND 5),
  ambiance_rating INTEGER CHECK (ambiance_rating BETWEEN 1 AND 5),
  comment TEXT,
  tags TEXT[] DEFAULT '{}',
  would_recommend BOOLEAN,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- INDEXES FOR PERFORMANCE
-- =========================================

-- Conversations & Messages
CREATE INDEX IF NOT EXISTS idx_waiter_conversations_user_id ON waiter_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_waiter_conversations_status ON waiter_conversations(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_waiter_messages_conversation_id ON waiter_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_waiter_messages_timestamp ON waiter_messages(timestamp DESC);

-- Menu
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id) WHERE available = true;
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(available) WHERE available = true;
CREATE INDEX IF NOT EXISTS idx_menu_items_tags ON menu_items USING gin(tags);

-- Text search on menu
CREATE INDEX IF NOT EXISTS idx_menu_items_search ON menu_items USING gin(
  to_tsvector('english', name || ' ' || COALESCE(description, ''))
);
CREATE INDEX IF NOT EXISTS idx_menu_categories_name_trgm ON menu_categories USING gin(name gin_trgm_ops);

-- Orders
CREATE INDEX IF NOT EXISTS idx_waiter_orders_user_id ON waiter_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_waiter_orders_status ON waiter_orders(status);
CREATE INDEX IF NOT EXISTS idx_waiter_orders_payment_status ON waiter_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_waiter_orders_created_at ON waiter_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waiter_order_items_order_id ON waiter_order_items(order_id);

-- Draft Orders
CREATE INDEX IF NOT EXISTS idx_draft_orders_user_id ON draft_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_draft_orders_status ON draft_orders(status) WHERE status = 'draft';
CREATE INDEX IF NOT EXISTS idx_draft_order_items_user_id ON draft_order_items(user_id);

-- Payments
CREATE INDEX IF NOT EXISTS idx_waiter_payments_order_id ON waiter_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_waiter_payments_user_id ON waiter_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_waiter_payments_status ON waiter_payments(status);

-- Reservations
CREATE INDEX IF NOT EXISTS idx_waiter_reservations_user_id ON waiter_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_waiter_reservations_datetime ON waiter_reservations(reservation_datetime);
CREATE INDEX IF NOT EXISTS idx_waiter_reservations_status ON waiter_reservations(status);

-- Feedback
CREATE INDEX IF NOT EXISTS idx_waiter_feedback_order_id ON waiter_feedback(order_id);
CREATE INDEX IF NOT EXISTS idx_waiter_feedback_rating ON waiter_feedback(rating);

-- Wine Pairings
CREATE INDEX IF NOT EXISTS idx_wine_pairings_dish_name_trgm ON wine_pairings USING gin(dish_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_wine_pairings_active ON wine_pairings(active) WHERE active = true;

-- =========================================
-- ROW LEVEL SECURITY (RLS)
-- =========================================

ALTER TABLE waiter_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiter_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiter_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiter_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiter_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiter_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiter_feedback ENABLE ROW LEVEL SECURITY;

-- Public read for menu
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wine_pairings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Conversations
CREATE POLICY "Users can view their own conversations"
  ON waiter_conversations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create conversations"
  ON waiter_conversations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their conversations"
  ON waiter_conversations FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies: Messages
CREATE POLICY "Users can view their conversation messages"
  ON waiter_messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM waiter_conversations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in their conversations"
  ON waiter_messages FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM waiter_conversations WHERE user_id = auth.uid()
    )
  );

-- RLS Policies: Draft Orders
CREATE POLICY "Users can manage their draft orders"
  ON draft_orders FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can manage their draft order items"
  ON draft_order_items FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies: Orders
CREATE POLICY "Users can view their orders"
  ON waiter_orders FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create orders"
  ON waiter_orders FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their order items"
  ON waiter_order_items FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM waiter_orders WHERE user_id = auth.uid()
    )
  );

-- RLS Policies: Payments
CREATE POLICY "Users can view their payments"
  ON waiter_payments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create payments"
  ON waiter_payments FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS Policies: Reservations
CREATE POLICY "Users can manage their reservations"
  ON waiter_reservations FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies: Feedback
CREATE POLICY "Users can manage their feedback"
  ON waiter_feedback FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies: Menu (Public Read)
CREATE POLICY "Anyone can view active menu categories"
  ON menu_categories FOR SELECT
  USING (active = true);

CREATE POLICY "Anyone can view available menu items"
  ON menu_items FOR SELECT
  USING (available = true);

CREATE POLICY "Anyone can view active wine pairings"
  ON wine_pairings FOR SELECT
  USING (active = true);

-- =========================================
-- FUNCTIONS & TRIGGERS
-- =========================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_waiter_conversations_updated_at BEFORE UPDATE ON waiter_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_menu_categories_updated_at BEFORE UPDATE ON menu_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_draft_orders_updated_at BEFORE UPDATE ON draft_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_draft_order_items_updated_at BEFORE UPDATE ON draft_order_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_waiter_orders_updated_at BEFORE UPDATE ON waiter_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_waiter_order_items_updated_at BEFORE UPDATE ON waiter_order_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_waiter_payments_updated_at BEFORE UPDATE ON waiter_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wine_pairings_updated_at BEFORE UPDATE ON wine_pairings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_waiter_reservations_updated_at BEFORE UPDATE ON waiter_reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_waiter_feedback_updated_at BEFORE UPDATE ON waiter_feedback
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function: Generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  max_attempts INT := 10;
  attempt INT := 0;
BEGIN
  LOOP
    new_number := 'WO' || TO_CHAR(NOW(), 'YYMMDD') || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    
    IF NOT EXISTS (SELECT 1 FROM waiter_orders WHERE order_number = new_number) THEN
      RETURN new_number;
    END IF;
    
    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique order number after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function: Generate reservation code
CREATE OR REPLACE FUNCTION generate_reservation_code()
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  max_attempts INT := 10;
  attempt INT := 0;
BEGIN
  LOOP
    new_code := 'RES' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
    
    IF NOT EXISTS (SELECT 1 FROM waiter_reservations WHERE reservation_code = new_code) THEN
      RETURN new_code;
    END IF;
    
    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique reservation code after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-generate order number
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER waiter_orders_set_order_number BEFORE INSERT ON waiter_orders
  FOR EACH ROW EXECUTE FUNCTION set_order_number();

-- Trigger: Auto-generate reservation code
CREATE OR REPLACE FUNCTION set_reservation_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reservation_code IS NULL THEN
    NEW.reservation_code := generate_reservation_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER waiter_reservations_set_code BEFORE INSERT ON waiter_reservations
  FOR EACH ROW EXECUTE FUNCTION set_reservation_code();

-- =========================================
-- SEED DATA (Sample Menu Items)
-- =========================================

-- Insert sample menu categories
INSERT INTO menu_categories (name, description, sort_order, active) VALUES
  ('Starters', 'Appetizers and small plates', 1, true),
  ('Main Courses', 'Entrees and main dishes', 2, true),
  ('Desserts', 'Sweet endings', 3, true),
  ('Beverages', 'Drinks and refreshments', 4, true),
  ('Wine & Spirits', 'Alcoholic beverages', 5, true)
ON CONFLICT DO NOTHING;

-- Insert sample menu items (only if categories exist)
WITH category_ids AS (
  SELECT id, name FROM menu_categories
)
INSERT INTO menu_items (category_id, name, description, price, tags, available, preparation_time, sort_order)
SELECT 
  c.id,
  item.name,
  item.description,
  item.price,
  item.tags,
  true,
  item.prep_time,
  item.sort_order
FROM category_ids c
CROSS JOIN LATERAL (VALUES
  ('Starters', 'Caesar Salad', 'Crisp romaine, parmesan, croutons, classic dressing', 12.99, ARRAY['vegetarian', 'gluten-free-option'], 10, 1),
  ('Starters', 'Bruschetta', 'Toasted bread with tomatoes, basil, garlic', 9.99, ARRAY['vegan', 'vegetarian'], 8, 2),
  ('Starters', 'Calamari Fritti', 'Crispy fried squid with marinara sauce', 14.99, ARRAY['seafood'], 12, 3),
  ('Main Courses', 'Grilled Salmon', 'Atlantic salmon with roasted vegetables', 28.99, ARRAY['seafood', 'gluten-free'], 20, 1),
  ('Main Courses', 'Ribeye Steak', '12oz ribeye with mashed potatoes', 38.99, ARRAY['beef', 'gluten-free'], 25, 2),
  ('Main Courses', 'Vegetable Pasta', 'Seasonal vegetables in tomato sauce', 18.99, ARRAY['vegetarian', 'vegan-option'], 15, 3),
  ('Desserts', 'Tiramisu', 'Classic Italian dessert', 8.99, ARRAY['vegetarian'], 5, 1),
  ('Desserts', 'Chocolate Lava Cake', 'Warm chocolate cake with vanilla ice cream', 9.99, ARRAY['vegetarian'], 10, 2),
  ('Beverages', 'Espresso', 'Double shot', 3.99, ARRAY['hot', 'coffee'], 3, 1),
  ('Beverages', 'Fresh Orange Juice', 'Squeezed to order', 5.99, ARRAY['cold', 'fresh'], 5, 2)
) AS item(category_name, name, description, price, tags, prep_time, sort_order)
WHERE c.name = item.category_name
ON CONFLICT DO NOTHING;

-- Insert sample wine pairings
INSERT INTO wine_pairings (dish_name, dish_category, wine_name, wine_type, wine_region, pairing_notes, confidence_score, active) VALUES
  ('Grilled Salmon', 'Seafood', 'Chardonnay Reserve', 'white', 'California', 'Rich oak complements grilled flavors', 0.9, true),
  ('Ribeye Steak', 'Beef', 'Cabernet Sauvignon', 'red', 'Napa Valley', 'Bold tannins pair perfectly with red meat', 0.95, true),
  ('Vegetable Pasta', 'Vegetarian', 'Pinot Grigio', 'white', 'Italy', 'Light and crisp for delicate flavors', 0.85, true),
  ('Chocolate Lava Cake', 'Dessert', 'Port Wine', 'dessert', 'Portugal', 'Sweet wine enhances chocolate richness', 0.9, true)
ON CONFLICT DO NOTHING;

COMMIT;
