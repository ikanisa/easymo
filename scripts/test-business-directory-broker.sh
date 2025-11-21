#!/bin/bash

# Test Business Directory Integration with Broker Agent
# This script tests the new business search features

set -e

SUPABASE_URL="https://lhbowpbcpwoiparwnwgt.supabase.co"
FUNCTION_URL="$SUPABASE_URL/functions/v1/agent-tools-general-broker"

# Get service role key from .env
SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env | cut -d= -f2 | tr -d '"')

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "❌ SUPABASE_SERVICE_ROLE_KEY not found in .env"
  exit 1
fi

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║     Testing Business Directory - Broker AI Integration          ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Test 1: Search by category
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 1: Search restaurants in Kigali"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "search_business_directory",
    "userId": "test-user",
    "category": "Restaurant",
    "city": "Kigali",
    "limit": 5
  }')

echo "Response:"
echo "$RESPONSE" | jq .
echo ""

# Test 2: Search by text query
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 2: Text search for 'coffee'"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "search_business_directory",
    "userId": "test-user",
    "query": "coffee",
    "limit": 5
  }')

echo "Response:"
echo "$RESPONSE" | jq .
echo ""

# Test 3: Search by rating
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 3: High-rated businesses (rating >= 4.5)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "search_business_directory",
    "userId": "test-user",
    "minRating": 4.5,
    "limit": 5
  }')

echo "Response:"
echo "$RESPONSE" | jq .
echo ""

# Test 4: Location-based search
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 4: Businesses near Kigali city center (within 5km)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "search_business_by_location",
    "userId": "test-user",
    "latitude": -1.9536,
    "longitude": 30.0606,
    "radiusKm": 5,
    "limit": 5
  }')

echo "Response:"
echo "$RESPONSE" | jq .
echo ""

# Test 5: Get business details
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 5: Get details for first business"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get first business ID
BUSINESS_ID=$(psql "postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" \
  -t -c "SELECT id FROM business_directory LIMIT 1" | xargs)

if [ -n "$BUSINESS_ID" ]; then
  RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"action\": \"get_business_details\",
      \"userId\": \"test-user\",
      \"businessId\": \"$BUSINESS_ID\"
    }")

  echo "Response:"
  echo "$RESPONSE" | jq .
else
  echo "⚠️  No businesses in database to test"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Tests Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next Steps:"
echo "1. Test via WhatsApp: Send message to your EasyMO number"
echo "2. Example: 'Find me restaurants in Kigali'"
echo "3. Example: 'I need a cafe near me'"
echo "4. Example: 'Show me hotels with rating above 4'"
echo ""
echo "View logs: supabase functions logs agent-tools-general-broker"
echo ""
