-- ============================================================================
-- DROP UNUSED PAYMENT TABLES
-- ============================================================================
-- Migration: 20251211005500_drop_unused_payment_tables.sql
-- Purpose: Remove unused payment/audit tables that were created for features
--          that don't exist
--
-- Context:
--   The system only supports connecting passengers and drivers.
--   These tables were created for payment logging and audit features that
--   were never implemented and add unnecessary complexity to the schema.
--
-- Tables to drop:
--   - trip_payment_requests: Logs USSD codes, QR codes, payment status
--   - trip_status_audit: Audit log of trip status changes
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Drop trip_payment_requests table
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'trip_payment_requests'
  ) THEN
    RAISE NOTICE 'Dropping trip_payment_requests table and related constraints...';
    
    -- Drop any foreign key constraints first
    -- (in case they exist pointing TO this table or FROM this table)
    DECLARE
      fk_record RECORD;
    BEGIN
      FOR fk_record IN 
        SELECT tc.constraint_name, tc.table_name
        FROM information_schema.table_constraints tc
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND (tc.table_name = 'trip_payment_requests' 
               OR tc.constraint_name LIKE '%trip_payment_requests%')
      LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I CASCADE', 
                      fk_record.table_name, fk_record.constraint_name);
        RAISE NOTICE 'Dropped FK constraint: %.%', fk_record.table_name, fk_record.constraint_name;
      END LOOP;
    END;
    
    -- Drop the table with CASCADE to handle any remaining dependencies
    DROP TABLE IF EXISTS public.trip_payment_requests CASCADE;
    RAISE NOTICE '✓ trip_payment_requests table dropped';
  ELSE
    RAISE NOTICE 'trip_payment_requests table does not exist - skipping';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Drop trip_status_audit table
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'trip_status_audit'
  ) THEN
    RAISE NOTICE 'Dropping trip_status_audit table and related constraints...';
    
    -- Drop any foreign key constraints first
    DECLARE
      fk_record RECORD;
    BEGIN
      FOR fk_record IN 
        SELECT tc.constraint_name, tc.table_name
        FROM information_schema.table_constraints tc
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND (tc.table_name = 'trip_status_audit' 
               OR tc.constraint_name LIKE '%trip_status_audit%')
      LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I CASCADE', 
                      fk_record.table_name, fk_record.constraint_name);
        RAISE NOTICE 'Dropped FK constraint: %.%', fk_record.table_name, fk_record.constraint_name;
      END LOOP;
    END;
    
    -- Drop the table with CASCADE to handle any remaining dependencies
    DROP TABLE IF EXISTS public.trip_status_audit CASCADE;
    RAISE NOTICE '✓ trip_status_audit table dropped';
  ELSE
    RAISE NOTICE 'trip_status_audit table does not exist - skipping';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Drop related indexes (if they exist independently)
-- ============================================================================

DO $$
DECLARE
  idx_record RECORD;
BEGIN
  -- Drop indexes related to trip_payment_requests
  FOR idx_record IN 
    SELECT indexname 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND indexname LIKE '%trip_payment_requests%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I CASCADE', idx_record.indexname);
    RAISE NOTICE 'Dropped index: %', idx_record.indexname;
  END LOOP;
  
  -- Drop indexes related to trip_status_audit
  FOR idx_record IN 
    SELECT indexname 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND indexname LIKE '%trip_status_audit%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I CASCADE', idx_record.indexname);
    RAISE NOTICE 'Dropped index: %', idx_record.indexname;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 4: Verify cleanup
-- ============================================================================

DO $$
DECLARE
  remaining_tables text[];
BEGIN
  -- Check if tables were successfully removed
  SELECT array_agg(table_name) 
  INTO remaining_tables
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('trip_payment_requests', 'trip_status_audit');
  
  IF remaining_tables IS NOT NULL THEN
    RAISE WARNING 'Some tables still exist: %', remaining_tables;
  ELSE
    RAISE NOTICE '✓ All unused payment tables successfully removed';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- CLEANUP COMPLETE ✓
-- ============================================================================
-- 
-- Summary:
--   - Removed trip_payment_requests table (unused payment logging)
--   - Removed trip_status_audit table (unused audit logging)
--   - Cleaned up related foreign keys and indexes
--
-- Result:
--   Simplified mobility schema focusing only on core trip matching functionality
-- ============================================================================
