#!/bin/bash

# Test all agent API endpoints
# Validates that each agent's API is functional

set -e

PROJECT_REF="${SUPABASE_PROJECT_REF:-lhbowpbcpwoiparwnwgt}"
BASE_URL="https://${PROJECT_REF}.supabase.co/functions/v1"
ADMIN_BASE="http://localhost:3000/api"
ANON_KEY="${SUPABASE_ANON_KEY}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
SKIPPED=0

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Agent API Regression Test Suite     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Test function
test_api() {
  local name="$1"
  local method="$2"
  local url="$3"
  local data="$4"
  local expected="$5"
  
  echo -e "${YELLOW}Testing:${NC} $name"
  
  if [ "$method" = "GET" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" "$url" -H "Authorization: Bearer ${ANON_KEY}")
  else
    RESPONSE=$(curl -s -w "\n%{http_code}" -X "$method" "$url" \
      -H "Authorization: Bearer ${ANON_KEY}" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | head -n-1)
  
  if echo "$BODY" | grep -q "$expected" || [ "$HTTP_CODE" -ge 200 -a "$HTTP_CODE" -lt 300 ]; then
    echo -e "${GREEN}✅ PASSED${NC} (HTTP $HTTP_CODE)"
    ((PASSED++))
  else
    echo -e "${RED}❌ FAILED${NC} (HTTP $HTTP_CODE)"
    echo "Response: $BODY"
    ((FAILED++))
  fi
  echo ""
}

test_api_skip() {
  local name="$1"
  echo -e "${YELLOW}Testing:${NC} $name"
  echo -e "${BLUE}⏭️  SKIPPED${NC} (Not yet implemented)"
  ((SKIPPED++))
  echo ""
}

# ===== ADMIN API TESTS =====
echo -e "${BLUE}=== Admin API Tests ===${NC}"
echo ""

test_api \
  "Admin - Get Sessions" \
  "GET" \
  "${ADMIN_BASE}/agents/sessions?limit=10" \
  "" \
  "sessions"

test_api \
  "Admin - Get Quotes" \
  "GET" \
  "${ADMIN_BASE}/agents/quotes?limit=10" \
  "" \
  "quotes"

test_api \
  "Admin - Health Check" \
  "GET" \
  "${ADMIN_BASE}/health" \
  "" \
  "status"

# ===== SUPABASE FUNCTION TESTS =====
echo -e "${BLUE}=== Supabase Function Tests ===${NC}"
echo ""

test_api \
  "WhatsApp Webhook - Verification" \
  "GET" \
  "${BASE_URL}/wa-webhook?hub.mode=subscribe&hub.verify_token=test&hub.challenge=test123" \
  "" \
  "test123"

test_api \
  "Agent Runner - Health" \
  "GET" \
  "${BASE_URL}/agent-runner" \
  "" \
  "feature_disabled"

# ===== AGENT ENDPOINT TESTS =====
echo -e "${BLUE}=== Agent Endpoint Tests ===${NC}"
echo ""

# 1. Driver Negotiation
test_api \
  "Driver Negotiation" \
  "POST" \
  "${BASE_URL}/agent-driver-negotiation" \
  '{"userId":"test-user","location":{"latitude":-1.9705786,"longitude":30.1044288}}' \
  "session"

# 2. Pharmacy Orders
test_api \
  "Pharmacy Orders" \
  "POST" \
  "${BASE_URL}/agent-pharmacy" \
  '{"userId":"test-user","location":{"latitude":-1.9705786,"longitude":30.1044288},"items":["paracetamol"]}' \
  "success"

# 3. Shops & Services
test_api \
  "Shops & Services" \
  "POST" \
  "${BASE_URL}/agent-shops" \
  '{"userId":"test-user","location":{"latitude":-1.9705786,"longitude":30.1044288},"products":["phone"]}' \
  "success"

# 4. Hardware/Quincaillerie
test_api \
  "Hardware/Quincaillerie" \
  "POST" \
  "${BASE_URL}/agent-quincaillerie" \
  '{"userId":"test-user","location":{"latitude":-1.9705786,"longitude":30.1044288},"items":["cement"]}' \
  "success"

# 5. Property Rental
test_api \
  "Property Rental" \
  "POST" \
  "${BASE_URL}/agent-property-rental" \
  '{"userId":"test-user","action":"find","rentalType":"long_term","bedrooms":2,"location":{"latitude":-1.9705786,"longitude":30.1044288}}' \
  "success"

# 6. Schedule Trip
TOMORROW=$(date -u -d "+1 day" +"%Y-%m-%dT08:00:00Z" 2>/dev/null || date -u -v+1d +"%Y-%m-%dT08:00:00Z")
test_api \
  "Schedule Trip" \
  "POST" \
  "${BASE_URL}/agent-schedule-trip" \
  "{\"userId\":\"test-user\",\"pickupLocation\":{\"latitude\":-1.9705786,\"longitude\":30.1044288},\"dropoffLocation\":{\"latitude\":-1.9536311,\"longitude\":30.0605689},\"scheduledTime\":\"${TOMORROW}\"}" \
  "success"

# 7. Marketplace
test_api_skip "Marketplace Agent"

# 8. Fuel Delivery
test_api_skip "Fuel Delivery Agent"

# 9. Food Delivery
test_api_skip "Food Delivery Agent"

# 10. Grocery Delivery
test_api_skip "Grocery Delivery Agent"

# 11. Laundry Services
test_api_skip "Laundry Services Agent"

# 12. Car Wash
test_api_skip "Car Wash Agent"

# 13. Beauty/Salon
test_api_skip "Beauty/Salon Agent"

# 14. Home Cleaning
test_api_skip "Home Cleaning Agent"

# 15. Tutoring
test_api_skip "Tutoring Agent"

# ===== SUMMARY =====
echo ""
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Test Summary                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Passed:  $PASSED${NC}"
echo -e "${RED}❌ Failed:  $FAILED${NC}"
echo -e "${BLUE}⏭️  Skipped: $SKIPPED${NC}"
echo ""

TOTAL=$((PASSED + FAILED + SKIPPED))
SUCCESS_RATE=$((PASSED * 100 / (PASSED + FAILED + 1)))

echo -e "Success Rate: ${SUCCESS_RATE}%"
echo ""

if [ $FAILED -gt 0 ]; then
  echo -e "${RED}⚠️  Some tests failed. Review the output above.${NC}"
  exit 1
else
  echo -e "${GREEN}🎉 All tests passed!${NC}"
  exit 0
fi
