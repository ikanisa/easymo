-- Migration: Standardize Waiter AI Table References
-- Created: 2025-12-10
-- Purpose: Create compatibility views for inconsistent table naming
--          This allows code to use different table names while maintaining
--          a single source of truth.

BEGIN;

-- ============================================================================
-- Menu Tables
-- ============================================================================

-- Create view for legacy 'restaurant_menu_items' references
-- Primary table is 'menu_items'
CREATE OR REPLACE VIEW restaurant_menu_items AS 
SELECT 
  id, 
  restaurant_id as bar_id,
  name, 
  name_translations,
  description, 
  price, 
  currency,
  category, 
  tags, 
  available as is_available,
  is_vegetarian,
  is_vegan,
  is_gluten_free,
  is_spicy,
  image_url,
  sort_order,
  created_at, 
  updated_at
FROM menu_items;

COMMENT ON VIEW restaurant_menu_items IS 
  'Compatibility view for legacy code. Use menu_items table in new code.';

-- ============================================================================
-- Order Tables
-- ============================================================================

-- Create view for 'bar_orders' (dine-in orders only)
CREATE OR REPLACE VIEW bar_orders AS 
SELECT * FROM orders WHERE order_type = 'dine_in';

COMMENT ON VIEW bar_orders IS 
  'Dine-in orders only. Use orders table with WHERE order_type = ''dine_in'' in new code.';

-- Create view for 'draft_orders' (unpaid orders)
CREATE OR REPLACE VIEW draft_orders AS 
SELECT * FROM orders WHERE status = 'draft';

COMMENT ON VIEW draft_orders IS 
  'Draft (unpaid) orders. Use orders table with WHERE status = ''draft'' in new code.';

-- ============================================================================
-- Payment Tables
-- ============================================================================

-- Create view for 'payment_transactions' references
-- Primary table is 'payments'
CREATE OR REPLACE VIEW payment_transactions AS 
SELECT 
  id,
  order_id,
  user_id,
  provider,
  amount,
  currency,
  status,
  phone_number,
  payment_link,
  ussd_code,
  payment_instructions,
  confirmed_by_user_at,
  confirmation_method,
  error_message,
  created_at,
  updated_at
FROM payments;

COMMENT ON VIEW payment_transactions IS 
  'Compatibility view for legacy code. Use payments table in new code.';

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Ensure menu_items has proper indexes
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_available 
  ON menu_items(restaurant_id, available) 
  WHERE available = true;

CREATE INDEX IF NOT EXISTS idx_menu_items_category 
  ON menu_items(category);

CREATE INDEX IF NOT EXISTS idx_menu_items_tags 
  ON menu_items USING gin(tags);

-- Ensure orders has proper indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_status 
  ON orders(user_id, status);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status 
  ON orders(restaurant_id, status);

CREATE INDEX IF NOT EXISTS idx_orders_type 
  ON orders(order_type);

-- Ensure payments has proper indexes
CREATE INDEX IF NOT EXISTS idx_payments_order 
  ON payments(order_id);

CREATE INDEX IF NOT EXISTS idx_payments_user_status 
  ON payments(user_id, status);

CREATE INDEX IF NOT EXISTS idx_payments_status 
  ON payments(status);

-- ============================================================================
-- Documentation
-- ============================================================================

COMMENT ON TABLE menu_items IS 
  'Primary menu items table. All menu data should reference this table.';

COMMENT ON TABLE orders IS 
  'Primary orders table. Supports multiple order types: dine_in, delivery, takeout.';

COMMENT ON TABLE payments IS 
  'Primary payments table. Supports MTN MoMo, Airtel Money, Revolut, and Cash.';

COMMIT;
