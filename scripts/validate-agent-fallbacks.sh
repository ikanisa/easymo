#!/usr/bin/env bash
# Agent Fallback Validation Script
# Phase 3: Exercise and Harden Fallbacks
#
# Tests that all agent APIs properly handle failures and return fallback data

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Config
BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_TOKEN="${ADMIN_TOKEN:-test-token}"
FAILED_TESTS=0
PASSED_TESTS=0

echo "🧪 Agent Fallback Validation"
echo "================================"
echo "Base URL: $BASE_URL"
echo ""

# Test helper function
test_agent_endpoint() {
  local agent_name="$1"
  local endpoint="$2"
  local expected_fallback="${3:-false}"
  
  echo -n "Testing $agent_name... "
  
  response=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$BASE_URL$endpoint" || echo "000")
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" = "200" ]; then
    # Check if response has fallback indicator
    if echo "$body" | grep -q '"integration"'; then
      integration_status=$(echo "$body" | jq -r '.integration.status // "unknown"')
      
      if [ "$integration_status" = "ok" ]; then
        echo -e "${GREEN}✓ OK${NC} (Live data)"
        ((PASSED_TESTS++))
      elif [ "$integration_status" = "degraded" ] && [ "$expected_fallback" = "true" ]; then
        echo -e "${YELLOW}✓ OK${NC} (Fallback working)"
        ((PASSED_TESTS++))
      elif [ "$integration_status" = "degraded" ]; then
        echo -e "${YELLOW}⚠ WARNING${NC} (Using fallback - check Supabase)"
        ((PASSED_TESTS++))
      else
        echo -e "${RED}✗ FAIL${NC} (Unexpected integration status: $integration_status)"
        ((FAILED_TESTS++))
      fi
    else
      echo -e "${GREEN}✓ OK${NC}"
      ((PASSED_TESTS++))
    fi
  else
    echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
    ((FAILED_TESTS++))
  fi
}

# Test all agent endpoints
echo "📋 Testing Agent Endpoints..."
echo ""

test_agent_endpoint "Driver Requests" "/api/agents/driver-requests?limit=5"
test_agent_endpoint "Pharmacy Requests" "/api/agents/pharmacy-requests?limit=5"
test_agent_endpoint "Shops & Services" "/api/agents/shops?limit=10"
test_agent_endpoint "Property Rentals" "/api/agents/property-rentals?limit=5"
test_agent_endpoint "Schedule Trips" "/api/agents/schedule-trips?limit=5"
test_agent_endpoint "Marketplace Sessions" "/api/marketplace/agent-sessions?limit=5"

echo ""
echo "📊 Testing Fallback Scenarios..."
echo ""

# Test with invalid credentials to force fallback
test_agent_endpoint "Driver Requests (Forced Fallback)" \
  "/api/agents/driver-requests?force_fallback=true&limit=5" \
  "true"

echo ""
echo "================================"
echo "Results:"
echo -e "  ${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "  ${RED}Failed: $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}✓ All agent fallback tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed. Please review the output above.${NC}"
  exit 1
fi
