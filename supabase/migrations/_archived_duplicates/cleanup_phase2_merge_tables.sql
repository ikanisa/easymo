-- ============================================================================
-- SUPABASE DATABASE CLEANUP - PHASE 2: MERGE DUPLICATE TABLES
-- ============================================================================
-- Date: November 13, 2025
-- Purpose: Consolidate duplicate tables (shops→businesses, carts→draft_orders)
-- Run AFTER Phase 1 is complete
-- ============================================================================

BEGIN;

-- ============================================================================
-- MIGRATION 1: MERGE SHOPS → BUSINESSES
-- ============================================================================

-- Step 1: Add business_type column to businesses if not exists
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS business_type TEXT 
CHECK (business_type IN ('restaurant', 'bar', 'shop', 'service', 'property', 'other'));

-- Step 2: Migrate data from shops to businesses
DO $$
DECLARE
    shop_record RECORD;
    new_business_id UUID;
BEGIN
    -- Only run if shops table exists and has data
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shops') THEN
        RAISE NOTICE 'Migrating shops to businesses...';
        
        FOR shop_record IN SELECT * FROM shops LOOP
            -- Insert into businesses
            INSERT INTO businesses (
                id,
                name,
                description,
                phone,
                email,
                address,
                latitude,
                longitude,
                business_type,
                is_active,
                created_at,
                updated_at
            ) VALUES (
                shop_record.id,
                shop_record.name,
                shop_record.description,
                shop_record.phone,
                shop_record.email,
                shop_record.address,
                shop_record.latitude,
                shop_record.longitude,
                'shop',
                shop_record.is_active,
                shop_record.created_at,
                shop_record.updated_at
            )
            ON CONFLICT (id) DO UPDATE SET
                business_type = 'shop',
                updated_at = NOW();
        END LOOP;
        
        RAISE NOTICE 'Migrated % shops to businesses', (SELECT COUNT(*) FROM shops);
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'shops table does not exist, skipping migration';
END $$;

-- Step 3: Update foreign keys pointing to shops
DO $$
BEGIN
    -- Update orders if they reference shops
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'orders' AND column_name = 'shop_id') THEN
        
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
        
        UPDATE orders SET business_id = shop_id WHERE business_id IS NULL AND shop_id IS NOT NULL;
        
        RAISE NOTICE 'Updated orders.business_id from shop_id';
    END IF;
    
    -- Update other tables that reference shops
    -- Add more tables as needed
END $$;

-- Step 4: Drop shops table
DROP TABLE IF EXISTS shops CASCADE;
RAISE NOTICE 'Dropped shops table';

-- ============================================================================
-- MIGRATION 2: MERGE BARS → BUSINESSES
-- ============================================================================

-- Step 1: Migrate data from bars to businesses
DO $$
DECLARE
    bar_record RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bars') THEN
        RAISE NOTICE 'Migrating bars to businesses...';
        
        FOR bar_record IN SELECT * FROM bars LOOP
            INSERT INTO businesses (
                id,
                name,
                description,
                phone,
                address,
                latitude,
                longitude,
                business_type,
                is_active,
                created_at,
                updated_at
            ) VALUES (
                bar_record.id,
                bar_record.name,
                bar_record.description,
                bar_record.phone,
                bar_record.address,
                bar_record.latitude,
                bar_record.longitude,
                'bar',
                bar_record.is_active,
                bar_record.created_at,
                bar_record.updated_at
            )
            ON CONFLICT (id) DO UPDATE SET
                business_type = 'bar',
                updated_at = NOW();
        END LOOP;
        
        RAISE NOTICE 'Migrated % bars to businesses', (SELECT COUNT(*) FROM bars);
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'bars table does not exist, skipping migration';
END $$;

-- Step 2: Update foreign keys
DO $$
BEGIN
    -- Update orders
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'orders' AND column_name = 'bar_id') THEN
        
        UPDATE orders SET business_id = bar_id WHERE business_id IS NULL AND bar_id IS NOT NULL;
    END IF;
    
    -- Update bar_tables
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bar_tables') THEN
        ALTER TABLE bar_tables RENAME COLUMN bar_id TO business_id;
        ALTER TABLE bar_tables ADD CONSTRAINT bar_tables_business_id_fkey 
            FOREIGN KEY (business_id) REFERENCES businesses(id);
    END IF;
END $$;

-- Step 3: Drop bars table
DROP TABLE IF EXISTS bars CASCADE;
RAISE NOTICE 'Dropped bars table';

-- ============================================================================
-- MIGRATION 3: MERGE CARTS → DRAFT_ORDERS
-- ============================================================================

-- Step 1: Ensure draft_orders has necessary columns
ALTER TABLE draft_orders ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE draft_orders ADD COLUMN IF NOT EXISTS cart_metadata JSONB;

-- Step 2: Migrate carts to draft_orders
DO $$
DECLARE
    cart_record RECORD;
    new_draft_order_id UUID;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'carts') THEN
        RAISE NOTICE 'Migrating carts to draft_orders...';
        
        FOR cart_record IN SELECT * FROM carts LOOP
            -- Insert into draft_orders
            INSERT INTO draft_orders (
                user_id,
                business_id,
                status,
                total_amount,
                session_id,
                cart_metadata,
                created_at,
                updated_at
            ) VALUES (
                cart_record.user_id,
                cart_record.business_id,
                'pending',
                cart_record.total_amount,
                cart_record.session_id,
                jsonb_build_object('migrated_from_cart', true, 'original_cart_id', cart_record.id),
                cart_record.created_at,
                cart_record.updated_at
            )
            RETURNING id INTO new_draft_order_id;
            
            -- Migrate cart_items to draft_order_items
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cart_items') THEN
                INSERT INTO draft_order_items (
                    draft_order_id,
                    menu_item_id,
                    quantity,
                    unit_price,
                    subtotal,
                    created_at
                )
                SELECT
                    new_draft_order_id,
                    menu_item_id,
                    quantity,
                    unit_price,
                    quantity * unit_price,
                    created_at
                FROM cart_items
                WHERE cart_id = cart_record.id;
            END IF;
        END LOOP;
        
        RAISE NOTICE 'Migrated % carts to draft_orders', (SELECT COUNT(*) FROM carts);
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'carts table does not exist, skipping migration';
END $$;

