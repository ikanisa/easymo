-- ============================================================================
-- SUPABASE DATABASE CLEANUP - PHASE 3: ADD MISSING COLUMNS
-- ============================================================================
-- Date: November 13, 2025
-- Purpose: Add missing columns to ensure complete schema
-- Run AFTER Phase 1 and Phase 2 (or standalone - safest to run first)
-- ============================================================================

BEGIN;

-- ============================================================================
-- WAITER AI TABLES - ADD MISSING COLUMNS
-- ============================================================================

-- waiter_conversations: Add missing columns
ALTER TABLE waiter_conversations 
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS business_id UUID,
  ADD COLUMN IF NOT EXISTS wa_thread_id UUID;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_waiter_conversations_business_id ON waiter_conversations(business_id);
CREATE INDEX IF NOT EXISTS idx_waiter_conversations_wa_thread_id ON waiter_conversations(wa_thread_id);
CREATE INDEX IF NOT EXISTS idx_waiter_conversations_last_message_at ON waiter_conversations(last_message_at DESC);

-- waiter_messages: Add missing columns
ALTER TABLE waiter_messages
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tool_calls JSONB,
  ADD COLUMN IF NOT EXISTS citations JSONB,
  ADD COLUMN IF NOT EXISTS sources JSONB,
  ADD COLUMN IF NOT EXISTS error TEXT,
  ADD COLUMN IF NOT EXISTS tokens_used INTEGER,
  ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;

-- waiter_orders: Add missing columns
ALTER TABLE waiter_orders
  ADD COLUMN IF NOT EXISTS business_id UUID,
  ADD COLUMN IF NOT EXISTS table_number TEXT,
  ADD COLUMN IF NOT EXISTS special_instructions TEXT,
  ADD COLUMN IF NOT EXISTS estimated_ready_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_ready_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_address JSONB,
  ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_fee DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tip_amount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS order_type TEXT CHECK (order_type IN ('dine_in', 'takeaway', 'delivery')),
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS wa_message_id UUID;

CREATE INDEX IF NOT EXISTS idx_waiter_orders_business_id ON waiter_orders(business_id);
CREATE INDEX IF NOT EXISTS idx_waiter_orders_status ON waiter_orders(status);
CREATE INDEX IF NOT EXISTS idx_waiter_orders_created_at ON waiter_orders(created_at DESC);

-- waiter_reservations: Add missing columns
ALTER TABLE waiter_reservations
  ADD COLUMN IF NOT EXISTS business_id UUID,
  ADD COLUMN IF NOT EXISTS table_number TEXT,
  ADD COLUMN IF NOT EXISTS special_requests TEXT,
  ADD COLUMN IF NOT EXISTS occasion TEXT,
  ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmation_code TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_waiter_reservations_business_id ON waiter_reservations(business_id);
CREATE INDEX IF NOT EXISTS idx_waiter_reservations_reservation_time ON waiter_reservations(reservation_time);

-- ============================================================================
-- BUSINESSES TABLE - ADD MISSING COLUMNS
-- ============================================================================

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS business_type TEXT CHECK (business_type IN ('restaurant', 'bar', 'shop', 'service', 'property', 'other')),
  ADD COLUMN IF NOT EXISTS cuisine_type TEXT[],
  ADD COLUMN IF NOT EXISTS opening_hours JSONB,
  ADD COLUMN IF NOT EXISTS delivery_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS takeaway_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS dine_in_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS reservations_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS average_prep_time INTEGER,
  ADD COLUMN IF NOT EXISTS min_order_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS delivery_radius_km DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_number_id UUID,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS social_media JSONB,
  ADD COLUMN IF NOT EXISTS payment_methods TEXT[],
  ADD COLUMN IF NOT EXISTS features TEXT[];

CREATE INDEX IF NOT EXISTS idx_businesses_business_type ON businesses(business_type);
CREATE INDEX IF NOT EXISTS idx_businesses_rating ON businesses(rating DESC);

