-- Insurance Domain Database Consolidation Migration
-- Consolidates 12+ overlapping insurance tables into 8 core tables
-- Run this AFTER the code consolidation script

BEGIN;

-- ============================================================================
-- PART 1: TABLE CONSOLIDATION
-- ============================================================================

-- 1. Consolidate certificate tables
-- Rename driver_insurance_certificates to insurance_certificates
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'driver_insurance_certificates') THEN
    -- Add certificate_type column if not exists
    ALTER TABLE driver_insurance_certificates 
    ADD COLUMN IF NOT EXISTS certificate_type TEXT DEFAULT 'driver';
    
    -- Rename the table
    ALTER TABLE driver_insurance_certificates 
    RENAME TO insurance_certificates;
    
    RAISE NOTICE 'Renamed driver_insurance_certificates to insurance_certificates';
  END IF;
END $$;

-- 2. Migrate vehicle_insurance_certificates if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicle_insurance_certificates') THEN
    INSERT INTO insurance_certificates (
      user_id, insurer_name, policy_number, certificate_number,
      policy_inception, policy_expiry, vehicle_plate, make, model,
      certificate_media_url, ocr_provider, status, certificate_type, created_at
    )
    SELECT 
      profile_id, insurer_name, policy_number, certificate_number,
      policy_inception, policy_expiry, vehicle_plate, make, model,
      certificate_url, 'openai',
      CASE WHEN is_valid THEN 'approved' ELSE 'pending' END,
      'vehicle', created_at
    FROM vehicle_insurance_certificates
    ON CONFLICT DO NOTHING;
    
    DROP TABLE vehicle_insurance_certificates;
    RAISE NOTICE 'Migrated and dropped vehicle_insurance_certificates';
  END IF;
END $$;

-- 3. Consolidate quote request tables
-- Migrate insurance_quotes → insurance_quote_requests
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'insurance_quotes') THEN
    INSERT INTO insurance_quote_requests (
      id, profile_id, status, quote_details, created_at
    )
    SELECT 
      id, user_id, status,
      jsonb_build_object(
        'uploaded_docs', uploaded_docs,
        'insurer', insurer,
        'reviewer_comment', reviewer_comment
      ),
      created_at
    FROM insurance_quotes
    ON CONFLICT (id) DO NOTHING;
    
    DROP TABLE insurance_quotes;
    RAISE NOTICE 'Migrated and dropped insurance_quotes';
  END IF;
END $$;

-- 4. Migrate insurance_requests if it exists (duplicate of quote_requests)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'insurance_requests') THEN
    INSERT INTO insurance_quote_requests (
      profile_id, status, quote_details, created_at
    )
    SELECT 
      user_id, 
      COALESCE(status, 'pending'),
      jsonb_build_object(
        'request_type', request_type,
        'details', details
      ),
      created_at
    FROM insurance_requests
    ON CONFLICT DO NOTHING;
    
    DROP TABLE insurance_requests;
    RAISE NOTICE 'Migrated and dropped insurance_requests';
  END IF;
END $$;

-- 5. Consolidate document tables
-- Migrate insurance_documents → insurance_media_queue
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'insurance_documents') THEN
    INSERT INTO insurance_media_queue (
      profile_id, media_url, media_type, status, created_at
    )
    SELECT 
      user_id, document_url, document_type, 
      COALESCE(processing_status, 'pending'),
      created_at
    FROM insurance_documents
    ON CONFLICT DO NOTHING;
    
    DROP TABLE insurance_documents;
    RAISE NOTICE 'Migrated and dropped insurance_documents';
  END IF;
END $$;

-- 6. Migrate insurance_media if it exists (duplicate of media_queue)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'insurance_media') THEN
    INSERT INTO insurance_media_queue (
      profile_id, media_url, media_type, status, created_at
    )
    SELECT 
      profile_id, media_url, media_type,
      COALESCE(status, 'pending'),
      created_at
    FROM insurance_media
    ON CONFLICT DO NOTHING;
    
    DROP TABLE insurance_media;
    RAISE NOTICE 'Migrated and dropped insurance_media';
  END IF;
END $$;

-- 7. Consolidate admin tables
-- Migrate insurance_admin_contacts → insurance_admins
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'insurance_admin_contacts') THEN
    INSERT INTO insurance_admins (
      phone, name, role, is_active, created_at
    )
    SELECT 
      phone_number, contact_name, 
      COALESCE(contact_role, 'admin'),
      COALESCE(is_active, true),
      created_at
    FROM insurance_admin_contacts
    ON CONFLICT (phone) DO UPDATE SET
      name = EXCLUDED.name,
      role = EXCLUDED.role;
    
    DROP TABLE insurance_admin_contacts;
    RAISE NOTICE 'Migrated and dropped insurance_admin_contacts';
  END IF;
