-- ============================================================================
-- DROP PAYMENT PROCESSING TABLES
-- ============================================================================
-- Migration: 20251211005828_drop_payment_processing_tables.sql
-- Date: 2025-12-11
-- Purpose: Remove unused payment processing tables from mobility system
--
-- Context: The system only supports connecting passengers and drivers.
-- Payment processing was never fully implemented and these tables are unused.
--
-- Tables to drop:
-- 1. trip_payment_requests - Stores payment USSD codes, QR codes, amounts
-- 2. trip_status_audit - Logs trip status changes for payment verification
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: DROP trip_payment_requests TABLE
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'trip_payment_requests'
  ) THEN
    RAISE NOTICE 'Dropping trip_payment_requests table...';
    DROP TABLE IF EXISTS public.trip_payment_requests CASCADE;
    RAISE NOTICE 'trip_payment_requests dropped';
  ELSE
    RAISE NOTICE 'trip_payment_requests table does not exist - skipping';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: DROP trip_status_audit TABLE
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'trip_status_audit'
  ) THEN
    RAISE NOTICE 'Dropping trip_status_audit table...';
    DROP TABLE IF EXISTS public.trip_status_audit CASCADE;
    RAISE NOTICE 'trip_status_audit dropped';
  ELSE
    RAISE NOTICE 'trip_status_audit table does not exist - skipping';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: VERIFY CLEANUP
-- ============================================================================

DO $$
DECLARE
  remaining_tables text[];
BEGIN
  -- Check if tables were successfully dropped
  SELECT array_agg(table_name) 
  INTO remaining_tables
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('trip_payment_requests', 'trip_status_audit');
  
  IF remaining_tables IS NOT NULL THEN
    RAISE WARNING 'Some tables still exist: %', remaining_tables;
  ELSE
    RAISE NOTICE 'All payment processing tables successfully removed';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: LOG CLEANUP COMPLETION (optional - only if system_logs exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_logs') THEN
    INSERT INTO public.system_logs (event_type, details)
    VALUES ('PAYMENT_TABLES_CLEANUP', jsonb_build_object(
      'migration', '20251211005828_drop_payment_processing_tables',
      'timestamp', now(),
      'dropped_tables', ARRAY['trip_payment_requests', 'trip_status_audit'],
      'reason', 'Payment processing not implemented - tables unused'
    ));
  ELSE
    RAISE NOTICE 'system_logs table does not exist - skipping cleanup log';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- CLEANUP COMPLETE ✓
-- ============================================================================
-- 
-- Summary:
--   - Removed trip_payment_requests table
--   - Removed trip_status_audit table
--   - All foreign key constraints automatically dropped via CASCADE
--   - All indexes automatically dropped via CASCADE
--
-- These tables were part of an unimplemented payment verification system.
-- Core mobility functionality (ride matching) is unaffected.
-- ============================================================================
