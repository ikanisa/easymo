#!/bin/bash
# Test property rental routing

echo "=== Property Rental Routing Test ==="
echo ""

# Test 1: Check if wa-webhook-property function exists
echo "Test 1: Checking if wa-webhook-property is deployed..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-property")
if [ "$STATUS" -eq 200 ] || [ "$STATUS" -eq 401 ]; then
  echo "✅ wa-webhook-property exists (HTTP $STATUS)"
else
  echo "❌ wa-webhook-property NOT deployed (HTTP $STATUS)"
fi
echo ""

# Test 2: Check if wa-webhook-core function exists
echo "Test 2: Checking if wa-webhook-core is deployed..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core")
if [ "$STATUS" -eq 200 ] || [ "$STATUS" -eq 401 ]; then
  echo "✅ wa-webhook-core exists (HTTP $STATUS)"
else
  echo "❌ wa-webhook-core NOT deployed (HTTP $STATUS)"
fi
echo ""

# Test 3: Check menu item in database
echo "Test 3: Checking menu item configuration..."
psql "postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" -c "SELECT key, name, is_active FROM public.whatsapp_home_menu_items WHERE key = 'real_estate_agent';" 2>&1 | grep -v "^$"
echo ""

# Test 4: Check route configuration
echo "Test 4: Route Configuration Check"
echo "Expected routing:"
echo "  Button key: real_estate_agent"
echo "  →  Route config menuKeys: ['property', 'property_rentals', 'real_estate_agent']"
echo "  →  Should route to: wa-webhook-property"
echo ""

echo "=== Summary ==="
echo "If both functions exist and menu item is active,"
echo "the issue is likely in the router logic."
echo ""
echo "Next steps:"
echo "1. Check wa-webhook-core logs for routing decisions"
echo "2. Add console.log to router to see button_id received"
echo "3. Verify button_id matches menuKeys exactly (case-sensitive)"
