#!/bin/bash

# Test Business Categories and WhatsApp Menu Integration
# This script verifies the complete linking system

set -e

export DATABASE_URL="postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

echo "🔗 Business Categories <-> WhatsApp Menu Integration Test"
echo "=========================================================="
echo ""

echo "1️⃣  Marketplace Categories (Business Types):"
echo "--------------------------------------------"
psql "$DATABASE_URL" -c "
SELECT 
  id,
  name,
  slug,
  icon,
  is_active,
  sort_order
FROM marketplace_categories
ORDER BY sort_order;
"

echo ""
echo "2️⃣  Categories Linked to WhatsApp Menu Items:"
echo "--------------------------------------------"
psql "$DATABASE_URL" -c "
SELECT 
  mc.name as category,
  mc.icon,
  wm.key as menu_key,
  wm.is_active as menu_active,
  array_length(wm.active_countries, 1) as num_countries
FROM marketplace_categories mc
JOIN whatsapp_home_menu_items wm ON mc.menu_item_id = wm.id
ORDER BY mc.sort_order;
"

echo ""
echo "3️⃣  Businesses by Category:"
echo "---------------------------"
psql "$DATABASE_URL" -c "
SELECT 
  category_name,
  COUNT(*) as business_count
FROM businesses
GROUP BY category_name
ORDER BY business_count DESC;
"

echo ""
echo "4️⃣  Sample Business with Full Category/Menu Info:"
echo "--------------------------------------------------"
psql "$DATABASE_URL" -c "
SELECT 
  business_name,
  category_name,
  category_icon,
  menu_key,
  menu_active,
  menu_countries
FROM business_category_menu_view
LIMIT 3;
"

echo ""
echo "5️⃣  Test: Get Businesses for a Menu Item (Shops & Services):"
echo "-------------------------------------------------------------"
psql "$DATABASE_URL" -c "
SELECT 
  b.name as business,
  b.category_name,
  b.location_text
FROM businesses b
JOIN marketplace_categories mc ON b.category_name = mc.name
JOIN whatsapp_home_menu_items wm ON mc.menu_item_id = wm.id
WHERE wm.key = 'shops_services'
LIMIT 5;
"

echo ""
echo "6️⃣  Test: Which Menu Items Have Business Categories:"
echo "-----------------------------------------------------"
psql "$DATABASE_URL" -c "
SELECT 
  wm.name as menu_item,
  wm.key,
  COUNT(mc.id) as category_count,
  string_agg(mc.name, ', ') as categories
FROM whatsapp_home_menu_items wm
LEFT JOIN marketplace_categories mc ON wm.id = mc.menu_item_id
GROUP BY wm.id, wm.name, wm.key
ORDER BY wm.display_order;
"

echo ""
echo "7️⃣  Test: Category Availability by Country:"
echo "-------------------------------------------"
psql "$DATABASE_URL" -c "
SELECT 
  mc.name as category,
  CASE WHEN 'RW' = ANY(wm.active_countries) THEN '✓' ELSE '✗' END as RW,
  CASE WHEN 'UG' = ANY(wm.active_countries) THEN '✓' ELSE '✗' END as UG,
  CASE WHEN 'KE' = ANY(wm.active_countries) THEN '✓' ELSE '✗' END as KE
FROM marketplace_categories mc
JOIN whatsapp_home_menu_items wm ON mc.menu_item_id = wm.id
ORDER BY mc.sort_order;
"

echo ""
echo "✅ All Tests Completed!"
echo ""
echo "📊 Summary:"
echo "  - marketplace_categories: Business type classifications"
echo "  - whatsapp_home_menu_items: Menu entries shown to users"
echo "  - businesses: Actual listings with category_name"
echo "  - Link: categories.menu_item_id -> menu_items.id"
echo "  - Link: businesses.category_name -> categories.name"
echo ""
echo "🔧 Usage Examples:"
echo "  - Toggle menu item: affects category visibility"
echo "  - Change country: filters which categories appear"
echo "  - Add business: must use valid category_name"
echo ""