-- ============================================================================
-- MENU TABLES - ADD MISSING COLUMNS
-- ============================================================================

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS business_id UUID,
  ADD COLUMN IF NOT EXISTS category_id UUID,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS allergens TEXT[],
  ADD COLUMN IF NOT EXISTS dietary_info JSONB,
  ADD COLUMN IF NOT EXISTS preparation_time INTEGER,
  ADD COLUMN IF NOT EXISTS calories INTEGER,
  ADD COLUMN IF NOT EXISTS spice_level INTEGER CHECK (spice_level BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS tags TEXT[],
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variants JSONB,
  ADD COLUMN IF NOT EXISTS options JSONB;

CREATE INDEX IF NOT EXISTS idx_menu_items_business_id ON menu_items(business_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_available ON menu_items(is_available);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_featured ON menu_items(is_featured);

ALTER TABLE menu_categories
  ADD COLUMN IF NOT EXISTS business_id UUID,
  ADD COLUMN IF NOT EXISTS parent_category_id UUID,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_menu_categories_business_id ON menu_categories(business_id);

-- ============================================================================
-- AUDIT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS database_cleanup_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phase TEXT NOT NULL,
    action TEXT NOT NULL,
    table_name TEXT,
    rows_affected INTEGER,
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    executed_by TEXT DEFAULT current_user,
    notes TEXT
);

INSERT INTO database_cleanup_audit (phase, action, notes)
VALUES ('Phase 3', 'Add Missing Columns', 'Added missing columns to waiter_*, businesses, menu_* tables for complete functionality');

-- ============================================================================
-- COMMIT
-- ============================================================================

COMMIT;
-- ============================================================================
-- PHASE 1: CAREFUL DELETION OF UNNECESSARY TABLES
-- ============================================================================
-- Date: November 13, 2025
-- CRITICAL: This script deletes tables - ONLY run after verification
-- ============================================================================

BEGIN;

-- Create audit table first
CREATE TABLE IF NOT EXISTS database_cleanup_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phase TEXT NOT NULL,
    action TEXT NOT NULL,
    table_name TEXT,
    rows_affected INTEGER,
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    executed_by TEXT DEFAULT current_user,
    notes TEXT
);

\echo '=== PHASE 1: CAREFUL DELETION ==='
\echo ''

-- ============================================================================
-- STEP 1: DELETE OBVIOUSLY SAFE TABLES (NO DEPENDENCIES, NO DATA RISK)
-- ============================================================================

-- 1.1 legacy_customer_profile (marked as legacy - safe to delete)
DO $$
DECLARE
    row_count INTEGER;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'legacy_customer_profile') THEN
        SELECT COUNT(*) INTO row_count FROM legacy_customer_profile;
        RAISE NOTICE 'Dropping legacy_customer_profile (% rows)', row_count;
        
        INSERT INTO database_cleanup_audit (phase, action, table_name, rows_affected, notes)
        VALUES ('Phase 1', 'DROP TABLE', 'legacy_customer_profile', row_count, 'Legacy table - safe to remove');
        
        DROP TABLE IF EXISTS legacy_customer_profile CASCADE;
        RAISE NOTICE '✓ Dropped legacy_customer_profile';
    ELSE
        RAISE NOTICE '⊗ legacy_customer_profile does not exist';
    END IF;
END $$;

-- 1.2 bar_number_canonicalization_conflicts (edge case - safe to delete)
DO $$
DECLARE
    row_count INTEGER;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bar_number_canonicalization_conflicts') THEN
        SELECT COUNT(*) INTO row_count FROM bar_number_canonicalization_conflicts;
        RAISE NOTICE 'Dropping bar_number_canonicalization_conflicts (% rows)', row_count;
        
        INSERT INTO database_cleanup_audit (phase, action, table_name, rows_affected, notes)
        VALUES ('Phase 1', 'DROP TABLE', 'bar_number_canonicalization_conflicts', row_count, 'Edge case table - safe to remove');
        
        DROP TABLE IF EXISTS bar_number_canonicalization_conflicts CASCADE;
        RAISE NOTICE '✓ Dropped bar_number_canonicalization_conflicts';
    ELSE
        RAISE NOTICE '⊗ bar_number_canonicalization_conflicts does not exist';
    END IF;
END $$;

