-- ============================================================================
-- Migration: Add Insurance Contacts
-- Description: Add actual insurance team contacts to admin_contacts table
-- Author: EasyMO Team
-- Date: 2025-12-15
-- ============================================================================

BEGIN;

-- Add insurance team contacts
INSERT INTO public.admin_contacts (category, phone_number, name, is_active)
VALUES 
  ('insurance', '+250795588248', 'Insurance Contact 1', true),
  ('insurance', '+250796884076', 'Insurance Contact 2', true)
ON CONFLICT DO NOTHING;

COMMIT;
