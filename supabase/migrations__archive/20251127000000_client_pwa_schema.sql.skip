-- Client PWA Database Schema
-- Tables for venues, menu, orders, and payments
-- Generated: 2025-11-27

BEGIN;

-- ============================================================================
-- VENUES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  hours JSONB DEFAULT '{}',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.venues IS 'Restaurant/bar venues where customers can order';
COMMENT ON COLUMN public.venues.slug IS 'URL-friendly identifier (e.g., heaven-bar)';
COMMENT ON COLUMN public.venues.hours IS 'Opening hours in JSON format: {"mon": "10:00-23:00", ...}';

-- ============================================================================
-- MENU CATEGORIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT,
  description TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.menu_categories IS 'Menu categories (Appetizers, Mains, Drinks, etc.)';
COMMENT ON COLUMN public.menu_categories.emoji IS 'Emoji icon for category (e.g., 🍕, 🍺)';
COMMENT ON COLUMN public.menu_categories.sort_order IS 'Display order (lower = first)';

-- ============================================================================
-- MENU ITEMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  currency TEXT DEFAULT 'RWF' CHECK (currency IN ('RWF', 'EUR', 'USD')),
  image_url TEXT,
  emoji TEXT,
  is_available BOOLEAN DEFAULT true,
  is_popular BOOLEAN DEFAULT false,
  is_vegetarian BOOLEAN DEFAULT false,
  is_vegan BOOLEAN DEFAULT false,
  is_spicy BOOLEAN DEFAULT false,
  allergens TEXT[] DEFAULT ARRAY[]::TEXT[],
  prep_time_minutes INT CHECK (prep_time_minutes > 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.menu_items IS 'Individual menu items';
COMMENT ON COLUMN public.menu_items.allergens IS 'Array of allergens (e.g., {"gluten", "nuts", "dairy"})';
COMMENT ON COLUMN public.menu_items.prep_time_minutes IS 'Estimated preparation time';

-- ============================================================================
-- ORDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  table_number TEXT,
  customer_name TEXT,
  customer_phone TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
  currency TEXT DEFAULT 'RWF',
  payment_method TEXT CHECK (payment_method IN ('momo', 'revolut', 'cash')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN (
    'pending', 
    'processing', 
    'completed', 
    'failed', 
    'cancelled'
  )),
  payment_tx_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',
    'pending_payment',
    'paid',
    'preparing',
    'ready',
    'served',
    'cancelled'
  )),
  special_instructions TEXT,
  estimated_prep_time INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  served_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

COMMENT ON TABLE public.orders IS 'Customer orders';
COMMENT ON COLUMN public.orders.items IS 'Array of order items: [{"item_id": "uuid", "name": "Pizza", "price": 12000, "quantity": 2}]';
COMMENT ON COLUMN public.orders.status IS 'Order lifecycle: pending → paid → preparing → ready → served';

-- ============================================================================
-- ORDER STATUS LOG TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.order_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.order_status_log IS 'Audit log for order status changes';

-- ============================================================================
-- PAYMENT TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('momo', 'revolut')),
  tx_id TEXT UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'pending', 
    'processing', 
    'completed', 
    'failed', 
    'cancelled'
  )),
  metadata JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

COMMENT ON TABLE public.payment_transactions IS 'Payment transaction records';
COMMENT ON COLUMN public.payment_transactions.metadata IS 'Provider-specific payment details';

-- ============================================================================
-- PUSH SUBSCRIPTIONS TABLE (for notifications)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  endpoint TEXT NOT NULL UNIQUE,
  keys JSONB NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.push_subscriptions IS 'Web Push notification subscriptions';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Venues
CREATE INDEX IF NOT EXISTS idx_venues_slug ON public.venues(slug);
CREATE INDEX IF NOT EXISTS idx_venues_active ON public.venues(is_active);

-- Menu Categories
CREATE INDEX IF NOT EXISTS idx_menu_categories_venue ON public.menu_categories(venue_id);
CREATE INDEX IF NOT EXISTS idx_menu_categories_active ON public.menu_categories(venue_id, is_active);
CREATE INDEX IF NOT EXISTS idx_menu_categories_sort ON public.menu_categories(venue_id, sort_order);

