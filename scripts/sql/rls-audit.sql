-- RLS Audit Query
-- Run this to find tables without RLS or with weak policies

\echo '=== EasyMO RLS Security Audit ==='
\echo ''

-- Step 1: Find all tables without RLS enabled
\echo '1. Tables WITHOUT RLS enabled:'
\echo ''

SELECT 
  schemaname,
  tablename,
  '⚠️  NO RLS ENABLED' as issue
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename NOT IN (
    SELECT tablename 
    FROM pg_catalog.pg_policies 
    WHERE schemaname = 'public'
  )
  AND tablename NOT LIKE 'pg_%'
  AND tablename NOT LIKE '_prisma_%'
ORDER BY tablename;

\echo ''
\echo '2. Tables with RLS enabled but NO policies:'
\echo ''

SELECT 
  c.relname as tablename,
  '⚠️  RLS ENABLED BUT NO POLICIES' as issue
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity = true
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p 
    WHERE p.tablename = c.relname 
      AND p.schemaname = 'public'
  );

\echo ''
\echo '3. Existing RLS policies audit:'
\echo ''

SELECT 
  tablename,
  policyname,
  CASE cmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END as operation,
  roles,
  CASE 
    WHEN qual::text LIKE '%true%' THEN '⚠️  PERMISSIVE'
    WHEN qual::text LIKE '%auth.uid()%' THEN '✅ Uses auth.uid()'
    WHEN qual::text LIKE '%service_role%' THEN '✅ Service role'
    WHEN qual IS NULL THEN '⚠️  NO QUAL'
    ELSE '❓ REVIEW'
  END as assessment
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

\echo ''
\echo '4. Financial tables audit:'
\echo ''

SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'wallet_accounts',
    'wallet_entries', 
    'wallet_transactions',
    'payments',
    'payment_intents',
    'momo_transactions'
  )
GROUP BY tablename
ORDER BY tablename;

\echo ''
\echo '=== Audit Complete ==='
