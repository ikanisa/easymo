#!/bin/bash
# Quick test script for rides consolidation

echo "🧪 Testing Rides Menu Consolidation..."
echo ""

echo "1️⃣ Checking migration file..."
if [ -f "supabase/migrations/20251121104249_consolidate_rides_menu.sql" ]; then
  echo "✅ Migration file exists"
else
  echo "❌ Migration file missing!"
  exit 1
fi

echo ""
echo "2️⃣ Checking rides menu handler..."
if [ -f "supabase/functions/wa-webhook/domains/mobility/rides_menu.ts" ]; then
  echo "✅ Rides menu handler exists"
else
  echo "❌ Rides menu handler missing!"
  exit 1
fi

echo ""
echo "3️⃣ Checking translation keys..."
if grep -q '"rides.menu.title"' supabase/functions/wa-webhook/i18n/messages/en.json; then
  echo "✅ English translations added"
else
  echo "❌ English translations missing!"
  exit 1
fi

if grep -q '"rides.menu.title"' supabase/functions/wa-webhook/i18n/messages/fr.json; then
  echo "✅ French translations added"
else
  echo "❌ French translations missing!"
  exit 1
fi

echo ""
echo "4️⃣ Checking IDS constant..."
if grep -q 'RIDES_MENU:' supabase/functions/wa-webhook/wa/ids.ts; then
  echo "✅ RIDES_MENU constant added"
else
  echo "❌ RIDES_MENU constant missing!"
  exit 1
fi

echo ""
echo "5️⃣ Checking router updates..."
if grep -q 'showRidesMenu' supabase/functions/wa-webhook/router/interactive_list.ts; then
  echo "✅ List router updated"
else
  echo "❌ List router not updated!"
  exit 1
fi

if grep -q 'showRidesMenu' supabase/functions/wa-webhook/router/interactive_button.ts; then
  echo "✅ Button router updated"
else
  echo "❌ Button router not updated!"
  exit 1
fi

echo ""
echo "6️⃣ Checking menu configuration..."
if grep -q '"rides"' supabase/functions/wa-webhook/domains/menu/dynamic_home_menu.ts; then
  echo "✅ Menu configuration updated"
else
  echo "❌ Menu configuration not updated!"
  exit 1
fi

echo ""
echo "════════════════════════════════════════"
echo "✅ All checks passed!"
echo "════════════════════════════════════════"
echo ""
echo "Ready to deploy with: ./deploy-rides-consolidation.sh"
echo ""
