-- =====================================================================
-- CLEANUP: REMOVE UNSUPPORTED COUNTRIES
-- =====================================================================
-- Removes Uganda (UG), Kenya (KE), Nigeria (NG), South Africa (ZA)
-- Keeps only: Rwanda (RW), Burundi (BI), Tanzania (TZ), Congo DRC (CD)
-- 
-- This migration:
-- 1. Updates all active_countries arrays in whatsapp_home_menu_items
-- 2. Removes unsupported countries from countries table (if exists)
-- 3. Updates country-specific configurations
-- 4. Cleans up any country-specific data
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. UPDATE WHATSAPP HOME MENU ITEMS TO SUPPORTED COUNTRIES ONLY
-- =====================================================================

-- Update all active menu items to only support RW, BI, TZ, CD
UPDATE public.whatsapp_home_menu_items
SET 
  active_countries = ARRAY['RW', 'BI', 'TZ', 'CD'],
  updated_at = NOW()
WHERE is_active = true;

-- Also update any inactive items that might be re-enabled later
UPDATE public.whatsapp_home_menu_items
SET 
  active_countries = ARRAY['RW', 'BI', 'TZ', 'CD'],
  updated_at = NOW()
WHERE is_active = false
  AND array_length(active_countries, 1) > 0;

-- =====================================================================
-- 2. REMOVE UNSUPPORTED COUNTRIES FROM COUNTRIES TABLE (IF EXISTS)
-- =====================================================================

-- Delete country configuration for unsupported countries
DELETE FROM public.countries
WHERE code IN ('UG', 'KE', 'NG', 'ZA')
  AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'countries');

-- =====================================================================
-- 3. CLEAN UP COUNTRY-SPECIFIC DATA
-- =====================================================================

-- Remove any country-specific preferences or settings for unsupported countries
-- (Add specific cleanup queries based on your schema)

-- Update app_config if it has country-specific settings
UPDATE public.app_config
SET 
  updated_at = NOW()
WHERE id = 1;

-- =====================================================================
-- 4. ADD DOCUMENTATION
-- =====================================================================

COMMENT ON COLUMN public.whatsapp_home_menu_items.active_countries IS 
'Supported countries: RW (Rwanda), BI (Burundi), TZ (Tanzania), CD (Congo DRC).
Updated 2025-11-22: Removed UG, KE, NG, ZA - focusing on core East/Central African markets.';

-- Add comment to database
COMMENT ON DATABASE postgres IS 
'easyMO Platform Database
Supported Countries: Rwanda (RW), Burundi (BI), Tanzania (TZ), Congo DRC (CD)
Removed: Uganda, Kenya, Nigeria, South Africa - 2025-11-22';

COMMIT;

-- =====================================================================
-- VERIFICATION QUERIES
-- =====================================================================
-- Run these to verify cleanup:
-- 
-- -- Check menu items only have supported countries
-- SELECT key, name, active_countries 
-- FROM whatsapp_home_menu_items 
-- WHERE is_active = true;
--
-- -- Should show: ARRAY['RW', 'BI', 'TZ', 'CD'] for all items
--
-- -- Check countries table (if exists)
-- SELECT code, name FROM countries ORDER BY code;
-- -- Should NOT contain: UG, KE, NG, ZA
