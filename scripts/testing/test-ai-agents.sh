#!/bin/bash

# AI Agents Testing Script
# Tests all deployed agent functions

set -e

PROJECT_REF="lhbowpbcpwoiparwnwgt"
BASE_URL="https://${PROJECT_REF}.supabase.co/functions/v1"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcndud2d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NTgxMjcsImV4cCI6MjA3NjEzNDEyN30.egf4IDQpkHCpDKeyF63G72jQmIBcgWMHmj7FVt5xgAA"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 Testing AI Agent Functions"
echo "=============================="
echo ""

# Test 1: Property Rental Agent
echo -e "${YELLOW}Test 1: Property Rental Agent (Find)${NC}"
RESPONSE=$(curl -s -X POST "${BASE_URL}/agent-property-rental" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123",
    "action": "find",
    "rentalType": "long_term",
    "bedrooms": 2,
    "minBudget": 50000,
    "maxBudget": 150000,
    "location": {
      "latitude": -1.9705786,
      "longitude": 30.1044288
    },
    "address": "Kigali, Rwanda"
  }')

if echo "$RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✅ Property Rental Agent: PASSED${NC}"
else
    echo -e "${RED}❌ Property Rental Agent: FAILED${NC}"
    echo "Response: $RESPONSE"
fi
echo ""

# Test 2: Schedule Trip Agent
echo -e "${YELLOW}Test 2: Schedule Trip Agent${NC}"
TOMORROW=$(date -u -d "+1 day" +"%Y-%m-%dT08:00:00Z" 2>/dev/null || date -u -v+1d +"%Y-%m-%dT08:00:00Z")
RESPONSE=$(curl -s -X POST "${BASE_URL}/agent-schedule-trip" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"test-user-123\",
    \"pickupLocation\": {
      \"latitude\": -1.9705786,
      \"longitude\": 30.1044288,
      \"address\": \"Kigali City Center\"
    },
    \"dropoffLocation\": {
      \"latitude\": -1.9536311,
      \"longitude\": 30.0605689,
      \"address\": \"Kigali Airport\"
    },
    \"scheduledTime\": \"${TOMORROW}\",
    \"vehiclePreference\": \"Cab\",
    \"recurrence\": \"once\"
  }")

if echo "$RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✅ Schedule Trip Agent: PASSED${NC}"
else
    echo -e "${RED}❌ Schedule Trip Agent: FAILED${NC}"
    echo "Response: $RESPONSE"
fi
echo ""

# Test 3: Quincaillerie Agent
echo -e "${YELLOW}Test 3: Quincaillerie Agent${NC}"
RESPONSE=$(curl -s -X POST "${BASE_URL}/agent-quincaillerie" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123",
    "location": {
      "latitude": -1.9705786,
      "longitude": 30.1044288
    },
    "items": ["cement", "nails", "hammer"]
  }')

if echo "$RESPONSE" | grep -q "success" || echo "$RESPONSE" | grep -q "searching"; then
    echo -e "${GREEN}✅ Quincaillerie Agent: PASSED${NC}"
else
    echo -e "${RED}❌ Quincaillerie Agent: FAILED${NC}"
    echo "Response: $RESPONSE"
fi
echo ""

# Test 4: Shops Agent
echo -e "${YELLOW}Test 4: Shops Agent${NC}"
RESPONSE=$(curl -s -X POST "${BASE_URL}/agent-shops" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123",
    "location": {
      "latitude": -1.9705786,
      "longitude": 30.1044288
    },
    "products": ["phone", "charger"]
  }')

if echo "$RESPONSE" | grep -q "success" || echo "$RESPONSE" | grep -q "searching"; then
    echo -e "${GREEN}✅ Shops Agent: PASSED${NC}"
else
    echo -e "${RED}❌ Shops Agent: FAILED${NC}"
    echo "Response: $RESPONSE"
fi
echo ""

# Test 5: Agent Runner Health Check
echo -e "${YELLOW}Test 5: Agent Runner${NC}"
RESPONSE=$(curl -s -X GET "${BASE_URL}/agent-runner" \
  -H "Authorization: Bearer ${ANON_KEY}")

if echo "$RESPONSE" | grep -q "feature_disabled" || echo "$RESPONSE" | grep -q "method"; then
    echo -e "${GREEN}✅ Agent Runner: ONLINE${NC}"
else
    echo -e "${RED}❌ Agent Runner: OFFLINE${NC}"
    echo "Response: $RESPONSE"
fi
echo ""

# Test 6: WhatsApp Webhook Health
echo -e "${YELLOW}Test 6: WhatsApp Webhook${NC}"
RESPONSE=$(curl -s -X GET "${BASE_URL}/wa-webhook?hub.mode=subscribe&hub.verify_token=test&hub.challenge=test_challenge")

if echo "$RESPONSE" | grep -q "test_challenge" || echo "$RESPONSE" | grep -q "403"; then
    echo -e "${GREEN}✅ WhatsApp Webhook: ONLINE${NC}"
else
    echo -e "${RED}❌ WhatsApp Webhook: OFFLINE${NC}"
    echo "Response: $RESPONSE"
fi
echo ""

echo "=============================="
echo "🎉 Testing Complete!"
echo ""
echo "Next Steps:"
echo "1. Check Supabase Dashboard for function logs"
echo "2. Test WhatsApp flows manually"
echo "3. Monitor agent_sessions table for activity"
echo "4. Review agent_quotes for negotiation results"
echo ""
echo "Supabase Dashboard: https://supabase.com/dashboard/project/${PROJECT_REF}/functions"
