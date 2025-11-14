BEGIN;

-- =====================================================
-- Migration: Link Business Categories to WhatsApp Menu
-- =====================================================
-- This migration creates a proper category system that links:
-- 1. marketplace_categories (business types)
-- 2. whatsapp_home_menu_items (menu entries)
-- 3. businesses (actual business listings)

-- Step 1: Add menu_item_id to whatsapp_home_menu_items for self-reference
ALTER TABLE whatsapp_home_menu_items 
ADD COLUMN IF NOT EXISTS menu_item_id UUID;

-- Step 2: Add category_name to businesses table (keeping category_id for now)
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS category_name TEXT;

-- Step 3: Add menu_item_id to marketplace_categories
ALTER TABLE marketplace_categories 
ADD COLUMN IF NOT EXISTS menu_item_id UUID REFERENCES whatsapp_home_menu_items(id) ON DELETE SET NULL;

-- Step 4: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_marketplace_categories_menu_item 
ON marketplace_categories(menu_item_id);

CREATE INDEX IF NOT EXISTS idx_businesses_category_name 
ON businesses(category_name);

-- Step 5: Insert business categories linked to WhatsApp menu items
-- Note: We use ON CONFLICT to avoid duplicates if migration is run multiple times

-- Pharmacies
INSERT INTO marketplace_categories (name, slug, description, icon, is_active, sort_order, menu_item_id)
SELECT 
  'Pharmacies',
  'pharmacies',
  'Medical pharmacies and drugstores',
  '💊',
  true,
  1,
  id
FROM whatsapp_home_menu_items 
WHERE key = 'nearby_pharmacies'
ON CONFLICT (name) DO UPDATE 
SET 
  menu_item_id = EXCLUDED.menu_item_id,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description;

-- Quincailleries (Hardware Stores)
INSERT INTO marketplace_categories (name, slug, description, icon, is_active, sort_order, menu_item_id)
SELECT 
  'Quincailleries',
  'quincailleries',
  'Hardware stores and building materials',
  '🔧',
  true,
  2,
  id
FROM whatsapp_home_menu_items 
WHERE key = 'quincailleries'
ON CONFLICT (name) DO UPDATE 
SET 
  menu_item_id = EXCLUDED.menu_item_id,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description;

-- Shops & Services
INSERT INTO marketplace_categories (name, slug, description, icon, is_active, sort_order, menu_item_id)
SELECT 
  'Shops & Services',
  'shops-services',
  'General shops and service providers',
  '🏪',
  true,
  3,
  id
FROM whatsapp_home_menu_items 
WHERE key = 'shops_services'
ON CONFLICT (name) DO UPDATE 
SET 
  menu_item_id = EXCLUDED.menu_item_id,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description;

-- Property Rentals
INSERT INTO marketplace_categories (name, slug, description, icon, is_active, sort_order, menu_item_id)
SELECT 
  'Property Rentals',
  'property-rentals',
  'Houses, apartments, and rental properties',
  '🏠',
  true,
  4,
  id
FROM whatsapp_home_menu_items 
WHERE key = 'property_rentals'
ON CONFLICT (name) DO UPDATE 
SET 
  menu_item_id = EXCLUDED.menu_item_id,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description;

-- Notary Services
INSERT INTO marketplace_categories (name, slug, description, icon, is_active, sort_order, menu_item_id)
SELECT 
  'Notary Services',
  'notary-services',
  'Legal notary and documentation services',
  '📜',
  true,
  5,
  id
FROM whatsapp_home_menu_items 
WHERE key = 'notary_services'
ON CONFLICT (name) DO UPDATE 
SET 
  menu_item_id = EXCLUDED.menu_item_id,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description;

-- Bars & Restaurants
INSERT INTO marketplace_categories (name, slug, description, icon, is_active, sort_order, menu_item_id)
SELECT 
  'Bars & Restaurants',
  'bars-restaurants',
  'Dining, bars, and food establishments',
  '🍽️',
  true,
  6,
  id
FROM whatsapp_home_menu_items 
WHERE key = 'bars_restaurants'
ON CONFLICT (name) DO UPDATE 
SET 
  menu_item_id = EXCLUDED.menu_item_id,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description;

-- Step 6: Update existing businesses to have category_name based on category_id
-- This creates the link between old category_id and new category_name
UPDATE businesses b
SET category_name = mc.name
FROM marketplace_categories mc
WHERE b.category_id = mc.id
  AND b.category_name IS NULL;

-- Step 7: For any businesses without category, set a default
UPDATE businesses
SET category_name = 'Shops & Services'
WHERE category_name IS NULL;

-- Step 8: Add comment for documentation
COMMENT ON COLUMN marketplace_categories.menu_item_id IS 'Links business category to WhatsApp home menu item';
COMMENT ON COLUMN businesses.category_name IS 'Human-readable category name, linked to marketplace_categories.name';

-- Step 9: Create a view for easy querying of the full relationship
CREATE OR REPLACE VIEW business_category_menu_view AS
SELECT 
  b.id as business_id,
  b.name as business_name,
  b.category_name,
  mc.id as category_id,
  mc.slug as category_slug,
  mc.icon as category_icon,
  wm.id as menu_item_id,
  wm.key as menu_key,
  wm.is_active as menu_active,
  wm.active_countries as menu_countries
FROM businesses b
LEFT JOIN marketplace_categories mc ON b.category_name = mc.name
LEFT JOIN whatsapp_home_menu_items wm ON mc.menu_item_id = wm.id;

COMMENT ON VIEW business_category_menu_view IS 'Shows the complete relationship between businesses, categories, and WhatsApp menu items';

COMMIT;
