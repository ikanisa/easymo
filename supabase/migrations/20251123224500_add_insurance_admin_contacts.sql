-- Add Insurance Admin Contacts
-- Migration: 20251123224500_add_insurance_admin_contacts.sql
-- Purpose: Populate insurance admin contacts for support and notifications

BEGIN;

-- Clear existing contacts first (idempotent)
DELETE FROM insurance_admin_contacts WHERE contact_value IN ('+250795588248', '+250793094876', '+250788767816');
DELETE FROM insurance_admins WHERE wa_id IN ('250795588248', '250793094876', '250788767816');

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
  ('whatsapp', '+250788767816', 'Insurance Support Team 3', 3, true);

-- Add to insurance_admins table (for receiving notifications)
INSERT INTO insurance_admins (
  wa_id,
  name,
  is_active,
  receives_all_alerts
) VALUES
  ('250795588248', 'Insurance Support Team 1', true, true),
  ('250793094876', 'Insurance Support Team 2', true, true),
  ('250788767816', 'Insurance Support Team 3', true, true);

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
    RAISE WARNING 'Expected at least 3 insurance admin contacts, found %', contact_count;
  END IF;
  
  IF admin_count < 3 THEN
    RAISE WARNING 'Expected at least 3 insurance admins, found %', admin_count;
  END IF;
END $$;

COMMIT;
