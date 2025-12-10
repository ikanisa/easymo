-- =====================================================================
-- RENAME HOME MENU ITEMS TO SIMPLIFIED NAMES
-- =====================================================================
-- Updates menu item display names to simpler, user-friendly versions
-- 
-- New names:
-- 1. Waiter AI → Waiter
-- 2. Rides AI → Rides
-- 3. Jobs AI → Jobs
-- 4. Business Broker → Buy and Sell
-- 5. Real Estate → Property Rentals
-- 6. Farmer AI → Farmers
-- 7. Insurance AI → Insurance
-- 8. Sales SDR → Support
-- 9. Profile → Profile (unchanged)
-- =====================================================================

BEGIN;

-- 1. Waiter AI → Waiter
UPDATE public.whatsapp_home_menu_items
SET 
  name = 'Waiter',
  updated_at = NOW()
WHERE key = 'waiter_agent';

-- 2. Rides AI → Rides
UPDATE public.whatsapp_home_menu_items
SET 
  name = 'Rides',
  updated_at = NOW()
WHERE key = 'rides_agent';

-- 3. Jobs AI → Jobs
UPDATE public.whatsapp_home_menu_items
SET 
  name = 'Jobs',
  updated_at = NOW()
WHERE key = 'jobs_agent';

-- 4. Business Broker → Buy and Sell
UPDATE public.whatsapp_home_menu_items
SET 
  name = 'Buy and Sell',
  updated_at = NOW()
WHERE key = 'business_broker_agent';

-- 5. Real Estate → Property Rentals
UPDATE public.whatsapp_home_menu_items
SET 
  name = 'Property Rentals',
  updated_at = NOW()
WHERE key = 'real_estate_agent';

-- 6. Farmer AI → Farmers
UPDATE public.whatsapp_home_menu_items
SET 
  name = 'Farmers',
  updated_at = NOW()
WHERE key = 'farmer_agent';

-- 7. Insurance AI → Insurance
UPDATE public.whatsapp_home_menu_items
SET 
  name = 'Insurance',
  updated_at = NOW()
WHERE key = 'insurance_agent';

-- 8. Sales SDR → Support
UPDATE public.whatsapp_home_menu_items
SET 
  name = 'Support',
  updated_at = NOW()
WHERE key = 'sales_agent';

-- 9. Profile → Profile (already correct, but ensure consistency)
UPDATE public.whatsapp_home_menu_items
SET 
  name = 'Profile',
  updated_at = NOW()
WHERE key = 'profile';

-- Update table comment with new names
COMMENT ON TABLE public.whatsapp_home_menu_items IS 
'WhatsApp home menu configuration with exactly 9 active items:
1. Waiter
2. Rides
3. Jobs
4. Buy and Sell
5. Property Rentals
6. Farmers
7. Insurance
8. Support
9. Profile

Updated 2025-11-22 with simplified, user-friendly names.';

COMMIT;

-- =====================================================================
-- VERIFICATION
-- =====================================================================
-- Run this to verify the new names:
-- 
-- SELECT key, name, icon, is_active, display_order 
-- FROM whatsapp_home_menu_items 
-- WHERE is_active = true 
-- ORDER BY display_order;
--
-- Expected output:
-- 1. waiter_agent         | Waiter            | 🍽️
-- 2. rides_agent          | Rides             | 🚗
-- 3. jobs_agent           | Jobs              | 💼
-- 4. business_broker_agent| Buy and Sell      | 🏪
-- 5. real_estate_agent    | Property Rentals  | 🏠
-- 6. farmer_agent         | Farmers           | 🌾
-- 7. insurance_agent      | Insurance         | 🛡️
-- 8. sales_agent          | Support           | 📞
-- 9. profile              | Profile           | 👤
