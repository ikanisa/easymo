-- =====================================================================
-- CLEAN UP WHATSAPP HOME MENU TO 9 CANONICAL ITEMS
-- =====================================================================
-- This migration consolidates whatsapp_home_menu_items from 20+ items
-- to exactly 9 active items: 8 AI agents + Profile
-- 
-- Safe approach:
-- 1. Create backup table with all current rows
-- 2. Update/insert the 9 canonical items with correct UUIDs and names
-- 3. Set all other items to is_active = false (soft delete)
-- 4. Add documentation comments
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. CREATE BACKUP TABLE (ONE-TIME ONLY)
-- =====================================================================

-- Create legacy backup table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.whatsapp_home_menu_items_legacy (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL,
  active_countries TEXT[] NOT NULL,
  display_order INTEGER NOT NULL,
  icon TEXT,
  country_specific_names JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Copy all current rows to legacy table (only if legacy table is empty)
INSERT INTO public.whatsapp_home_menu_items_legacy (
  id, name, key, is_active, active_countries, display_order, 
  icon, country_specific_names, created_at, updated_at
)
SELECT 
  id, name, key, is_active, active_countries, display_order, 
  icon, country_specific_names, created_at, updated_at
FROM public.whatsapp_home_menu_items
WHERE NOT EXISTS (SELECT 1 FROM public.whatsapp_home_menu_items_legacy LIMIT 1);

COMMENT ON TABLE public.whatsapp_home_menu_items_legacy IS 
'Backup of whatsapp_home_menu_items before cleanup on 2025-11-22. Contains all rows before consolidation to 9 canonical items.';

-- =====================================================================
-- 2. UPSERT THE 9 CANONICAL MENU ITEMS (8 AGENTS + PROFILE)
-- =====================================================================

-- 1. WAITER AI AGENT
INSERT INTO public.whatsapp_home_menu_items (
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
  id = EXCLUDED.id,
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active,
  active_countries = EXCLUDED.active_countries,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- 2. RIDES AI AGENT
INSERT INTO public.whatsapp_home_menu_items (
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
  id = EXCLUDED.id,
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active,
  active_countries = EXCLUDED.active_countries,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- 3. JOBS AI AGENT
INSERT INTO public.whatsapp_home_menu_items (
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
  id = EXCLUDED.id,
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active,
  active_countries = EXCLUDED.active_countries,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- 4. BUSINESS BROKER AI AGENT (renamed from "Business Finder")
INSERT INTO public.whatsapp_home_menu_items (
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
  'Business Broker',
  '🏪',
  true,
  ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'],
  4,
  NOW(),
  NOW()
)
ON CONFLICT (key) 
DO UPDATE SET
  id = EXCLUDED.id,
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active,
  active_countries = EXCLUDED.active_countries,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- 5. REAL ESTATE AI AGENT (renamed from "Property AI")
INSERT INTO public.whatsapp_home_menu_items (
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
  'Real Estate',
  '🏠',
  true,
  ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'],
  5,
  NOW(),
  NOW()
)
ON CONFLICT (key) 
DO UPDATE SET
  id = EXCLUDED.id,
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active,
  active_countries = EXCLUDED.active_countries,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- 6. FARMER AI AGENT
INSERT INTO public.whatsapp_home_menu_items (
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
  'b1ef9975-27b1-4f67-848d-0c21c0ada9d2'::uuid,
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
  id = EXCLUDED.id,
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active,
  active_countries = EXCLUDED.active_countries,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- 7. INSURANCE AI AGENT
INSERT INTO public.whatsapp_home_menu_items (
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
  '382626fc-e270-4d2c-8b47-cc606ebc0592'::uuid,
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
  id = EXCLUDED.id,
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active,
  active_countries = EXCLUDED.active_countries,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- 8. SALES SDR AI AGENT (renamed from "Sales AI")
INSERT INTO public.whatsapp_home_menu_items (
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
  'Sales SDR',
  '📞',
  true,
  ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'],
  8,
  NOW(),
  NOW()
)
ON CONFLICT (key) 
DO UPDATE SET
  id = EXCLUDED.id,
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active,
  active_countries = EXCLUDED.active_countries,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- 9. PROFILE (renamed from "My Profile")
INSERT INTO public.whatsapp_home_menu_items (
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
  'Profile',
  '👤',
  true,
  ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'],
  9,
  NOW(),
  NOW()
)
ON CONFLICT (key) 
DO UPDATE SET
  id = EXCLUDED.id,
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active,
  active_countries = EXCLUDED.active_countries,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- =====================================================================
-- 3. DEACTIVATE ALL OTHER (LEGACY) ITEMS
-- =====================================================================

-- Set is_active = false for all items that are NOT in the canonical 9
UPDATE public.whatsapp_home_menu_items
SET 
  is_active = false,
  updated_at = NOW()
WHERE key NOT IN (
  'waiter_agent',
  'rides_agent',
  'jobs_agent',
  'business_broker_agent',
  'real_estate_agent',
  'farmer_agent',
  'insurance_agent',
  'sales_agent',
  'profile'
);

-- =====================================================================
-- 4. UPDATE TABLE DOCUMENTATION
-- =====================================================================

COMMENT ON TABLE public.whatsapp_home_menu_items IS 
'WhatsApp home menu configuration with exactly 9 active items: 8 AI agents + Profile.
Legacy items are kept with is_active=false for backward compatibility.
Updated 2025-11-22 to consolidate from 20+ items to 9 canonical items.';

COMMENT ON COLUMN public.whatsapp_home_menu_items.key IS 
'Unique menu item key. Canonical keys: waiter_agent, rides_agent, jobs_agent, 
business_broker_agent, real_estate_agent, farmer_agent, insurance_agent, sales_agent, profile.
Legacy keys are preserved but marked inactive for alias routing in code.';

COMMENT ON COLUMN public.whatsapp_home_menu_items.is_active IS 
'Only 9 items should have is_active=true. UI queries should filter by this field.';

COMMIT;

-- =====================================================================
-- VERIFICATION QUERIES
-- =====================================================================

-- Run these after migration to verify:
-- 
-- -- Should return exactly 9 rows
-- SELECT key, name, icon, is_active, display_order 
-- FROM whatsapp_home_menu_items 
-- WHERE is_active = true 
-- ORDER BY display_order;
--
-- -- Should show all legacy items (inactive)
-- SELECT key, name, is_active 
-- FROM whatsapp_home_menu_items 
-- WHERE is_active = false 
-- ORDER BY key;
--
-- -- Check backup was created
-- SELECT COUNT(*) as backed_up_count 
-- FROM whatsapp_home_menu_items_legacy;
