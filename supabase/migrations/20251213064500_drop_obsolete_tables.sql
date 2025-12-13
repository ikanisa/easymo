-- Drop Obsolete Tables Migration
-- Generated: 2025-12-13T06:45:00Z
-- Purpose: Remove tables for deprecated services (Venue/Menu, SACCO, Insurance Agents, Legacy Agents)
-- 
-- Services being removed:
-- 1. Venue/Menu (Waiter Agent - deprecated)
-- 2. SACCO app schema (SACCO service - deprecated)
-- 3. Insurance legacy tables (consolidated elsewhere)
-- 4. Legacy agent tables (replaced by new agent system)

BEGIN;

-- ============================================================================
-- 1. VENUE/MENU TABLES (Waiter Agent - Deprecated)
-- ============================================================================
-- These tables were part of the Waiter AI agent which was removed in Day 9-10 cleanup
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS menu_categories CASCADE;
DROP TABLE IF EXISTS venues CASCADE;
DROP TABLE IF EXISTS qr_tokens CASCADE;

-- ============================================================================
-- 2. SACCO TABLES (app schema - Deprecated)
-- ============================================================================
-- SACCO service has been deprecated and removed
DROP TABLE IF EXISTS app.payments CASCADE;
DROP TABLE IF EXISTS app.accounts CASCADE;
DROP TABLE IF EXISTS app.members CASCADE;
DROP TABLE IF EXISTS app.ikimina CASCADE;
DROP TABLE IF EXISTS app.saccos CASCADE;

-- Drop app schema if now empty
DO $$ 
DECLARE
    table_count INTEGER;
BEGIN
    -- Count remaining tables in app schema
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'app';
    
    -- Only drop schema if completely empty
    IF table_count = 0 THEN
        DROP SCHEMA IF EXISTS app CASCADE;
        RAISE NOTICE 'Dropped empty app schema';
    ELSE
        RAISE NOTICE 'app schema still has % tables, keeping schema', table_count;
    END IF;
END $$;

-- ============================================================================
-- 3. INSURANCE LEGACY TABLES (Deprecated - consolidated elsewhere)
-- ============================================================================
-- These tables have been consolidated into the main insurance workflow tables
DROP TABLE IF EXISTS insurance_media_queue CASCADE;
DROP TABLE IF EXISTS insurance_claims CASCADE;
DROP TABLE IF EXISTS insurance_leads CASCADE;
DROP TABLE IF EXISTS insurance_policies CASCADE;

-- ============================================================================
-- 4. LEGACY AGENT TABLES (Deprecated)
-- ============================================================================
-- Old agent system tables, replaced by new agent architecture
DROP TABLE IF EXISTS agent_performance_metrics CASCADE;
DROP TABLE IF EXISTS agent_traces CASCADE;
DROP TABLE IF EXISTS agent_registry CASCADE;
DROP TABLE IF EXISTS matches CASCADE;

-- ============================================================================
-- 5. DUPLICATE SACCO TABLES IN PUBLIC SCHEMA
-- ============================================================================
-- These tables were duplicated in public schema, app schema versions already dropped above
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.members CASCADE;

COMMIT;

-- ============================================================================
-- VERIFICATION: Check if any tables still exist
-- ============================================================================
DO $$
DECLARE
    remaining_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_count
    FROM pg_tables 
    WHERE tablename IN (
        'venues', 'menu_items', 'menu_categories', 'orders', 'qr_tokens',
        'saccos', 'ikimina', 'members', 'accounts', 'payments',
        'insurance_policies', 'insurance_claims', 'insurance_leads', 'insurance_media_queue',
        'agent_registry', 'agent_traces', 'agent_performance_metrics', 'matches'
    )
    AND schemaname IN ('public', 'app');
    
    IF remaining_count > 0 THEN
        RAISE WARNING 'Still have % obsolete tables remaining - manual review needed', remaining_count;
    ELSE
        RAISE NOTICE 'All obsolete tables successfully dropped ✓';
    END IF;
END $$;
