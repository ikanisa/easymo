#!/bin/bash
# Rate Limiting Verification Script
# Tests that all public endpoints have rate limiting enabled

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Rate Limiting Verification${NC}"
echo -e "${GREEN}========================================${NC}"

# Configuration
SUPABASE_URL="${SUPABASE_URL:-http://localhost:54321}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"

if [ -z "$SUPABASE_ANON_KEY" ]; then
  echo -e "${RED}Error: SUPABASE_ANON_KEY not set${NC}"
  exit 1
fi

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test a single endpoint
test_rate_limit() {
  local endpoint=$1
  local limit=$2
  local description=$3
  
  TESTS_RUN=$((TESTS_RUN + 1))
  
  echo -e "\n${YELLOW}Testing: $description${NC}"
  echo "Endpoint: $endpoint"
  echo "Expected limit: $limit requests/minute"
  
  local triggered=false
  local request_count=0
  
  # Send requests until rate limit triggers (max limit + 50)
  for i in $(seq 1 $((limit + 50))); do
    request_count=$i
    
    response_code=$(curl -s -o /dev/null -w "%{http_code}" \
      "$SUPABASE_URL/functions/v1/$endpoint" \
      -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
      -H "Content-Type: application/json" \
      -d '{"test": true}' 2>/dev/null)
    
    if [ "$response_code" == "429" ]; then
      triggered=true
      echo -e "${GREEN}✓ Rate limit triggered at request $request_count${NC}"
      TESTS_PASSED=$((TESTS_PASSED + 1))
      break
    fi
    
    # Small delay to avoid overwhelming
    sleep 0.01
  done
  
  if [ "$triggered" == "false" ]; then
    echo -e "${RED}✗ Rate limit NOT triggered after $request_count requests${NC}"
    echo -e "${RED}  Expected trigger around $limit requests${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

# Test rate limiting headers
test_rate_limit_headers() {
  local endpoint=$1
  
  echo -e "\n${YELLOW}Testing rate limit headers on: $endpoint${NC}"
  
  response=$(curl -s -i \
    "$SUPABASE_URL/functions/v1/$endpoint" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{"test": true}' 2>/dev/null)
  
  # Check for rate limit headers
  if echo "$response" | grep -qi "x-ratelimit-remaining"; then
    remaining=$(echo "$response" | grep -i "x-ratelimit-remaining" | cut -d' ' -f2 | tr -d '\r')
    echo -e "${GREEN}✓ X-RateLimit-Remaining header present: $remaining${NC}"
  else
    echo -e "${YELLOW}⚠ X-RateLimit-Remaining header missing${NC}"
  fi
  
  if echo "$response" | grep -qi "x-ratelimit-reset"; then
    reset=$(echo "$response" | grep -i "x-ratelimit-reset" | cut -d' ' -f2 | tr -d '\r')
    echo -e "${GREEN}✓ X-RateLimit-Reset header present: $reset${NC}"
  else
    echo -e "${YELLOW}⚠ X-RateLimit-Reset header missing${NC}"
  fi
}

# Priority P0 Endpoints (MUST have rate limiting)
echo -e "\n${GREEN}=== P0: Critical Payment Endpoints ===${NC}"

# Test momo-webhook
test_rate_limit "momo-webhook" 50 "MoMo Payment Webhook"
test_rate_limit_headers "momo-webhook"

# Test revolut-webhook
test_rate_limit "revolut-webhook" 50 "Revolut Payment Webhook"
test_rate_limit_headers "revolut-webhook"

echo -e "\n${GREEN}=== P0: WhatsApp Webhooks ===${NC}"

# Test wa-webhook-core
test_rate_limit "wa-webhook-core" 100 "WhatsApp Core Webhook"
test_rate_limit_headers "wa-webhook-core"

# Test wa-webhook-mobility
test_rate_limit "wa-webhook-mobility" 100 "WhatsApp Mobility Webhook"

# Test wa-webhook-marketplace
test_rate_limit "wa-webhook-marketplace" 100 "WhatsApp Marketplace Webhook"

echo -e "\n${GREEN}=== P0: AI Agent Endpoints ===${NC}"

# Test agent-chat
test_rate_limit "agent-chat" 30 "AI Agent Chat"
test_rate_limit_headers "agent-chat"

echo -e "\n${GREEN}=== P1: Public API Endpoints ===${NC}"

# Test business-lookup
test_rate_limit "business-lookup" 60 "Business Lookup API"
test_rate_limit_headers "business-lookup"

# Test bars-lookup
test_rate_limit "bars-lookup" 60 "Bars Lookup API"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  Test Summary${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Tests Run:    $TESTS_RUN"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All rate limiting tests PASSED${NC}"
  echo -e "${GREEN}✅ Production ready from rate limiting perspective${NC}"
  exit 0
else
  echo -e "${RED}❌ Some rate limiting tests FAILED${NC}"
  echo -e "${RED}⚠️  NOT production ready - fix rate limiting first${NC}"
  exit 1
fi