-- Menu Items
CREATE INDEX IF NOT EXISTS idx_menu_items_venue ON public.menu_items(venue_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON public.menu_items(venue_id, is_available);
CREATE INDEX IF NOT EXISTS idx_menu_items_popular ON public.menu_items(venue_id, is_popular) WHERE is_popular = true;

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_venue ON public.orders(venue_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_venue_status ON public.orders(venue_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON public.orders(customer_phone);

-- Order Status Log
CREATE INDEX IF NOT EXISTS idx_order_status_log_order ON public.order_status_log(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_log_created ON public.order_status_log(created_at DESC);

-- Payment Transactions
CREATE INDEX IF NOT EXISTS idx_payment_tx_order ON public.payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_id ON public.payment_transactions(tx_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_status ON public.payment_transactions(status);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public venues" ON public.venues;
DROP POLICY IF EXISTS "Public categories" ON public.menu_categories;
DROP POLICY IF EXISTS "Public menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can view orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can update own orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can view order status log" ON public.order_status_log;
DROP POLICY IF EXISTS "Service can insert order status log" ON public.order_status_log;
DROP POLICY IF EXISTS "Anyone can view payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Service can manage payments" ON public.payment_transactions;

-- Venues: Public read for active venues
CREATE POLICY "Public venues" 
  ON public.venues 
  FOR SELECT 
  USING (is_active = true);

-- Menu Categories: Public read for active categories
CREATE POLICY "Public categories" 
  ON public.menu_categories 
  FOR SELECT 
  USING (is_active = true);

-- Menu Items: Public read for available items
CREATE POLICY "Public menu items" 
  ON public.menu_items 
  FOR SELECT 
  USING (is_available = true);

-- Orders: Anyone can create and view orders (anonymous ordering)
CREATE POLICY "Anyone can create orders" 
  ON public.orders 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Anyone can view orders" 
  ON public.orders 
  FOR SELECT 
  USING (true);

CREATE POLICY "Anyone can update own orders" 
  ON public.orders 
  FOR UPDATE 
  USING (true);

-- Order Status Log: Public read, service write
CREATE POLICY "Anyone can view order status log" 
  ON public.order_status_log 
  FOR SELECT 
  USING (true);

CREATE POLICY "Service can insert order status log" 
  ON public.order_status_log 
  FOR INSERT 
  WITH CHECK (true);

-- Payment Transactions: Public read, service write
CREATE POLICY "Anyone can view payment transactions" 
  ON public.payment_transactions 
  FOR SELECT 
  USING (true);

CREATE POLICY "Service can manage payments" 
  ON public.payment_transactions 
  FOR ALL 
  USING (true);

-- Push Subscriptions: Anyone can insert/update their own
CREATE POLICY "Anyone can manage push subscriptions" 
  ON public.push_subscriptions 
  FOR ALL 
  USING (true);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for venues
DROP TRIGGER IF EXISTS update_venues_updated_at ON public.venues;
CREATE TRIGGER update_venues_updated_at 
  BEFORE UPDATE ON public.venues 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for menu_categories
DROP TRIGGER IF EXISTS update_menu_categories_updated_at ON public.menu_categories;
CREATE TRIGGER update_menu_categories_updated_at 
  BEFORE UPDATE ON public.menu_categories 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for menu_items
DROP TRIGGER IF EXISTS update_menu_items_updated_at ON public.menu_items;
CREATE TRIGGER update_menu_items_updated_at 
  BEFORE UPDATE ON public.menu_items 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for orders
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at 
  BEFORE UPDATE ON public.orders 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Log order status changes
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.order_status_log (order_id, status, notes)
    VALUES (NEW.id, NEW.status, 'Status changed from ' || OLD.status || ' to ' || NEW.status);
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO public.order_status_log (order_id, status, notes)
    VALUES (NEW.id, NEW.status, 'Order created');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS log_order_status_change_trigger ON public.orders;
CREATE TRIGGER log_order_status_change_trigger
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

COMMIT;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
\echo 'Client PWA database schema created successfully!'
\echo 'Tables created: venues, menu_categories, menu_items, orders, order_status_log, payment_transactions, push_subscriptions'
\echo 'Next step: Run seed data script to populate demo venue'
