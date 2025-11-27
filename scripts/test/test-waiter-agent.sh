#!/bin/bash
# =====================================================================
# TEST WAITER AGENT - End-to-End
# =====================================================================
# Tests the complete Waiter Agent flow with real queries
# =====================================================================

set -e

echo "🧪 Testing Waiter Agent - Complete Flow"
echo "========================================"
echo ""

# Get Supabase project details
PROJECT_URL=$(supabase status 2>/dev/null | grep "API URL" | awk '{print $3}' || echo "https://YOUR_PROJECT.supabase.co")
ANON_KEY=$(supabase status 2>/dev/null | grep "anon key" | awk '{print $3}' || echo "YOUR_ANON_KEY")

if [ "$PROJECT_URL" == "https://YOUR_PROJECT.supabase.co" ]; then
    echo "⚠️  Warning: Could not auto-detect Supabase project."
    echo "Please update PROJECT_URL and ANON_KEY in this script."
    echo ""
    read -p "Enter your Supabase project URL: " PROJECT_URL
    read -p "Enter your anon key: " ANON_KEY
fi

TEST_PHONE="+250788999001"

echo "Using project: $PROJECT_URL"
echo "Test phone: $TEST_PHONE"
echo ""

# Test 1: Search for bars
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 1: Search for Bars"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Sending: 'Show me bars near me'"
echo ""

curl -s -X POST "${PROJECT_URL}/functions/v1/agent-framework-test" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d '{
    "agentSlug": "waiter",
    "userPhone": "'${TEST_PHONE}'",
    "message": "Show me bars near me"
  }' | jq '.'

echo ""
echo "Press Enter to continue..."
read

# Test 2: View bar details
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 2: View Bar Menu"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Sending: 'Show me the menu'"
echo ""

curl -s -X POST "${PROJECT_URL}/functions/v1/agent-framework-test" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d '{
    "agentSlug": "waiter",
    "userPhone": "'${TEST_PHONE}'",
    "message": "Show me the menu"
  }' | jq '.'

echo ""
echo "Press Enter to continue..."
read

# Test 3: Place order
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 3: Place Order"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Sending: 'I want to order 2 beers and 1 fries'"
echo ""

curl -s -X POST "${PROJECT_URL}/functions/v1/agent-framework-test" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d '{
    "agentSlug": "waiter",
    "userPhone": "'${TEST_PHONE}'",
    "message": "I want to order 2 beers and 1 fries"
  }' | jq '.'

echo ""
echo "Press Enter to continue..."
read

# Test 4: View order history
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 4: View Order History"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Sending: 'Show my recent orders'"
echo ""

curl -s -X POST "${PROJECT_URL}/functions/v1/agent-framework-test" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d '{
    "agentSlug": "waiter",
    "userPhone": "'${TEST_PHONE}'",
    "message": "Show my recent orders"
  }' | jq '.'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Tests Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. Check database for created records:"
echo "   supabase db query \"SELECT * FROM whatsapp_messages ORDER BY sent_at DESC LIMIT 5;\""
echo "   supabase db query \"SELECT * FROM ai_agent_intents ORDER BY created_at DESC LIMIT 5;\""
echo "   supabase db query \"SELECT * FROM orders ORDER BY created_at DESC LIMIT 3;\""
echo ""
echo "2. Test with real WhatsApp (if feature flag enabled):"
echo "   Send '1' to your WhatsApp number → Select Waiter"
echo "   Send 'Show me bars' → Agent responds"
echo ""
echo "3. Monitor logs:"
echo "   supabase functions logs agent-framework-test --tail"
echo "   supabase functions logs wa-webhook-consolidated --tail"
