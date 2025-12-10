BEGIN;

-- Migration: Security Hardening - RLS Policies and Client Settings View
-- Timestamp: 20251027073908
-- Description: Revoke overly permissive public SELECT policies and create 
--              a sanitized client_settings view for client-safe configuration.
--
-- IMPORTANT: DB owners must review this migration before applying!
-- This migration makes security-focused changes that may affect application behavior.
-- Test thoroughly in a staging environment before applying to production.

-- =============================================================================
-- SECTION 1: Audit and Document Existing Public Policies
-- =============================================================================
-- This section documents policies that grant SELECT to public/anon roles.
-- Review each policy to determine if it should be revoked or modified.

/*
  Current policies granting SELECT access (as of review):
  
  - menus_published_select: Allows anon to view published menus
  - categories_published_select: Allows anon to view published categories  
  - items_published_select: Allows anon to view published items
  - bar_tables_customer_select: Allows customers to view tables
  
  These policies may be intentional for public menu browsing.
  Review and adjust based on your security requirements.
*/

-- =============================================================================
-- SECTION 2: Example - Revoke Overly Permissive Policies (TEMPLATE)
-- =============================================================================
-- Uncomment and adjust based on your specific security requirements.
-- Only revoke policies after confirming they are not needed for app functionality.

/*
-- Example: Revoke anonymous access to sensitive data
-- DROP POLICY IF EXISTS "some_overly_permissive_policy" ON public.some_table;

-- Example: Revoke public SELECT on configuration tables
-- DROP POLICY IF EXISTS "config_public_select" ON public.app_config;

-- Example: Tighten policy to require authentication
-- DROP POLICY IF EXISTS "old_policy" ON public.sensitive_table;
-- CREATE POLICY "authenticated_only" ON public.sensitive_table
--   FOR SELECT
--   TO authenticated
--   USING (true);
*/

-- =============================================================================
-- SECTION 3: Create Client Settings View
-- =============================================================================
-- This view provides client-safe configuration data without exposing secrets.
-- Only non-sensitive settings should be included here.

-- Drop view if it exists
DROP VIEW IF EXISTS public.client_settings;

-- Create a view that exposes only client-safe configuration
CREATE OR REPLACE VIEW public.client_settings AS
SELECT
  'environment_label'::text AS key,
  COALESCE(current_setting('app.environment_label', true), 'Production')::text AS value
UNION ALL
SELECT
  'features_enabled'::text AS key,
  COALESCE(current_setting('app.features_enabled', true), '{}')::text AS value
UNION ALL
SELECT
  'maintenance_mode'::text AS key,
  COALESCE(current_setting('app.maintenance_mode', true), 'false')::text AS value;

-- Grant SELECT on the view to anon and authenticated roles
GRANT SELECT ON public.client_settings TO anon, authenticated;

-- Add comment
COMMENT ON VIEW public.client_settings IS 
  'Client-safe application settings. Only non-sensitive configuration should be exposed here.';

-- =============================================================================
-- SECTION 4: Security Verification Queries
-- =============================================================================
-- Run these queries after migration to verify security posture.

/*
-- List all policies granting SELECT to anon role:
SELECT 
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND roles @> ARRAY['anon']
  AND cmd IN ('SELECT', 'ALL')
ORDER BY tablename, policyname;

-- List all grants to anon role:
SELECT 
  table_schema,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE grantee = 'anon'
  AND table_schema = 'public'
ORDER BY table_name;

-- Verify client_settings view works:
SELECT * FROM public.client_settings;
*/

-- =============================================================================
-- MIGRATION NOTES
-- =============================================================================
/*
  This migration provides a template for security hardening:
  
  1. Review all policies granting SELECT to 'anon' role
  2. Revoke policies that expose sensitive data
  3. Create tighter policies requiring authentication where appropriate
  4. Use the client_settings view for exposing client-safe configuration
  5. Test thoroughly before deploying to production
  
  Security Checklist:
  [ ] Review all policies listed in verification queries
  [ ] Confirm application still functions with tighter policies
  [ ] Verify client_settings view contains only non-sensitive data
  [ ] Test with anon and authenticated users
  [ ] Check application logs for access denied errors
  [ ] Update application code if needed to handle policy changes
  
  Rollback Plan:
  - Keep a backup of current policies
  - Test rollback in staging first
  - Have on-call DBA available during production deployment
*/

COMMIT;