-- Step 3: Drop cart tables
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS carts CASCADE;
RAISE NOTICE 'Dropped cart tables';

-- ============================================================================
-- MIGRATION 4: MERGE AGENT TABLES
-- ============================================================================

-- Merge ai_conversations → agent_conversations
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_conversations') THEN
        INSERT INTO agent_conversations (
            id,
            user_id,
            agent_type,
            context,
            status,
            metadata,
            created_at,
            updated_at
        )
        SELECT
            id,
            user_id,
            'ai_agent' as agent_type,
            context,
            status,
            jsonb_build_object('migrated_from', 'ai_conversations'),
            created_at,
            updated_at
        FROM ai_conversations
        ON CONFLICT (id) DO NOTHING;
        
        RAISE NOTICE 'Migrated ai_conversations to agent_conversations';
    END IF;
END $$;

-- Merge ai_messages → agent_messages
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_messages') THEN
        INSERT INTO agent_messages (
            id,
            conversation_id,
            role,
            content,
            metadata,
            created_at
        )
        SELECT
            id,
            conversation_id,
            role,
            content,
            jsonb_build_object('migrated_from', 'ai_messages'),
            created_at
        FROM ai_messages
        ON CONFLICT (id) DO NOTHING;
        
        RAISE NOTICE 'Migrated ai_messages to agent_messages';
    END IF;
END $$;

-- Merge agent_chat_sessions → agent_sessions
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_chat_sessions') THEN
        INSERT INTO agent_sessions (
            id,
            user_id,
            agent_id,
            status,
            metadata,
            created_at,
            updated_at
        )
        SELECT
            id,
            user_id,
            agent_id,
            status,
            jsonb_build_object('migrated_from', 'agent_chat_sessions'),
            created_at,
            updated_at
        FROM agent_chat_sessions
        ON CONFLICT (id) DO NOTHING;
        
        RAISE NOTICE 'Migrated agent_chat_sessions to agent_sessions';
    END IF;
END $$;

-- ============================================================================
-- MIGRATION 5: CONSOLIDATE CONFIG TABLES
-- ============================================================================

-- Create unified configurations table if not exists
CREATE TABLE IF NOT EXISTS configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope TEXT NOT NULL CHECK (scope IN ('app', 'bar', 'system', 'feature', 'business')),
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    business_id UUID REFERENCES businesses(id),
    description TEXT,
    is_encrypted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    UNIQUE(scope, key, business_id)
);

-- Migrate from settings
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'settings') THEN
        INSERT INTO configurations (scope, key, value, description)
        SELECT 
            'system',
            key,
            to_jsonb(value),
            'Migrated from settings table'
        FROM settings
        ON CONFLICT (scope, key, business_id) DO NOTHING;
        
        RAISE NOTICE 'Migrated settings to configurations';
    END IF;
END $$;

-- Migrate from app_config
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'app_config') THEN
        INSERT INTO configurations (scope, key, value, description)
        SELECT 
            'app',
            key,
            to_jsonb(value),
            'Migrated from app_config table'
        FROM app_config
        ON CONFLICT (scope, key, business_id) DO NOTHING;
        
        RAISE NOTICE 'Migrated app_config to configurations';
    END IF;
END $$;

-- Migrate from bar_settings
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bar_settings') THEN
        INSERT INTO configurations (scope, key, value, business_id, description)
        SELECT 
            'business',
            key,
            to_jsonb(value),
            bar_id,
            'Migrated from bar_settings table'
        FROM bar_settings
        ON CONFLICT (scope, key, business_id) DO NOTHING;
        
        RAISE NOTICE 'Migrated bar_settings to configurations';
    END IF;
END $$;

-- Drop old config tables
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS app_config CASCADE;
DROP TABLE IF EXISTS bar_settings CASCADE;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify migrations
DO $$
DECLARE
    businesses_count INTEGER;
    draft_orders_count INTEGER;
    agent_conversations_count INTEGER;
    configurations_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO businesses_count FROM businesses;
    SELECT COUNT(*) INTO draft_orders_count FROM draft_orders;
    SELECT COUNT(*) INTO agent_conversations_count FROM agent_conversations;
    SELECT COUNT(*) INTO configurations_count FROM configurations;
    
    RAISE NOTICE '=== MIGRATION VERIFICATION ===';
    RAISE NOTICE 'businesses: % rows', businesses_count;
    RAISE NOTICE 'draft_orders: % rows', draft_orders_count;
    RAISE NOTICE 'agent_conversations: % rows', agent_conversations_count;
    RAISE NOTICE 'configurations: % rows', configurations_count;
END $$;

-- ============================================================================
-- AUDIT LOG
-- ============================================================================

INSERT INTO database_cleanup_audit (phase, action, notes)
VALUES ('Phase 2', 'Merge Duplicate Tables', 
        'Merged shops→businesses, bars→businesses, carts→draft_orders, ai_*→agent_*, configs→configurations');

-- ============================================================================
-- COMMIT OR ROLLBACK
-- ============================================================================

-- Review output above, then:
-- ROLLBACK; -- to undo
-- Or COMMIT; -- to save changes

ROLLBACK; -- Change to COMMIT after verification

-- ============================================================================
-- END OF PHASE 2
-- ============================================================================
