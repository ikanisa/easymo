-- Migration: Add insurance admin contacts
-- Created: 2025-11-23
-- Purpose: Populate insurance_admin_contacts with support numbers

BEGIN;

-- Insert contacts if they don't exist
INSERT INTO public.insurance_admin_contacts (display_name, contact_value, is_active, display_order)
SELECT 'Support Agent 1', '+250795588248', true, 10
WHERE NOT EXISTS (SELECT 1 FROM public.insurance_admin_contacts WHERE contact_value = '+250795588248')
UNION ALL
SELECT 'Support Agent 2', '+250793094876', true, 20
WHERE NOT EXISTS (SELECT 1 FROM public.insurance_admin_contacts WHERE contact_value = '+250793094876')
UNION ALL
SELECT 'Support Agent 3', '+250788767816', true, 30
WHERE NOT EXISTS (SELECT 1 FROM public.insurance_admin_contacts WHERE contact_value = '+250788767816');;

COMMIT;
