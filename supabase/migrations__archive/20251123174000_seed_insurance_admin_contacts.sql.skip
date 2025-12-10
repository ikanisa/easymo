-- Seed default insurance admin WhatsApp contacts
-- Created: 2025-11-23

BEGIN;

INSERT INTO public.insurance_admin_contacts (contact_type, contact_value, display_name, is_active, display_order)
VALUES
  ('whatsapp', '+250795588248', 'Insurance Admin 1', true, 1),
  ('whatsapp', '+250793094876', 'Insurance Admin 2', true, 2),
  ('whatsapp', '+250788767816', 'Insurance Admin 3', true, 3)
ON CONFLICT DO NOTHING;

COMMIT;

