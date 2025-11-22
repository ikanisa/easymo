-- =====================================================================
-- ALIGN HOME MENU WITH 8 AI AGENTS + PROFILE
-- =====================================================================
-- Updates whatsapp_home_menu_items to match the 8 AI agents from ai_agents table
-- Plus profile item. Total 9 items for single-page home menu.
-- Safe cleanup: deactivates obsolete items, updates existing, adds missing
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. DEACTIVATE OBSOLETE/DUPLICATE ITEMS (SAFE CLEANUP)
-- =====================================================================

-- Deactivate items that are:
-- a) Duplicates (nearby_drivers, nearby_passengers are covered by "rides")
-- b) Narrow use-cases now part of broader agents (motor_insurance -> insurance, nearby_pharmacies -> business_broker)
-- c) Not core to the 9-item menu (schedule_trip is part of rides, notary_services, token_transfer, customer_support can be accessed elsewhere)

UPDATE whatsapp_home_menu_items
SET 
  is_active = false,
  updated_at = NOW()
WHERE key IN (
  'nearby_drivers',       -- Covered by rides agent
  'nearby_passengers',    -- Covered by rides agent
  'schedule_trip',        -- Covered by rides agent
  'motor_insurance',      -- Covered by insurance agent
  'nearby_pharmacies',    -- Covered by business_broker agent
  'quincailleries',       -- Covered by business_broker agent (hardware stores)
  'shops_services',       -- Covered by business_broker agent
  'notary_services',      -- Niche, can be accessed via business_broker or support
  'momo_qr',              -- Keep this separate as it's payment infrastructure
  'token_transfer',       -- Wallet feature, not an agent
  'customer_support'      -- Support, not an agent
);

-- =====================================================================
-- 2. UPDATE/UPSERT THE 9 CORE MENU ITEMS (8 AGENTS + PROFILE)
-- =====================================================================

-- Helper: Map AI agent slugs to menu keys and display info
-- Order: Most used first, based on user journey

-- 1. WAITER AI AGENT (Bars & Restaurants)
INSERT INTO whatsapp_home_menu_items (
  id,
  key,
  name,
  icon,
  is_active,
  active_countries,
  display_order,
  created_at,
  updated_at
)
VALUES (
  'a1000001-0000-0000-0000-000000000001'::uuid,
  'waiter_agent',
  'Waiter AI',
  '🍽️',
  true,
  ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'],
  1,
  NOW(),
  NOW()
)
ON CONFLICT (key) 
DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active,
  active_countries = EXCLUDED.active_countries,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- 2. RIDES AI AGENT
INSERT INTO whatsapp_home_menu_items (
  id,
  key,
  name,
  icon,
  is_active,
  active_countries,
  display_order,
  created_at,
  updated_at
)
VALUES (
  'a1000002-0000-0000-0000-000000000002'::uuid,
  'rides_agent',
  'Rides AI',
  '🚗',
  true,
  ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'],
  2,
  NOW(),
  NOW()
)
ON CONFLICT (key) 
DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active,
  active_countries = EXCLUDED.active_countries,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- 3. JOBS AI AGENT
INSERT INTO whatsapp_home_menu_items (
  id,
  key,
  name,
  icon,
  is_active,
  active_countries,
  display_order,
  created_at,
  updated_at
)
VALUES (
  'a1000003-0000-0000-0000-000000000003'::uuid,
  'jobs_agent',
  'Jobs AI',
  '💼',
  true,
  ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'],
  3,
  NOW(),
  NOW()
)
ON CONFLICT (key) 
DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active,
  active_countries = EXCLUDED.active_countries,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- 4. BUSINESS BROKER AI AGENT
INSERT INTO whatsapp_home_menu_items (
  id,
  key,
  name,
  icon,
  is_active,
  active_countries,
  display_order,
  created_at,
  updated_at
)
VALUES (
  'a1000004-0000-0000-0000-000000000004'::uuid,
  'business_broker_agent',
  'Business Finder',
  '🏪',
  true,
  ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'],
  4,
  NOW(),
  NOW()
)
ON CONFLICT (key) 
DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active,
  active_countries = EXCLUDED.active_countries,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- 5. REAL ESTATE AI AGENT
INSERT INTO whatsapp_home_menu_items (
  id,
  key,
  name,
  icon,
  is_active,
  active_countries,
  display_order,
  created_at,
  updated_at
)
VALUES (
  'a1000005-0000-0000-0000-000000000005'::uuid,
  'real_estate_agent',
  'Property AI',
  '🏠',
  true,
  ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'],
  5,
  NOW(),
  NOW()
)
ON CONFLICT (key) 
DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active,
  active_countries = EXCLUDED.active_countries,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- 6. FARMER AI AGENT
INSERT INTO whatsapp_home_menu_items (
  id,
  key,
  name,
  icon,
  is_active,
  active_countries,
  display_order,
  created_at,
  updated_at
)
VALUES (
  'a1000006-0000-0000-0000-000000000006'::uuid,
  'farmer_agent',
  'Farmer AI',
  '🌾',
  true,
  ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'],
  6,
  NOW(),
  NOW()
)
ON CONFLICT (key) 
DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active,
  active_countries = EXCLUDED.active_countries,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- 7. INSURANCE AI AGENT
INSERT INTO whatsapp_home_menu_items (
  id,
  key,
  name,
  icon,
  is_active,
  active_countries,
  display_order,
  created_at,
  updated_at
)
VALUES (
  'a1000007-0000-0000-0000-000000000007'::uuid,
  'insurance_agent',
  'Insurance AI',
  '🛡️',
  true,
  ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'],
  7,
  NOW(),
  NOW()
)
ON CONFLICT (key) 
DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active,
  active_countries = EXCLUDED.active_countries,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- 8. SALES COLD CALLER AI AGENT (For business owners/sales teams)
INSERT INTO whatsapp_home_menu_items (
  id,
  key,
  name,
  icon,
  is_active,
  active_countries,
  display_order,
  created_at,
  updated_at
)
VALUES (
  'a1000008-0000-0000-0000-000000000008'::uuid,
  'sales_agent',
  'Sales AI',
  '📞',
  true,
  ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'],
  8,
  NOW(),
  NOW()
)
ON CONFLICT (key) 
DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active,
  active_countries = EXCLUDED.active_countries,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- 9. PROFILE (Not an agent, but essential menu item)
INSERT INTO whatsapp_home_menu_items (
  id,
  key,
  name,
  icon,
  is_active,
  active_countries,
  display_order,
  created_at,
  updated_at
)
VALUES (
  'a1000009-0000-0000-0000-000000000009'::uuid,
  'profile',
  'My Profile',
  '👤',
  true,
  ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'],
  9,
  NOW(),
  NOW()
)
ON CONFLICT (key) 
DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active,
  active_countries = EXCLUDED.active_countries,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- =====================================================================
-- 3. ADD COMMENT FOR DOCUMENTATION
-- =====================================================================

COMMENT ON TABLE whatsapp_home_menu_items IS 
'WhatsApp home menu configuration. Aligned with 8 AI agents from ai_agents table + Profile. 
Total 9 items for single-page menu. Updated 2025-11-22.';

COMMIT;

-- =====================================================================
-- VERIFICATION QUERY (Run after migration)
-- =====================================================================
-- SELECT key, name, icon, is_active, display_order, active_countries 
-- FROM whatsapp_home_menu_items 
-- WHERE is_active = true 
-- ORDER BY display_order;
