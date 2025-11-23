-- Add Insurance Admin Contacts
-- Migration: 20251123224500_add_insurance_admin_contacts.sql
-- Purpose: Populate insurance admin contacts for support and notifications

BEGIN;

-- Insert insurance admin contacts (for user-facing support list)
INSERT INTO insurance_admin_contacts (
  contact_type,
  contact_value,
  display_name,
  display_order,
  is_active
) VALUES
  ('whatsapp', '+250795588248', 'Insurance Support Team 1', 1, true),
  ('whatsapp', '+250793094876', 'Insurance Support Team 2', 2, true),
  ('whatsapp', '+250788767816', 'Insurance Support Team 3', 3, true)
ON CONFLICT (contact_value) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  display_name = EXCLUDED.display_name,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- Add to insurance_admins table (for receiving notifications)
INSERT INTO insurance_admins (
  wa_id,
  name,
  role,
  is_active,
  receives_all_alerts
) VALUES
  ('250795588248', 'Insurance Support Team 1', 'admin', true, true),
  ('250793094876', 'Insurance Support Team 2', 'admin', true, true),
  ('250788767816', 'Insurance Support Team 3', 'admin', true, true)
ON CONFLICT (wa_id) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  name = EXCLUDED.name,
  receives_all_alerts = EXCLUDED.receives_all_alerts,
  updated_at = NOW();

-- Verify inserts
DO $$
DECLARE
  contact_count INT;
  admin_count INT;
BEGIN
  SELECT COUNT(*) INTO contact_count FROM insurance_admin_contacts WHERE is_active = true;
  SELECT COUNT(*) INTO admin_count FROM insurance_admins WHERE is_active = true;
  
  RAISE NOTICE 'Insurance admin contacts inserted: %', contact_count;
  RAISE NOTICE 'Insurance admins inserted: %', admin_count;
  
  IF contact_count < 3 THEN
    RAISE EXCEPTION 'Failed to insert all insurance admin contacts';
  END IF;
  
  IF admin_count < 3 THEN
    RAISE EXCEPTION 'Failed to insert all insurance admins';
  END IF;
END $$;

COMMENT ON TABLE insurance_admin_contacts IS 'Insurance support contact numbers displayed to users when they tap Help';
COMMENT ON TABLE insurance_admins IS 'Insurance administrators who receive new certificate upload notifications';

COMMIT;
