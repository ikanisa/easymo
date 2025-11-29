-- Transaction wrapper for production safety
BEGIN;

-- Migration: Seed Insurance Admin Contacts
-- Created: 2025-11-23
-- Purpose: Add insurance admin contact numbers.

INSERT INTO public.insurance_admin_contacts (contact_type, contact_value, display_name, is_active, display_order)
SELECT 'whatsapp', '+250795588248', 'Insurance Support 1', true, 1
WHERE NOT EXISTS (SELECT 1 FROM public.insurance_admin_contacts WHERE contact_value = '+250795588248')
UNION ALL
SELECT 'whatsapp', '+250793094876', 'Insurance Support 2', true, 2
WHERE NOT EXISTS (SELECT 1 FROM public.insurance_admin_contacts WHERE contact_value = '+250793094876')
UNION ALL
SELECT 'whatsapp', '+250788767816', 'Insurance Support 3', true, 3
WHERE NOT EXISTS (SELECT 1 FROM public.insurance_admin_contacts WHERE contact_value = '+250788767816');

COMMIT;
