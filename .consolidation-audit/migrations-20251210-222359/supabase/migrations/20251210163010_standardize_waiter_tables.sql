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
DO $$
DECLARE
  column_expr TEXT := 'NULL::uuid';
  required_columns TEXT[] := ARRAY[
    'name',
    'name_translations',
    'description',
    'price',
    'currency',
    'category',
    'tags',
    'available',
    'is_vegetarian',
    'is_vegan',
    'is_gluten_free',
    'is_spicy',
    'image_url',
    'sort_order',
    'created_at',
    'updated_at'
  ];
  column_count INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'menu_items' AND column_name = 'restaurant_id'
  ) THEN
    column_expr := 'restaurant_id';
  ELSIF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'menu_items' AND column_name = 'business_id'
  ) THEN
    column_expr := 'business_id';
  ELSIF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'menu_items' AND column_name = 'bar_id'
  ) THEN
    column_expr := 'bar_id';
  END IF;

  column_count := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_name = 'menu_items'
      AND column_name = ANY(required_columns)
  );

  IF column_count = array_length(required_columns, 1) THEN                                  
    EXECUTE format($sql$                                                                    
      CREATE OR REPLACE VIEW restaurant_menu_items AS                                       
      SELECT                                                                                
        id,                                                                                 
        %s AS restaurant_id,                                                                
        name,                                                                               
        name_translations,                                                                  
        description,                                                                        
        price,                                                                              
        currency,                                                                           
        category,                                                                           
        tags,                                                                               
        available AS is_available,                                                          
        is_vegetarian,                                                                      
        is_vegan,                                                                           
        is_gluten_free,                                                                     
        is_spicy,                                                                           
        image_url,                                                                          
        sort_order,                                                                         
        created_at,                                                                         
        updated_at                                                                          
      FROM menu_items;                                                                      
    $sql$, column_expr);                                                                    

    EXECUTE 'COMMENT ON VIEW restaurant_menu_items IS ''Compatibility view for legacy code. Use menu_items table in new code.''';
  ELSE                                                                                      
    RAISE NOTICE 'Skipping restaurant_menu_items view; menu_items missing required columns';
  END IF;                                                                                   
END;
$$;

-- ============================================================================
-- Order Tables
-- ============================================================================

-- Create view for 'bar_orders' (dine-in orders only)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'orders'
  ) THEN
    EXECUTE $sql$
      CREATE OR REPLACE VIEW bar_orders AS
      SELECT * FROM orders WHERE order_type = 'dine_in';
    $sql$;
    EXECUTE $sql$
      COMMENT ON VIEW bar_orders IS 
      'Dine-in orders only. Use orders table with WHERE order_type = ''dine_in'' in new code.';
    $sql$;
  ELSE
    RAISE NOTICE 'Skipping bar_orders view; orders table missing';
  END IF;
END;
$$;

-- Create view for 'draft_orders' (unpaid orders)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'orders'
  ) THEN
    EXECUTE $sql$
      CREATE OR REPLACE VIEW draft_orders AS
      SELECT * FROM orders WHERE status = 'draft';
    $sql$;
    EXECUTE $sql$
      COMMENT ON VIEW draft_orders IS 
      'Draft (unpaid) orders. Use orders table with WHERE status = ''draft'' in new code.';
    $sql$;
  ELSE
    RAISE NOTICE 'Skipping draft_orders view; orders table missing';
  END IF;
END;
$$;

-- ============================================================================
-- Payment Tables
-- ============================================================================

-- Create view for 'payment_transactions' references
-- Primary table is 'payments'
DO $$
DECLARE
  required_columns TEXT[] := ARRAY[
    'order_id',
    'user_id',
    'provider',
    'amount',
    'currency',
    'status',
    'phone_number',
    'payment_link',
    'ussd_code',
    'payment_instructions',
    'confirmed_by_user_at',
    'confirmation_method',
    'error_message',
    'created_at',
    'updated_at'
  ];
  column_count INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'payments'
  ) THEN
    column_count := (
      SELECT COUNT(*)
      FROM information_schema.columns
      WHERE table_name = 'payments'
        AND column_name = ANY(required_columns)
    );

    IF column_count = array_length(required_columns, 1) THEN
      EXECUTE $sql$
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
      $sql$;
      EXECUTE 'COMMENT ON VIEW payment_transactions IS ''Compatibility view for legacy code. Use payments table in new code.''';
    ELSE
      RAISE NOTICE 'Skipping payment_transactions view; payments table missing required columns';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping payment_transactions view; payments table missing';
  END IF;
END;
$$;

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Ensure menu_items has proper indexes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'menu_items' AND column_name = 'business_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_menu_items_business_available 
      ON menu_items(business_id, available) 
      WHERE available = true;
  ELSIF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'menu_items' AND column_name = 'restaurant_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_available 
      ON menu_items(restaurant_id, available) 
      WHERE available = true;
  ELSIF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'menu_items' AND column_name = 'bar_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_menu_items_bar_available 
      ON menu_items(bar_id, available) 
      WHERE available = true;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'menu_items' AND column_name = 'category'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_menu_items_category 
      ON menu_items(category);
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'menu_items' AND column_name = 'tags'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_menu_items_tags 
      ON menu_items USING gin(tags);
  END IF;
END;
$$;

-- Ensure orders has proper indexes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_name = 'orders'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_orders_user_status 
      ON orders(user_id, status);

    CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status 
      ON orders(restaurant_id, status);

    CREATE INDEX IF NOT EXISTS idx_orders_type 
      ON orders(order_type);
  END IF;
END;
$$;

-- Ensure payments has proper indexes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_name = 'payments'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'payments' AND column_name = 'order_id'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_payments_order 
        ON payments(order_id);
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'payments' AND column_name = 'user_id'
    ) AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'payments' AND column_name = 'status'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_payments_user_status 
        ON payments(user_id, status);
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'payments' AND column_name = 'status'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_payments_status 
        ON payments(status);
    END IF;
  END IF;
END;
$$;

-- ============================================================================
-- Documentation
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'menu_items'
  ) THEN
    COMMENT ON TABLE menu_items IS 
      'Primary menu items table. All menu data should reference this table.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'orders'
  ) THEN
    COMMENT ON TABLE orders IS 
      'Primary orders table. Supports multiple order types: dine_in, delivery, takeout.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'payments'
  ) THEN
    COMMENT ON TABLE payments IS 
      'Primary payments table. Supports MTN MoMo, Airtel Money, Revolut, and Cash.';
  END IF;
END;
$$;

COMMIT;