END $$;

-- 8. Migrate insurance_profiles → profiles.insurance_metadata
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'insurance_profiles') THEN
    -- Add insurance_metadata JSONB column to profiles if not exists
    ALTER TABLE profiles 
    ADD COLUMN IF NOT EXISTS insurance_metadata JSONB DEFAULT '{}';
    
    -- Migrate data
    UPDATE profiles p
    SET insurance_metadata = jsonb_build_object(
      'vehicle_identifier', ip.vehicle_identifier,
      'vehicle_metadata', ip.vehicle_metadata,
      'owner_name', ip.owner_name,
      'owner_id_number', ip.owner_id_number
    )
    FROM insurance_profiles ip
    WHERE p.user_id = ip.user_id;
    
    DROP TABLE insurance_profiles;
    RAISE NOTICE 'Migrated insurance_profiles to profiles.insurance_metadata';
  END IF;
END $$;

-- 9. Migrate insurance_leads → insurance_quote_requests
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'insurance_leads') THEN
    INSERT INTO insurance_quote_requests (
      profile_id, status, quote_details, created_at
    )
    SELECT 
      profile_id,
      CASE 
        WHEN lead_status = 'converted' THEN 'approved'
        WHEN lead_status = 'rejected' THEN 'rejected'
        ELSE 'pending'
      END,
      jsonb_build_object(
        'lead_source', lead_source,
        'lead_metadata', lead_metadata,
        'converted_at', converted_at
      ),
      created_at
    FROM insurance_leads
    ON CONFLICT DO NOTHING;
    
    DROP TABLE insurance_leads;
    RAISE NOTICE 'Migrated and dropped insurance_leads';
  END IF;
END $$;

-- ============================================================================
-- PART 2: FINAL SCHEMA VALIDATION
-- ============================================================================

-- Verify final table structure
DO $$
DECLARE
  expected_tables TEXT[] := ARRAY[
    'insurance_certificates',
    'insurance_policies',
    'insurance_claims',
    'insurance_renewals',
    'insurance_payments',
    'insurance_media_queue',
    'insurance_admin_notifications',
    'insurance_admins',
    'insurance_quote_requests',
    'feature_gate_audit'
  ];
  tbl TEXT;
  missing_count INT := 0;
BEGIN
  RAISE NOTICE '=== Insurance Tables Validation ===';
  
  FOREACH tbl IN ARRAY expected_tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl) THEN
      RAISE NOTICE '✅ %', tbl;
    ELSE
      RAISE WARNING '❌ Missing table: %', tbl;
      missing_count := missing_count + 1;
    END IF;
  END LOOP;
  
  IF missing_count > 0 THEN
    RAISE WARNING 'Missing % expected tables', missing_count;
  ELSE
    RAISE NOTICE 'All expected tables present';
  END IF;
END $$;

-- ============================================================================
-- PART 3: CLEANUP VERIFICATION
-- ============================================================================

-- Check for remaining redundant tables
DO $$
DECLARE
  redundant_tables TEXT[] := ARRAY[
    'insurance_quotes',
    'insurance_requests',
    'vehicle_insurance_certificates',
    'insurance_documents',
    'insurance_media',
    'insurance_admin_contacts',
    'insurance_profiles',
    'insurance_leads',
    'driver_insurance_certificates'
  ];
  tbl TEXT;
  remaining_count INT := 0;
BEGIN
  RAISE NOTICE '=== Checking for Redundant Tables ===';
  
  FOREACH tbl IN ARRAY redundant_tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl) THEN
      RAISE WARNING '⚠️  Redundant table still exists: %', tbl;
      remaining_count := remaining_count + 1;
    END IF;
  END LOOP;
  
  IF remaining_count = 0 THEN
    RAISE NOTICE '✅ All redundant tables removed';
  ELSE
    RAISE WARNING 'Found % redundant tables', remaining_count;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================

-- After running this migration:
-- 1. Update application code to use new table names
-- 2. Update RLS policies if needed
-- 3. Verify indexes on consolidated tables
-- 4. Run VACUUM ANALYZE on affected tables
-- 5. Update backup/monitoring configs for new schema
