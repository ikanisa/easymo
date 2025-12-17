-- ============================================================================
-- Migration: Insurance Contacts - Final Clean Implementation
-- Description: Stable insurance contacts in admin_contacts table
-- Author: EasyMO Team  
-- Date: 2025-12-15
-- ============================================================================

BEGIN;

DO $$
DECLARE
  contact_count INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_contacts'
  ) THEN
    RAISE NOTICE 'Skipping 20251215124500_insurance_contacts_final: admin_contacts table missing.';
    RETURN;
  END IF;

  -- 1. Add unique constraint to prevent duplicates
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'admin_contacts'
      AND constraint_name = 'admin_contacts_category_phone_unique'
  ) THEN
    ALTER TABLE public.admin_contacts 
    ADD CONSTRAINT admin_contacts_category_phone_unique 
    UNIQUE (category, phone_number);
  END IF;

  -- 2. Insert insurance contacts (will not duplicate due to constraint)
  INSERT INTO public.admin_contacts (category, phone_number, name, is_active)
  VALUES 
    ('insurance', '+250795588248', 'Insurance Team', true),
    ('insurance', '+250796884076', 'Claims Support', true)
  ON CONFLICT (category, phone_number) DO UPDATE
  SET 
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;

  -- 3. Verify contacts exist
  SELECT COUNT(*) INTO contact_count 
  FROM public.admin_contacts 
  WHERE category = 'insurance' AND is_active = true;
  
  IF contact_count = 0 THEN
    RAISE EXCEPTION 'Insurance contacts not inserted correctly';
  END IF;
  
  RAISE NOTICE 'Insurance contacts verified: % active contacts', contact_count;
END $$;

COMMIT;
