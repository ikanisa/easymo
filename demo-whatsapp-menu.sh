#!/bin/bash

# Quick Demo: WhatsApp Dynamic Menu System
# Shows how country-specific menus work

set -e

export DATABASE_URL="postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

echo "🌍 WhatsApp Dynamic Menu - Country Comparison Demo"
echo "===================================================="
echo ""

echo "📱 Menu for Rwanda (+250 numbers):"
echo "-----------------------------------"
psql "$DATABASE_URL" -t -A -F$'\t' -c "
SELECT 
  CONCAT(icon, ' ', name) as menu_item
FROM whatsapp_home_menu_items 
WHERE is_active = true 
  AND 'RW' = ANY(active_countries)
ORDER BY display_order;
" | nl -w2 -s'. '

echo ""
echo "📱 Menu for Uganda (+256 numbers):"
echo "-----------------------------------"
psql "$DATABASE_URL" -t -A -F$'\t' -c "
SELECT 
  CONCAT(icon, ' ', name) as menu_item
FROM whatsapp_home_menu_items 
WHERE is_active = true 
  AND 'UG' = ANY(active_countries)
ORDER BY display_order;
" | nl -w2 -s'. '

echo ""
echo "🔧 Now deactivating 'MOMO QR Code' to demonstrate dynamic changes..."
psql "$DATABASE_URL" -c "UPDATE whatsapp_home_menu_items SET is_active = false WHERE key = 'momo_qr';" > /dev/null

echo ""
echo "📱 Updated Rwanda menu (MOMO QR removed):"
echo "-----------------------------------"
psql "$DATABASE_URL" -t -A -F$'\t' -c "
SELECT 
  CONCAT(icon, ' ', name) as menu_item
FROM whatsapp_home_menu_items 
WHERE is_active = true 
  AND 'RW' = ANY(active_countries)
ORDER BY display_order;
" | nl -w2 -s'. '

echo ""
echo "✅ Reverting changes..."
psql "$DATABASE_URL" -c "UPDATE whatsapp_home_menu_items SET is_active = true WHERE key = 'momo_qr';" > /dev/null

echo ""
echo "✨ Key Features Demonstrated:"
echo "  ✓ Country-specific menu filtering"
echo "  ✓ Real-time toggle (active/inactive)"
echo "  ✓ Changes apply immediately"
echo "  ✓ Different countries see different menus"
echo ""
echo "🎯 Admin Panel: http://localhost:3000/whatsapp-menu"
echo ""
