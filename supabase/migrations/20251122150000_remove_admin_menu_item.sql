-- =====================================================================
-- REMOVE ADMIN MENU ITEM FROM WHATSAPP HOME
-- =====================================================================
-- This migration removes the admin menu item that appeared for specific
-- admin phone numbers on the WhatsApp home menu.
-- 
-- Changes:
-- 1. Remove any admin-related menu items from whatsapp_home_menu_items
-- 2. Clean up admin configuration from app_config table
-- 3. Add comments for future reference
-- =====================================================================

BEGIN;

-- Remove admin menu item if it exists (though it shouldn't be in the canonical 9)
DELETE FROM public.whatsapp_home_menu_items
WHERE key IN ('admin', 'admin_hub', 'admin_menu')
  OR name ILIKE '%admin%hub%'
  OR name ILIKE '%admin%menu%';

-- Remove admin number fields from app_config (soft approach - set to empty arrays)
UPDATE public.app_config
SET 
  admin_numbers = '{}',
  insurance_admin_numbers = '{}',
  updated_at = NOW()
WHERE id = 1;

-- Add comment explaining the removal
COMMENT ON TABLE public.app_config IS 
'Application configuration. Admin menu functionality removed 2025-11-22. 
Admin access now handled through dedicated admin panel at easymo-admin.netlify.app';

COMMIT;

-- =====================================================================
-- VERIFICATION
-- =====================================================================
-- Run these to verify admin menu is removed:
-- 
-- -- Should return 0 rows
-- SELECT * FROM whatsapp_home_menu_items WHERE name ILIKE '%admin%';
--
-- -- Should show empty arrays
-- SELECT admin_numbers, insurance_admin_numbers FROM app_config WHERE id = 1;
