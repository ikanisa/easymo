-- ============================================================================
-- DIRECT EXECUTION: Phase 3 + Phase 1
-- ============================================================================
-- Run this in Supabase SQL Editor
-- ============================================================================

\echo 'Starting Phase 3: Adding Missing Columns...'
\echo ''

-- Phase 3: Add Missing Columns
\i supabase/migrations/20251113171400_phase3_add_missing_columns.sql

\echo ''
\echo 'Phase 3 Complete!'
\echo ''
\echo 'Starting Phase 1: Careful Deletion...'
\echo ''

-- Phase 1: Careful Deletion
\i supabase/migrations/20251113173000_careful_deletion_phase1.sql

\echo ''
\echo 'Phase 1 Complete!'
\echo ''
\echo '=== FINAL SUMMARY ==='

SELECT 
    phase,
    action,
    table_name,
    rows_affected,
    executed_at,
    notes
FROM database_cleanup_audit
ORDER BY executed_at DESC
LIMIT 20;

SELECT COUNT(*) as remaining_tables
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE';

\echo ''
\echo '✅ DATABASE CLEANUP COMPLETE!'

