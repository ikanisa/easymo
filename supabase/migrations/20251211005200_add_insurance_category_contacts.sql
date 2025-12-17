BEGIN;

-- Migration: Add Insurance Category to Admin Contacts
-- Purpose: Ensure admin contacts have category='insurance' for insurance notifications
-- Date: 2025-12-11

-- Update existing admin_auth contacts to also handle insurance if no insurance-specific contacts exist
-- This ensures backward compatibility
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'insurance_admin_contacts'
  ) THEN
    RAISE NOTICE 'Skipping 20251211005200_add_insurance_category_contacts: public.insurance_admin_contacts does not exist yet.';
    RETURN;
  END IF;

  UPDATE public.insurance_admin_contacts
  SET category = 'insurance'
  WHERE category = 'admin_auth'
    AND NOT EXISTS (
      SELECT 1 FROM public.insurance_admin_contacts 
      WHERE category = 'insurance' AND is_active = true
    );

  COMMENT ON TABLE public.insurance_admin_contacts IS 
    'Unified admin/support contacts table. Filter by category for specific use cases: admin_auth, insurance, support, general, escalation';
END $$;

-- Alternatively, if you want dedicated insurance contacts, insert them:
-- Uncomment and modify the following to add insurance-specific contacts:
/*
INSERT INTO public.insurance_admin_contacts (
  channel, 
  destination, 
  display_name, 
  category, 
  display_order, 
  priority,
  is_active
) VALUES
  ('whatsapp', '+250788767816', 'Insurance Team 1', 'insurance', 1, 10, true),
  ('whatsapp', '+35677186193', 'Insurance Team 2', 'insurance', 2, 10, true)
ON CONFLICT (destination) DO UPDATE SET
  category = EXCLUDED.category,
  display_name = EXCLUDED.display_name,
  priority = EXCLUDED.priority,
  is_active = EXCLUDED.is_active;
*/

COMMIT;
