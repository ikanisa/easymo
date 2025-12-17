BEGIN;

-- ============================================================================
-- DROP INSURANCE TABLES
-- Generated: 2025-12-13T22:42:02Z
-- Purpose: Clean up insurance workflow - remove unused tables
-- Keep: insurance_admin_contacts (stores admin contact info for simple workflow)
-- ============================================================================

-- Drop tables in reverse dependency order

-- 1. Drop insurance_admin_notifications (references insurance_admin_contacts)
DROP TABLE IF EXISTS public.insurance_admin_notifications CASCADE;

-- 2. Drop insurance_claims
DROP TABLE IF EXISTS public.insurance_claims CASCADE;

-- 3. Drop insurance_certificates
DROP TABLE IF EXISTS public.insurance_certificates CASCADE;

-- 4. Drop insurance_quote_requests
DROP TABLE IF EXISTS public.insurance_quote_requests CASCADE;

-- 5. Drop feature_gate_audit (insurance-related)
DROP TABLE IF EXISTS public.feature_gate_audit CASCADE;

-- 6. Drop app_config (insurance-related)
DROP TABLE IF EXISTS public.app_config CASCADE;

-- 7. Drop processed_webhooks (used by insurance workflow)
DROP TABLE IF EXISTS public.processed_webhooks CASCADE;

-- Drop helper function for admin contacts (we'll recreate a simpler one if needed)
DROP FUNCTION IF EXISTS public.get_admin_contacts(TEXT, TEXT) CASCADE;

-- ============================================================================
-- KEEP insurance_admin_contacts table
-- This table stores the WhatsApp admin contact that users should message
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'insurance_admin_contacts'
  ) THEN
    COMMENT ON TABLE public.insurance_admin_contacts IS 'Admin contact information for insurance services - used to provide contact details to users';
  ELSE
    RAISE NOTICE 'Skipping insurance_admin_contacts comment: table missing.';
  END IF;
END $$;

COMMIT;
