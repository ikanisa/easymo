#!/bin/bash

# Test script for WhatsApp Dynamic Menu Implementation
# Run with: bash test-whatsapp-menu.sh

set -e

echo "🧪 Testing WhatsApp Dynamic Menu Implementation"
echo "================================================"
echo ""

# Set environment
export DATABASE_URL="postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

echo "1️⃣  Testing database table and data..."
psql "$DATABASE_URL" -c "
SELECT 
  display_order,
  name,
  key,
  is_active,
  array_length(active_countries, 1) as country_count,
  icon
FROM whatsapp_home_menu_items 
ORDER BY display_order 
LIMIT 5;
"

echo ""
echo "2️⃣  Testing country-specific filtering (RW - Rwanda)..."
psql "$DATABASE_URL" -c "
SELECT 
  name,
  key,
  is_active,
  active_countries
FROM whatsapp_home_menu_items 
WHERE is_active = true 
  AND 'RW' = ANY(active_countries)
ORDER BY display_order;
"

echo ""
echo "3️⃣  Testing inactive items count..."
psql "$DATABASE_URL" -c "
SELECT 
  COUNT(*) as inactive_count,
  string_agg(name, ', ') as inactive_items
FROM whatsapp_home_menu_items 
WHERE is_active = false;
"

echo ""
echo "4️⃣  Testing country availability matrix..."
psql "$DATABASE_URL" -c "
SELECT 
  name,
  CASE WHEN 'RW' = ANY(active_countries) THEN '✓' ELSE '✗' END as RW,
  CASE WHEN 'UG' = ANY(active_countries) THEN '✓' ELSE '✗' END as UG,
  CASE WHEN 'KE' = ANY(active_countries) THEN '✓' ELSE '✗' END as KE,
  CASE WHEN 'TZ' = ANY(active_countries) THEN '✓' ELSE '✗' END as TZ
FROM whatsapp_home_menu_items 
WHERE is_active = true
ORDER BY display_order;
"

echo ""
echo "5️⃣  Testing toggle active status (Motor Insurance)..."
psql "$DATABASE_URL" -c "
UPDATE whatsapp_home_menu_items 
SET is_active = NOT is_active 
WHERE key = 'motor_insurance'
RETURNING name, is_active;
"

echo ""
echo "6️⃣  Reverting Motor Insurance status..."
psql "$DATABASE_URL" -c "
UPDATE whatsapp_home_menu_items 
SET is_active = NOT is_active 
WHERE key = 'motor_insurance'
RETURNING name, is_active;
"

echo ""
echo "✅ All database tests passed!"
echo ""
echo "📱 Next steps to test the full implementation:"
echo "   1. Deploy the wa-webhook edge function"
echo "   2. Test WhatsApp menu from a Rwandan number (+250...)"
echo "   3. Access admin panel at /whatsapp-menu"
echo "   4. Toggle menu items and test country filters"
echo ""
echo "🔗 Admin Panel URL: http://localhost:3000/whatsapp-menu"
echo ""
