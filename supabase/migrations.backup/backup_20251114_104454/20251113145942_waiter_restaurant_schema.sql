BEGIN;

-- ============================================================================
-- Waiter AI PWA - Restaurant Schema
-- ============================================================================
-- Purpose: Add restaurant, menu, orders, and payment tables for Waiter AI
-- Strategy: Additive only - don't touch existing agent infrastructure
-- ============================================================================

-- Step 1: Restaurants Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  location GEOGRAPHY(POINT, 4326),
  timezone TEXT DEFAULT 'UTC',
  currency TEXT DEFAULT 'USD',
  default_language TEXT DEFAULT 'en',
  supported_languages TEXT[] DEFAULT ARRAY['en', 'fr', 'es', 'pt', 'de'],
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_restaurants_slug ON restaurants(slug);
CREATE INDEX idx_restaurants_active ON restaurants(is_active) WHERE is_active = true;

-- Step 2: Restaurant Tables (Physical tables in restaurant)
-- ============================================================================
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_number TEXT NOT NULL,
  qr_code TEXT UNIQUE NOT NULL,
  capacity INTEGER DEFAULT 4 CHECK (capacity > 0),
  floor TEXT,
  section TEXT,
  is_available BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(restaurant_id, table_number)
);

CREATE INDEX idx_restaurant_tables_restaurant ON restaurant_tables(restaurant_id);
CREATE INDEX idx_restaurant_tables_qr ON restaurant_tables(qr_code);
CREATE INDEX idx_restaurant_tables_available ON restaurant_tables(is_available) WHERE is_available = true;

-- Step 3: Menu Categories
-- ============================================================================
CREATE TABLE IF NOT EXISTS menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_translations JSONB DEFAULT '{}', -- {"en": "Starters", "fr": "Entrées"}
  description TEXT,
  description_translations JSONB DEFAULT '{}',
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_menu_categories_restaurant ON menu_categories(restaurant_id);
CREATE INDEX idx_menu_categories_sort ON menu_categories(restaurant_id, sort_order);
CREATE INDEX idx_menu_categories_active ON menu_categories(is_active) WHERE is_active = true;

-- Step 4: Menu Items
-- ============================================================================
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES menu_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  name_translations JSONB DEFAULT '{}',
  description TEXT,
  description_translations JSONB DEFAULT '{}',
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  currency TEXT DEFAULT 'USD',
  image_url TEXT,
  allergens TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_vegetarian BOOLEAN DEFAULT false,
  is_vegan BOOLEAN DEFAULT false,
  is_gluten_free BOOLEAN DEFAULT false,
  is_spicy BOOLEAN DEFAULT false,
  spice_level INTEGER CHECK (spice_level BETWEEN 0 AND 5),
  is_available BOOLEAN DEFAULT true,
  preparation_time INTEGER CHECK (preparation_time >= 0), -- minutes
  calories INTEGER,
  sort_order INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_menu_items_restaurant ON menu_items(restaurant_id);
CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_menu_items_available ON menu_items(is_available) WHERE is_available = true;
CREATE INDEX idx_menu_items_dietary ON menu_items(is_vegetarian, is_vegan, is_gluten_free);
CREATE INDEX idx_menu_items_tags ON menu_items USING GIN(tags);

-- Step 5: Orders
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  session_id TEXT,
  status TEXT DEFAULT 'draft',
  subtotal DECIMAL(10,2) DEFAULT 0 CHECK (subtotal >= 0),
  tax DECIMAL(10,2) DEFAULT 0 CHECK (tax >= 0),
  tip DECIMAL(10,2) DEFAULT 0 CHECK (tip >= 0),
  discount DECIMAL(10,2) DEFAULT 0 CHECK (discount >= 0),
  total DECIMAL(10,2) DEFAULT 0 CHECK (total >= 0),
  currency TEXT DEFAULT 'USD',
  payment_method TEXT,
  notes TEXT,
  special_instructions TEXT,
  language TEXT DEFAULT 'en',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CONSTRAINT valid_order_status CHECK (status IN (
    'draft', 'pending_payment', 'payment_failed', 'paid', 
    'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled'
  ))
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX idx_orders_table ON orders(table_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_session ON orders(session_id) WHERE session_id IS NOT NULL;

-- Step 6: Order Items
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  name_translations JSONB DEFAULT '{}',
  description TEXT,
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  subtotal DECIMAL(10,2) GENERATED ALWAYS AS (price * quantity) STORED,
  special_instructions TEXT,
  status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_item_status CHECK (status IN (
    'pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled'
  ))
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_menu_item ON order_items(menu_item_id);
CREATE INDEX idx_order_items_status ON order_items(status);

-- Step 7: Payments
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_transaction_id TEXT,
  provider_reference TEXT,
  status TEXT DEFAULT 'pending',
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL,
  phone_number TEXT,
  payment_method_details JSONB DEFAULT '{}',
  error_code TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  initiated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_payment_status CHECK (status IN (
    'pending', 'processing', 'authorized', 'successful', 
    'failed', 'cancelled', 'refunded', 'expired'
  )),
  CONSTRAINT valid_payment_provider CHECK (provider IN (
    'mtn_momo', 'revolut', 'stripe', 'mock', 'cash'
  ))
);

CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_provider ON payments(provider);
CREATE INDEX idx_payments_provider_ref ON payments(provider_reference) WHERE provider_reference IS NOT NULL;
CREATE INDEX idx_payments_created ON payments(created_at DESC);