-- 1.3 whatsapp_home_menu_items (use menu_items with is_featured flag instead)
DO $$
DECLARE
    row_count INTEGER;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'whatsapp_home_menu_items') THEN
        SELECT COUNT(*) INTO row_count FROM whatsapp_home_menu_items;
        
        IF row_count > 0 THEN
            RAISE WARNING 'whatsapp_home_menu_items has % rows - SKIPPING. Migrate data first!', row_count;
        ELSE
            RAISE NOTICE 'Dropping whatsapp_home_menu_items (% rows)', row_count;
            
            INSERT INTO database_cleanup_audit (phase, action, table_name, rows_affected, notes)
            VALUES ('Phase 1', 'DROP TABLE', 'whatsapp_home_menu_items', row_count, 'Empty - use menu_items.is_featured instead');
            
            DROP TABLE IF EXISTS whatsapp_home_menu_items CASCADE;
            RAISE NOTICE '✓ Dropped whatsapp_home_menu_items';
        END IF;
    ELSE
        RAISE NOTICE '⊗ whatsapp_home_menu_items does not exist';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: DELETE DUPLICATE TABLES (ONLY IF EMPTY)
-- ============================================================================

-- 2.1 'business' table (if duplicate of 'businesses')
DO $$
DECLARE
    row_count INTEGER;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'business') THEN
        SELECT COUNT(*) INTO row_count FROM business;
        
        IF row_count = 0 THEN
            RAISE NOTICE 'Dropping empty business table (% rows)', row_count;
            
            INSERT INTO database_cleanup_audit (phase, action, table_name, rows_affected, notes)
            VALUES ('Phase 1', 'DROP TABLE', 'business', row_count, 'Empty duplicate of businesses table');
            
            DROP TABLE IF EXISTS business CASCADE;
            RAISE NOTICE '✓ Dropped business';
        ELSE
            RAISE WARNING 'business table has % rows - SKIPPING! Manual review required', row_count;
        END IF;
    ELSE
        RAISE NOTICE '⊗ business table does not exist';
    END IF;
END $$;

-- 2.2 'items' table (if duplicate of 'menu_items')
DO $$
DECLARE
    row_count INTEGER;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'items') THEN
        SELECT COUNT(*) INTO row_count FROM items;
        
        IF row_count = 0 THEN
            RAISE NOTICE 'Dropping empty items table (% rows)', row_count;
            
            INSERT INTO database_cleanup_audit (phase, action, table_name, rows_affected, notes)
            VALUES ('Phase 1', 'DROP TABLE', 'items', row_count, 'Empty - use menu_items instead');
            
            DROP TABLE IF EXISTS items CASCADE;
            RAISE NOTICE '✓ Dropped items';
        ELSE
            RAISE WARNING 'items table has % rows - SKIPPING! Check if different from menu_items', row_count;
        END IF;
    ELSE
        RAISE NOTICE '⊗ items table does not exist';
    END IF;
END $$;

-- 2.3 'payments' table (if duplicate of 'transactions')
DO $$
DECLARE
    row_count INTEGER;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
        SELECT COUNT(*) INTO row_count FROM payments;
        
        IF row_count = 0 THEN
            RAISE NOTICE 'Dropping empty payments table (% rows)', row_count;
            
            INSERT INTO database_cleanup_audit (phase, action, table_name, rows_affected, notes)
            VALUES ('Phase 1', 'DROP TABLE', 'payments', row_count, 'Empty - use transactions instead');
            
            DROP TABLE IF EXISTS payments CASCADE;
            RAISE NOTICE '✓ Dropped payments';
        ELSE
            RAISE WARNING 'payments table has % rows - SKIPPING! Review before deletion', row_count;
        END IF;
    ELSE
        RAISE NOTICE '⊗ payments table does not exist';
    END IF;
END $$;

-- ============================================================================
-- STEP 3: DELETE CART TABLES (ONLY IF EMPTY - OTHERWISE SKIP)
-- ============================================================================

-- 3.1 Check carts and cart_items
DO $$
DECLARE
    cart_items_count INTEGER := 0;
    carts_count INTEGER := 0;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cart_items') THEN
        SELECT COUNT(*) INTO cart_items_count FROM cart_items;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'carts') THEN
        SELECT COUNT(*) INTO carts_count FROM carts;
    END IF;
    
    IF cart_items_count = 0 AND carts_count = 0 THEN
        RAISE NOTICE 'Dropping empty cart tables (cart_items: %, carts: %)', cart_items_count, carts_count;
        
        INSERT INTO database_cleanup_audit (phase, action, table_name, rows_affected, notes)
        VALUES ('Phase 1', 'DROP TABLE', 'cart_items', cart_items_count, 'Empty - use draft_order_items instead');
        
        INSERT INTO database_cleanup_audit (phase, action, table_name, rows_affected, notes)
        VALUES ('Phase 1', 'DROP TABLE', 'carts', carts_count, 'Empty - use draft_orders instead');
        
        DROP TABLE IF EXISTS cart_items CASCADE;
        DROP TABLE IF EXISTS carts CASCADE;
        RAISE NOTICE '✓ Dropped cart_items and carts';
    ELSE
        RAISE WARNING 'Cart tables have data (cart_items: %, carts: %) - SKIPPING! Migrate to draft_orders first', cart_items_count, carts_count;
    END IF;
