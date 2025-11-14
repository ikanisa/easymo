-- ============================================================================
-- SUPABASE DATABASE CLEANUP - PHASE 1: DELETE DUPLICATE TABLES
-- ============================================================================
-- Date: November 13, 2025
-- Purpose: Remove obvious duplicate and redundant tables
-- CRITICAL: CREATE BACKUP BEFORE RUNNING!
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 0: CREATE BACKUP (DO THIS FIRST!)
-- ============================================================================
-- Run this command BEFORE executing this script:
-- pg_dump -h db.lhbowpbcpwoiparwnwgt.supabase.co -U postgres -d postgres > backup_before_cleanup_$(date +%Y%m%d_%H%M%S).sql

-- ============================================================================
-- STEP 1: ANALYZE CURRENT STATE
-- ============================================================================

-- Check tables that will be deleted
DO $$
DECLARE
    tables_to_delete TEXT[] := ARRAY[
        'business', 
        'carts', 
        'cart_items', 
        'items', 
        'payments',
        'ai_conversations',
        'ai_messages',
        'agent_chat_sessions',
        'agent_chat_messages',
        'legacy_customer_profile',
        'bar_number_canonicalization_conflicts',
        'whatsapp_home_menu_items'
    ];
    tbl TEXT;
    row_count INTEGER;
BEGIN
    RAISE NOTICE '=== TABLES TO BE DELETED ===';
    FOREACH tbl IN ARRAY tables_to_delete
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', tbl) INTO row_count;
        RAISE NOTICE 'Table: % - Rows: %', tbl, row_count;
    EXCEPTION
        WHEN undefined_table THEN
            RAISE NOTICE 'Table: % - DOES NOT EXIST (OK)', tbl;
    END LOOP;
END $$;

-- ============================================================================
-- STEP 2: CHECK DEPENDENCIES
-- ============================================================================

-- Find foreign key dependencies for tables we want to delete
SELECT
    tc.table_name AS source_table,
    kcu.column_name AS source_column,
    ccu.table_name AS target_table,
    ccu.column_name AS target_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND (
        tc.table_name IN ('business', 'carts', 'cart_items', 'items', 'payments',
                          'ai_conversations', 'ai_messages', 'agent_chat_sessions',
                          'agent_chat_messages', 'legacy_customer_profile')
        OR ccu.table_name IN ('business', 'carts', 'cart_items', 'items', 'payments',
                              'ai_conversations', 'ai_messages', 'agent_chat_sessions',
                              'agent_chat_messages', 'legacy_customer_profile')
    )
ORDER BY source_table, target_table;

-- ============================================================================
-- STEP 3: DELETE TABLES WITHOUT DEPENDENCIES (Safe)
-- ============================================================================

-- Drop tables that likely have no dependencies
DROP TABLE IF EXISTS legacy_customer_profile CASCADE;
COMMENT ON SCHEMA public IS 'Dropped legacy_customer_profile - marked as legacy';

DROP TABLE IF EXISTS bar_number_canonicalization_conflicts CASCADE;
COMMENT ON SCHEMA public IS 'Dropped bar_number_canonicalization_conflicts - edge case table';

DROP TABLE IF EXISTS whatsapp_home_menu_items CASCADE;
COMMENT ON SCHEMA public IS 'Dropped whatsapp_home_menu_items - use menu_items with is_featured flag';

-- ============================================================================
-- STEP 4: DELETE DUPLICATE TABLE 'business' (if exists)
-- ============================================================================

-- Check if 'business' is actually a duplicate of 'businesses'
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'business') THEN
        -- Check if it has different data than 'businesses'
        RAISE NOTICE 'Checking if business table is truly a duplicate...';
        
        -- Option A: If it's empty, just drop it
        IF (SELECT COUNT(*) FROM business) = 0 THEN
            DROP TABLE business CASCADE;
            RAISE NOTICE 'Dropped empty business table';
        ELSE
            -- Option B: If it has data, we need to migrate first
            RAISE WARNING 'business table has data! Manual review needed before deletion';
            -- Uncomment below after manual review:
            -- DROP TABLE business CASCADE;
        END IF;
    END IF;
END $$;

-- ============================================================================
-- STEP 5: DELETE DUPLICATE CART TABLES
-- ============================================================================

