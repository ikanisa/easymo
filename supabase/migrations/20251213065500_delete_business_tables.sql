BEGIN;

-- Migration: Delete Business Tables
-- Date: 2025-12-13
-- Description: Remove business, business_owners, business_whatsapp_numbers, contacts tables

-- Drop tables with CASCADE to handle foreign key constraints
DROP TABLE IF EXISTS public.business_whatsapp_numbers CASCADE;
DROP TABLE IF EXISTS public.business_owners CASCADE;
DROP TABLE IF EXISTS public.contacts CASCADE;
DROP TABLE IF EXISTS public.business CASCADE;

-- Verification
DO $$
DECLARE
  tables_to_check TEXT[] := ARRAY['business', 'business_owners', 'business_whatsapp_numbers', 'contacts'];
  t TEXT;
  table_exists BOOLEAN;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'BUSINESS TABLES DELETION VERIFICATION';
  RAISE NOTICE '========================================';
  
  FOREACH t IN ARRAY tables_to_check
  LOOP
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = t
    ) INTO table_exists;
    
    IF NOT table_exists THEN
      RAISE NOTICE '✓ Table % successfully dropped', t;
    ELSE
      RAISE WARNING '✗ Table % still exists', t;
    END IF;
  END LOOP;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Deletion complete!';
  RAISE NOTICE '========================================';
END $$;

COMMIT;