END $$;

-- ============================================================================
-- STEP 4: DELETE AI/AGENT DUPLICATE TABLES (ONLY IF EMPTY)
-- ============================================================================

-- 4.1 ai_* tables
DO $$
DECLARE
    ai_conversations_count INTEGER := 0;
    ai_messages_count INTEGER := 0;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_conversations') THEN
        SELECT COUNT(*) INTO ai_conversations_count FROM ai_conversations;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_messages') THEN
        SELECT COUNT(*) INTO ai_messages_count FROM ai_messages;
    END IF;
    
    IF ai_conversations_count = 0 AND ai_messages_count = 0 THEN
        RAISE NOTICE 'Dropping empty AI tables (ai_conversations: %, ai_messages: %)', ai_conversations_count, ai_messages_count;
        
        -- Drop in correct order (messages first, then conversations)
        DROP TABLE IF EXISTS ai_tool_executions CASCADE;
        DROP TABLE IF EXISTS ai_embeddings CASCADE;
        DROP TABLE IF EXISTS ai_messages CASCADE;
        DROP TABLE IF EXISTS ai_conversations CASCADE;
        DROP TABLE IF EXISTS ai_tools CASCADE;
        DROP TABLE IF EXISTS ai_metrics CASCADE;
        DROP TABLE IF EXISTS ai_prompt_templates CASCADE;
        DROP TABLE IF EXISTS ai_feedback CASCADE;
        
        INSERT INTO database_cleanup_audit (phase, action, table_name, rows_affected, notes)
        VALUES ('Phase 1', 'DROP TABLES', 'ai_*', 0, 'Empty AI tables - use agent_* tables instead');
        
        RAISE NOTICE '✓ Dropped ai_* tables';
    ELSE
        RAISE WARNING 'AI tables have data (conversations: %, messages: %) - SKIPPING! Migrate to agent_* first', ai_conversations_count, ai_messages_count;
    END IF;
END $$;

-- 4.2 agent_chat_* tables (duplicates of agent_sessions/messages)
DO $$
DECLARE
    agent_chat_sessions_count INTEGER := 0;
    agent_chat_messages_count INTEGER := 0;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_chat_sessions') THEN
        SELECT COUNT(*) INTO agent_chat_sessions_count FROM agent_chat_sessions;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_chat_messages') THEN
        SELECT COUNT(*) INTO agent_chat_messages_count FROM agent_chat_messages;
    END IF;
    
    IF agent_chat_sessions_count = 0 AND agent_chat_messages_count = 0 THEN
        RAISE NOTICE 'Dropping empty agent_chat tables (sessions: %, messages: %)', agent_chat_sessions_count, agent_chat_messages_count;
        
        DROP TABLE IF EXISTS agent_chat_messages CASCADE;
        DROP TABLE IF EXISTS agent_chat_sessions CASCADE;
        
        INSERT INTO database_cleanup_audit (phase, action, table_name, rows_affected, notes)
        VALUES ('Phase 1', 'DROP TABLES', 'agent_chat_*', 0, 'Empty - use agent_sessions/messages instead');
        
        RAISE NOTICE '✓ Dropped agent_chat_* tables';
    ELSE
        RAISE WARNING 'agent_chat tables have data (sessions: %, messages: %) - SKIPPING! Migrate to agent_sessions first', agent_chat_sessions_count, agent_chat_messages_count;
    END IF;
END $$;

-- ============================================================================
-- FINAL SUMMARY
-- ============================================================================

\echo ''
\echo '=== DELETION SUMMARY ==='

SELECT 
    phase,
    action,
    table_name,
    rows_affected,
    executed_at,
    notes
FROM database_cleanup_audit
WHERE phase = 'Phase 1'
ORDER BY executed_at DESC;

\echo ''
\echo '=== REMAINING TABLE COUNT ==='

SELECT COUNT(*) as total_tables
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE';

COMMIT;

\echo ''
\echo '✓ PHASE 1 COMPLETE - Review results above'