-- Before deleting, verify data is migrated to draft_orders
DO $$
DECLARE
    carts_count INTEGER;
    draft_orders_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO carts_count FROM carts;
    SELECT COUNT(*) INTO draft_orders_count FROM draft_orders WHERE status = 'pending';
    
    RAISE NOTICE 'Carts table has % rows', carts_count;
    RAISE NOTICE 'Draft orders (pending) has % rows', draft_orders_count;
    
    IF carts_count > 0 THEN
        RAISE WARNING 'carts table has data! Migrate to draft_orders first';
        RAISE NOTICE 'Run migration script: scripts/migrate_carts_to_draft_orders.sql';
    ELSE
        DROP TABLE IF EXISTS cart_items CASCADE;
        DROP TABLE IF EXISTS carts CASCADE;
        RAISE NOTICE 'Dropped empty cart tables';
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'Cart tables do not exist (OK)';
END $$;

-- ============================================================================
-- STEP 6: DELETE DUPLICATE 'items' TABLE
-- ============================================================================

DO $$
DECLARE
    items_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO items_count FROM items;
    
    IF items_count > 0 THEN
        RAISE WARNING 'items table has % rows! Check if its different from menu_items', items_count;
        -- Manual review needed
    ELSE
        DROP TABLE IF EXISTS items CASCADE;
        RAISE NOTICE 'Dropped empty items table';
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'items table does not exist (OK)';
END $$;

-- ============================================================================
-- STEP 7: DELETE DUPLICATE 'payments' TABLE  
-- ============================================================================

DO $$
BEGIN
    -- Check if payments is different from transactions
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
        -- Check for dependencies first
        RAISE NOTICE 'Checking payments table...';
        
        -- If empty, drop it
        IF (SELECT COUNT(*) FROM payments) = 0 THEN
            DROP TABLE payments CASCADE;
            RAISE NOTICE 'Dropped empty payments table';
        ELSE
            RAISE WARNING 'payments table has data! Review before deletion';
            -- After review: DROP TABLE payments CASCADE;
        END IF;
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'payments table does not exist (OK)';
END $$;

-- ============================================================================
-- STEP 8: CONSOLIDATE AI/AGENT TABLES
-- ============================================================================

-- Drop duplicate AI tables (after migrating to agent_* tables)
DO $$
BEGIN
    -- Check if ai_conversations has data
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_conversations') THEN
        IF (SELECT COUNT(*) FROM ai_conversations) = 0 THEN
            DROP TABLE IF EXISTS ai_tool_executions CASCADE;
            DROP TABLE IF EXISTS ai_embeddings CASCADE;
            DROP TABLE IF EXISTS ai_messages CASCADE;
            DROP TABLE IF EXISTS ai_conversations CASCADE;
            DROP TABLE IF EXISTS ai_tools CASCADE;
            DROP TABLE IF EXISTS ai_metrics CASCADE;
            DROP TABLE IF EXISTS ai_prompt_templates CASCADE;
            DROP TABLE IF EXISTS ai_feedback CASCADE;
            RAISE NOTICE 'Dropped empty ai_* tables';
        ELSE
            RAISE WARNING 'ai_conversations has data! Migrate to agent_conversations first';
        END IF;
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'ai_* tables do not exist (OK)';
END $$;

-- Drop duplicate agent chat tables
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_chat_sessions') THEN
        IF (SELECT COUNT(*) FROM agent_chat_sessions) = 0 THEN
            DROP TABLE IF EXISTS agent_chat_messages CASCADE;
            DROP TABLE IF EXISTS agent_chat_sessions CASCADE;
            RAISE NOTICE 'Dropped empty agent_chat_* tables';
        ELSE
            RAISE WARNING 'agent_chat_sessions has data! Migrate to agent_sessions first';
        END IF;
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'agent_chat_* tables do not exist (OK)';
END $$;

-- ============================================================================
-- STEP 9: VERIFY DELETIONS
-- ============================================================================

-- List remaining tables
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 50;

-- Count total tables
SELECT COUNT(*) as total_tables 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- ============================================================================
-- STEP 10: CREATE AUDIT LOG
-- ============================================================================

-- Log what was deleted
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

-- Log Phase 1 completion
INSERT INTO database_cleanup_audit (phase, action, notes)
VALUES ('Phase 1', 'Delete Duplicate Tables', 'Deleted obvious duplicate tables. See comments for details.');

-- ============================================================================
-- ROLLBACK or COMMIT
-- ============================================================================

-- IMPORTANT: Review all warnings above before committing!
-- If you see warnings about data, ROLLBACK and migrate data first

-- To rollback: ROLLBACK;
-- To commit: COMMIT;

-- Recommend: Test on staging first, then run on production

ROLLBACK; -- Change to COMMIT after reviewing warnings

-- ============================================================================
-- END OF PHASE 1
-- ============================================================================

-- NEXT STEPS:
-- 1. Review warnings from this script
-- 2. Run data migration scripts for tables with data
-- 3. Run Phase 2: Merge Tables (separate script)
-- 4. Run Phase 3: Add Missing Columns (separate script)
