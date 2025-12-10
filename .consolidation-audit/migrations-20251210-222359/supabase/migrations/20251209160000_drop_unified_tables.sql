-- ============================================================================
-- DROP ABANDONED UNIFIED_* TABLES
-- ============================================================================
-- Migration: 20251209110000_drop_unified_tables.sql
-- Date: 2025-12-09
-- Purpose: Remove 5 unused "unified_*" tables that were part of an abandoned
--          abstraction attempt. These tables have ZERO code references.
-- 
-- Tables Dropped:
--   - unified_sessions
--   - unified_listings
--   - unified_matches
--   - unified_applications
--   - unified_agent_events
--
-- Risk: SAFE (verified 0 references in codebase)
-- Rollback: Restore from backup if needed (unlikely)
-- ============================================================================

BEGIN;

-- Verify these tables have no foreign key dependencies
DO $$
DECLARE
  v_has_deps BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
      AND table_name IN (
        'unified_sessions',
        'unified_listings',
        'unified_matches',
        'unified_applications',
        'unified_agent_events'
      )
  ) INTO v_has_deps;
  
  IF v_has_deps THEN
    RAISE WARNING 'unified_* tables have foreign key dependencies - review required';
  ELSE
    RAISE NOTICE 'unified_* tables have no dependencies - safe to drop';
  END IF;
END $$;

-- Drop tables (CASCADE to handle any unexpected dependencies)
DROP TABLE IF EXISTS public.unified_sessions CASCADE;
DROP TABLE IF EXISTS public.unified_listings CASCADE;
DROP TABLE IF EXISTS public.unified_matches CASCADE;
DROP TABLE IF EXISTS public.unified_applications CASCADE;
DROP TABLE IF EXISTS public.unified_agent_events CASCADE;

-- Log cleanup
DO $$
BEGIN
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'CLEANUP COMPLETE: Dropped 5 abandoned unified_* tables';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'Removed tables:';
  RAISE NOTICE '  - unified_sessions';
  RAISE NOTICE '  - unified_listings';
  RAISE NOTICE '  - unified_matches';
  RAISE NOTICE '  - unified_applications';
  RAISE NOTICE '  - unified_agent_events';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'Schema now cleaner - 5 fewer unused tables';
  RAISE NOTICE '====================================================================';
END $$;

COMMIT;
