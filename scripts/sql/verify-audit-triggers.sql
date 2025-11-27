-- Verification Script: Audit Triggers and RLS
-- Purpose: Verify production readiness of financial table security
-- Usage: psql "$DATABASE_URL" -f scripts/sql/verify-audit-triggers.sql

\echo '=========================================='
\echo 'AUDIT TRIGGER VERIFICATION'
\echo '=========================================='

-- 1. Check if audit_log table exists
\echo '\n1. Checking audit_log table...'
SELECT 
  CASE 
    WHEN EXISTS (SELECT FROM pg_tables WHERE tablename = 'audit_log') 
    THEN '✅ audit_log table exists'
    ELSE '❌ audit_log table MISSING'
  END as status;

-- 2. Verify audit_log schema
\echo '\n2. Verifying audit_log schema...'
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'audit_log'
ORDER BY ordinal_position;

-- 3. Check indexes on audit_log
\echo '\n3. Checking audit_log indexes...'
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'audit_log'
ORDER BY indexname;

-- 4. Verify audit triggers exist on financial tables
\echo '\n4. Verifying audit triggers on financial tables...'
SELECT 
  t.tablename,
  COUNT(DISTINCT tg.tgname) as trigger_count,
  STRING_AGG(DISTINCT tg.tgname, ', ') as triggers
FROM pg_tables t
LEFT JOIN pg_trigger tg ON tg.tgrelid = (
  SELECT oid FROM pg_class WHERE relname = t.tablename
)
WHERE t.schemaname = 'public'
  AND t.tablename IN (
    'wallet_accounts',
    'wallet_entries',
    'wallet_transactions',
    'payments',
    'payment_intents',
    'momo_transactions',
    'revolut_transactions',
    'invoices',
    'subscriptions',
    'refunds'
  )
  AND tg.tgname LIKE 'audit_%'
GROUP BY t.tablename
ORDER BY t.tablename;

-- 5. Check which financial tables are MISSING audit triggers
\echo '\n5. Financial tables WITHOUT audit triggers...'
SELECT 
  t.tablename,
  '❌ MISSING AUDIT TRIGGER' as status
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.tablename IN (
    'wallet_accounts',
    'wallet_entries',
    'wallet_transactions',
    'payments',
    'payment_intents',
    'momo_transactions',
    'revolut_transactions',
    'invoices',
    'subscriptions',
    'refunds'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_trigger tg
    WHERE tg.tgrelid = (SELECT oid FROM pg_class WHERE relname = t.tablename)
      AND tg.tgname LIKE 'audit_%'
  );

\echo '\n=========================================='
\echo 'ROW LEVEL SECURITY (RLS) VERIFICATION'
\echo '=========================================='

-- 6. Check RLS enabled on financial tables
\echo '\n6. Checking RLS enabled status...'
SELECT 
  c.relname as tablename,
  CASE 
    WHEN c.relrowsecurity THEN '✅ RLS ENABLED'
    ELSE '❌ RLS DISABLED'
  END as rls_status,
  CASE 
    WHEN c.relforcerowsecurity THEN 'FORCED (applies to table owner)'
    ELSE 'NORMAL (owner bypasses RLS)'
  END as force_status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'wallet_accounts',
    'wallet_entries',
    'wallet_transactions',
    'payments',
    'payment_intents',
    'momo_transactions',
    'revolut_transactions',
    'invoices',
    'subscriptions',
    'refunds',
    'audit_log'
  )
ORDER BY c.relname;

-- 7. Count policies per financial table
\echo '\n7. Counting RLS policies...'
SELECT 
  tablename,
  COUNT(*) as policy_count,
  STRING_AGG(policyname, ', ' ORDER BY policyname) as policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'wallet_accounts',
    'wallet_entries',
    'wallet_transactions',
    'payments',
    'payment_intents',
    'momo_transactions',
    'revolut_transactions',
    'invoices',
    'subscriptions',
    'refunds',
    'audit_log'
  )
GROUP BY tablename
ORDER BY tablename;

-- 8. Find financial tables WITHOUT any RLS policies
\echo '\n8. Financial tables WITHOUT RLS policies...'
SELECT 
  c.relname as tablename,
  '❌ NO POLICIES DEFINED' as status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity = true
  AND c.relname IN (
    'wallet_accounts',
    'wallet_entries',
    'wallet_transactions',
    'payments',
    'payment_intents',
    'momo_transactions',
    'revolut_transactions',
    'invoices',
    'subscriptions',
    'refunds',
    'audit_log'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p 
    WHERE p.tablename = c.relname 
      AND p.schemaname = 'public'
  );

-- 9. Detailed policy inspection for wallet_accounts
\echo '\n9. Detailed policies for wallet_accounts...'
SELECT 
  policyname,
  cmd as applies_to,
  permissive,
  roles,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'wallet_accounts'
ORDER BY policyname;

-- 10. Check audit_log RLS policies (should be immutable)
\echo '\n10. Audit log policies (should prevent updates/deletes)...'
SELECT 
  policyname,
  cmd as applies_to,
  CASE 
    WHEN cmd = 'UPDATE' AND qual = 'false' THEN '✅ Updates blocked'
    WHEN cmd = 'DELETE' AND qual = 'false' THEN '✅ Deletes blocked'
    WHEN cmd = 'INSERT' THEN '✅ Inserts allowed'
    WHEN cmd = 'SELECT' THEN '✅ Reads allowed (service role)'
    ELSE '⚠️ Review needed'
  END as security_assessment
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'audit_log'
ORDER BY cmd;

\echo '\n=========================================='
\echo 'SUMMARY'
\echo '=========================================='

-- Final Summary
\echo '\n11. Production Readiness Summary...'
WITH stats AS (
  SELECT 
    COUNT(DISTINCT t.tablename) as total_financial_tables,
    COUNT(DISTINCT CASE WHEN tg.tgname IS NOT NULL THEN t.tablename END) as tables_with_triggers,
    COUNT(DISTINCT CASE WHEN c.relrowsecurity THEN t.tablename END) as tables_with_rls,
    COUNT(DISTINCT p.tablename) as tables_with_policies
  FROM (
    SELECT unnest(ARRAY[
      'wallet_accounts', 'wallet_entries', 'wallet_transactions',
      'payments', 'payment_intents', 'momo_transactions',
      'revolut_transactions', 'invoices', 'subscriptions', 'refunds'
    ]) as tablename
  ) t
  LEFT JOIN pg_trigger tg ON tg.tgrelid = (
    SELECT oid FROM pg_class WHERE relname = t.tablename
  ) AND tg.tgname LIKE 'audit_%'
  LEFT JOIN pg_class c ON c.relname = t.tablename
  LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = 'public'
)
SELECT 
  total_financial_tables as "Total Financial Tables",
  tables_with_triggers as "Tables with Audit Triggers",
  tables_with_rls as "Tables with RLS Enabled",
  tables_with_policies as "Tables with RLS Policies",
  CASE 
    WHEN tables_with_triggers = total_financial_tables 
     AND tables_with_rls = total_financial_tables
     AND tables_with_policies = total_financial_tables
    THEN '✅ ALL CHECKS PASSED - PRODUCTION READY'
    ELSE '❌ MISSING SECURITY CONTROLS - NOT READY'
  END as "Production Status"
FROM stats;

\echo '\n=========================================='
\echo 'Verification Complete'
\echo '=========================================='