-- Step 8: Reservations
-- ============================================================================
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_number TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL,
  guest_phone TEXT,
  guest_email TEXT,
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  duration_minutes INTEGER DEFAULT 120,
  status TEXT DEFAULT 'pending',
  special_requests TEXT,
  language TEXT DEFAULT 'en',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  CONSTRAINT valid_reservation_status CHECK (status IN (
    'pending', 'confirmed', 'cancelled', 'completed', 'no_show'
  ))
);

CREATE INDEX idx_reservations_restaurant ON reservations(restaurant_id);
CREATE INDEX idx_reservations_user ON reservations(user_id);
CREATE INDEX idx_reservations_table ON reservations(table_id);
CREATE INDEX idx_reservations_date ON reservations(reservation_date);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_number ON reservations(reservation_number);

-- Step 9: Wine Pairings (for recommend_wine tool)
-- ============================================================================
CREATE TABLE IF NOT EXISTS wine_pairings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_category TEXT NOT NULL,
  food_item TEXT NOT NULL,
  wine_name TEXT NOT NULL,
  wine_type TEXT NOT NULL,
  wine_varietal TEXT,
  region TEXT,
  description TEXT,
  description_translations JSONB DEFAULT '{}',
  confidence_score DECIMAL(3,2) DEFAULT 0.8 CHECK (confidence_score BETWEEN 0 AND 1),
  price_range TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_wine_type CHECK (wine_type IN (
    'red', 'white', 'rose', 'sparkling', 'dessert', 'fortified'
  ))
);

CREATE INDEX idx_wine_pairings_food_item ON wine_pairings(food_item);
CREATE INDEX idx_wine_pairings_food_category ON wine_pairings(food_category);
CREATE INDEX idx_wine_pairings_wine_type ON wine_pairings(wine_type);
CREATE INDEX idx_wine_pairings_confidence ON wine_pairings(confidence_score DESC);

-- Step 10: RLS Policies
-- ============================================================================

-- Restaurants: Public read for active restaurants
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "restaurants_public_read" ON restaurants 
FOR SELECT USING (is_active = true);

CREATE POLICY "restaurants_service_manage" ON restaurants 
FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Restaurant Tables: Public read for available tables
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tables_public_read" ON restaurant_tables 
FOR SELECT USING (is_available = true);

CREATE POLICY "tables_service_manage" ON restaurant_tables 
FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Menu Categories: Public read for active categories
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menu_categories_public_read" ON menu_categories 
FOR SELECT USING (is_active = true);

CREATE POLICY "menu_categories_service_manage" ON menu_categories 
FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Menu Items: Public read for available items
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menu_items_public_read" ON menu_items 
FOR SELECT USING (is_available = true);

CREATE POLICY "menu_items_service_manage" ON menu_items 
FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Orders: Users can manage their own orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_user_crud" ON orders 
FOR ALL USING (
  auth.uid() = user_id OR 
  auth.jwt()->>'role' = 'service_role'
);

-- Order Items: Access via order ownership
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_via_order" ON order_items 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_items.order_id 
    AND (orders.user_id = auth.uid() OR auth.jwt()->>'role' = 'service_role')
  )
);

-- Payments: Users can view their own payments, service role can manage
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_user_read" ON payments 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "payments_service_manage" ON payments 
FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Reservations: Users can manage their own reservations
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reservations_user_crud" ON reservations 
FOR ALL USING (
  auth.uid() = user_id OR 
  auth.jwt()->>'role' = 'service_role'
);

-- Wine Pairings: Public read
ALTER TABLE wine_pairings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wine_pairings_public_read" ON wine_pairings 
FOR SELECT USING (true);

CREATE POLICY "wine_pairings_service_manage" ON wine_pairings 
FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Step 11: Helper Functions
-- ============================================================================

-- Function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
         LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to generate reservation number
CREATE OR REPLACE FUNCTION generate_reservation_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'RES-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
         LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate order number
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_set_number
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION set_order_number();

-- Trigger to auto-generate reservation number
CREATE OR REPLACE FUNCTION set_reservation_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reservation_number IS NULL THEN
    NEW.reservation_number := generate_reservation_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reservations_set_number
BEFORE INSERT ON reservations
FOR EACH ROW
EXECUTE FUNCTION set_reservation_number();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER restaurants_updated_at BEFORE UPDATE ON restaurants
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER menu_categories_updated_at BEFORE UPDATE ON menu_categories
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER menu_items_updated_at BEFORE UPDATE ON menu_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER order_items_updated_at BEFORE UPDATE ON order_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER reservations_updated_at BEFORE UPDATE ON reservations
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Step 12: Comments for documentation
-- ============================================================================
COMMENT ON TABLE restaurants IS 'Restaurant locations and configuration';
COMMENT ON TABLE restaurant_tables IS 'Physical tables in restaurants with QR codes';
COMMENT ON TABLE menu_categories IS 'Menu categories with multilingual support';
COMMENT ON TABLE menu_items IS 'Menu items with prices, allergens, and dietary info';
COMMENT ON TABLE orders IS 'Customer orders with payment and fulfillment status';
COMMENT ON TABLE order_items IS 'Line items in orders';
COMMENT ON TABLE payments IS 'Payment transactions (MoMo, Revolut, etc)';
COMMENT ON TABLE reservations IS 'Table reservations';
COMMENT ON TABLE wine_pairings IS 'Wine pairing recommendations for dishes';

COMMIT;
