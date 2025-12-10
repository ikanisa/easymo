-- Validation script to ensure all fixes are applied correctly
BEGIN;

-- Check that critical tables exist
DO $$
DECLARE
  required_tables TEXT[] := ARRAY[
    'profiles', 'businesses', 'orders', 'menus', 'menu_items',
    'mobility_requests', 'wallet_accounts', 'wallet_transactions', 
    'agent_registry', 'business_categories', 'insurance_requests',
    'remote_sync_status'
  ];
  missing_tables TEXT[] := '{}';
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY required_tables
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      missing_tables := array_append(missing_tables, tbl);
    END IF;
  END LOOP;
  
  IF array_length(missing_tables, 1) > 0 THEN
    RAISE WARNING 'Missing required tables: %', missing_tables;
  ELSE
    RAISE NOTICE '✅ All required tables exist';
  END IF;
END $$;

-- Verify no basket/sacco/campaign tables exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('baskets', 'baskets_reminders', 'saccos', 'campaigns')
  ) THEN
    RAISE WARNING 'Deprecated tables still exist!';
  ELSE
    RAISE NOTICE '✅ No deprecated tables found';
  END IF;
END $$;

-- Check critical columns exist
DO $$
DECLARE
  missing_columns TEXT[] := '{}';
BEGIN
  -- Check mobility_requests has loc column
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mobility_requests') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'mobility_requests' 
      AND column_name = 'loc'
    ) THEN
      missing_columns := array_append(missing_columns, 'mobility_requests.loc');
    END IF;
  END IF;
  
  -- Check profiles has agent_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'agent_id'
  ) THEN
    missing_columns := array_append(missing_columns, 'profiles.agent_id');
  END IF;
  
  IF array_length(missing_columns, 1) > 0 THEN
    RAISE WARNING 'Missing critical columns: %', missing_columns;
  ELSE
    RAISE NOTICE '✅ All critical columns exist';
  END IF;
END $$;

-- Verify storage buckets
DO $$
DECLARE
  bucket_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO bucket_count
  FROM storage.buckets 
  WHERE id IN ('profiles', 'documents', 'kyc');
  
  IF bucket_count < 3 THEN
    RAISE WARNING 'Some storage buckets may be missing (found: %)', bucket_count;
  ELSE
    RAISE NOTICE '✅ Storage buckets configured';
  END IF;
END $$;

-- Check RLS policies
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'profiles';
  
  IF policy_count = 0 THEN
    RAISE WARNING 'No RLS policies found on profiles table';
  ELSE
    RAISE NOTICE '✅ RLS policies configured (% policies found)', policy_count;
  END IF;
END $$;

COMMIT;

-- Summary report
\echo ''
\echo '╔════════════════════════════════════════════════════════════════╗'
\echo '║                  DATABASE VALIDATION SUMMARY                   ║'
\echo '╚════════════════════════════════════════════════════════════════╝'
\echo ''

SELECT 
  'Tables' as category,
  COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'
UNION ALL
SELECT 
  'Indexes' as category,
  COUNT(*) as count
FROM pg_indexes
WHERE schemaname = 'public'
UNION ALL
SELECT 
  'Functions' as category,
  COUNT(*) as count
FROM information_schema.routines
WHERE routine_schema = 'public'
UNION ALL
SELECT 
  'Triggers' as category,
  COUNT(*) as count
FROM information_schema.triggers
WHERE trigger_schema = 'public'
UNION ALL
SELECT 
  'RLS Policies' as category,
  COUNT(*) as count
FROM pg_policies
WHERE schemaname = 'public';

\echo ''
\echo 'Validation complete! Check for any WARNINGs above.'
\echo ''
