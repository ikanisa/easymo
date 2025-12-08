-- ============================================================================
-- MOBILITY TABLES ASSESSMENT
-- ============================================================================
-- Purpose: Analyze current state of mobility tables before consolidation
-- Run this FIRST before any migration
-- ============================================================================

\echo '============================================================================'
\echo 'MOBILITY TABLES ASSESSMENT REPORT'
\echo '============================================================================'
\echo ''

-- 1. Check which tables exist
\echo '1. TABLE EXISTENCE CHECK'
\echo '------------------------'
SELECT 
  table_name,
  pg_size_pretty(pg_total_relation_size(quote_ident(table_schema)||'.'||quote_ident(table_name))) AS size
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'trips', 
    'rides_trips', 
    'mobility_trips',
    'mobility_matches', 
    'mobility_trip_matches',
    'pending_trips', 
    'pending_ride_request', 
    'ride_driver_status', 
    'mobility_trips_compact',
    'ride_notifications',
    'trip_payment_requests',
    'trip_status_audit',
    'recurring_trips',
    'mobility_intents'
  )
ORDER BY table_name;

\echo ''
\echo '2. DATA ROW COUNTS'
\echo '------------------'

-- Safely count rows for each table (only if exists)
DO $$
DECLARE
  table_record RECORD;
  row_count INTEGER;
BEGIN
  FOR table_record IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('trips', 'rides_trips', 'mobility_trips', 'mobility_matches', 'mobility_trip_matches', 'recurring_trips', 'mobility_intents')
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I', table_record.table_name) INTO row_count;
    RAISE NOTICE '% : % rows', table_record.table_name, row_count;
  END LOOP;
END $$;

\echo ''
\echo '3. FOREIGN KEY DEPENDENCIES'
\echo '----------------------------'
SELECT 
  tc.table_name AS dependent_table, 
  kcu.column_name AS fk_column,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column,
  tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND (
    ccu.table_name IN ('trips', 'rides_trips', 'mobility_trips', 'mobility_matches', 'mobility_trip_matches')
    OR tc.table_name IN ('trip_payment_requests', 'trip_status_audit', 'ride_notifications', 'mobility_matches', 'mobility_trip_matches')
  )
ORDER BY tc.table_name, kcu.column_name;

\echo ''
\echo '4. FUNCTIONS USING OLD TABLES'
\echo '------------------------------'
SELECT 
  p.proname AS function_name,
  CASE 
    WHEN pg_get_functiondef(p.oid) LIKE '%rides_trips%' THEN 'rides_trips'
    WHEN pg_get_functiondef(p.oid) LIKE '%mobility_trip_matches%' THEN 'mobility_trip_matches'
    WHEN pg_get_functiondef(p.oid) LIKE '%mobility_trips%' THEN 'mobility_trips'
  END AS references_table
FROM pg_proc p
WHERE p.proname LIKE '%match%' 
   OR p.proname LIKE '%trip%'
   OR p.proname LIKE '%recurring%'
ORDER BY p.proname;

\echo ''
\echo '5. RECENT TRIP ACTIVITY (Last 24 hours)'
\echo '----------------------------------------'

-- Check trips table if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trips') THEN
    RAISE NOTICE 'trips table:';
    PERFORM NULL;
    EXECUTE 'SELECT COUNT(*), MIN(created_at), MAX(created_at) FROM trips WHERE created_at > NOW() - INTERVAL ''24 hours''';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rides_trips') THEN
    RAISE NOTICE 'rides_trips table:';
    PERFORM NULL;
    EXECUTE 'SELECT COUNT(*), MIN(created_at), MAX(created_at) FROM rides_trips WHERE created_at > NOW() - INTERVAL ''24 hours''';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mobility_trips') THEN
    RAISE NOTICE 'mobility_trips table:';
    PERFORM NULL;
    EXECUTE 'SELECT COUNT(*), MIN(created_at), MAX(created_at) FROM mobility_trips WHERE created_at > NOW() - INTERVAL ''24 hours''';
  END IF;
END $$;

\echo ''
\echo '6. STATUS DISTRIBUTION'
\echo '----------------------'

-- Check status values in each table
DO $$
DECLARE
  table_record RECORD;
BEGIN
  FOR table_record IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('trips', 'rides_trips', 'mobility_trips')
  LOOP
    RAISE NOTICE 'Table: %', table_record.table_name;
    EXECUTE format('SELECT status, COUNT(*) FROM %I GROUP BY status', table_record.table_name);
  END LOOP;
END $$;

\echo ''
\echo '7. ORPHANED RECORDS CHECK'
\echo '-------------------------'

-- Check for mobility_matches without corresponding trips
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mobility_matches')
    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trips') THEN
    
    RAISE NOTICE 'Checking mobility_matches orphans...';
    EXECUTE 'SELECT COUNT(*) AS orphaned_matches 
             FROM mobility_matches mm 
             WHERE NOT EXISTS (SELECT 1 FROM trips t WHERE t.id = mm.trip_id)';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mobility_trip_matches')
    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mobility_trips') THEN
    
    RAISE NOTICE 'Checking mobility_trip_matches orphans...';
    EXECUTE 'SELECT COUNT(*) AS orphaned_trip_matches 
             FROM mobility_trip_matches mtm 
             WHERE NOT EXISTS (
               SELECT 1 FROM mobility_trips mt 
               WHERE mt.id = mtm.driver_trip_id OR mt.id = mtm.passenger_trip_id
             )';
  END IF;
END $$;

\echo ''
\echo '8. SCHEMA COMPARISON'
\echo '--------------------'

-- Compare column structures
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('trips', 'rides_trips', 'mobility_trips')
  AND column_name IN ('id', 'creator_user_id', 'role', 'status', 'vehicle_type', 'pickup_latitude', 'pickup_longitude')
ORDER BY column_name, table_name;

\echo ''
\echo '============================================================================'
\echo 'ASSESSMENT COMPLETE'
\echo ''
\echo 'NEXT STEPS:'
\echo '1. Review the counts and dependencies above'
\echo '2. Identify which tables have data that needs migration'
\echo '3. Check MOBILITY_DATABASE_CONSOLIDATION_PLAN.md for migration strategy'
\echo '4. Run backup script before proceeding: ./scripts/backup_mobility_tables.sh'
\echo '============================================================================'
