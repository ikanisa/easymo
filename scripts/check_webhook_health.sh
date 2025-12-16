#!/bin/bash

# Webhook Health Check Script
# Checks the health status of all WhatsApp webhook functions

set -e

SUPABASE_URL="${SUPABASE_URL:-https://lhbowpbcpwoiparwnwgt.supabase.co}"
PROJECT_REF="${PROJECT_REF:-lhbowpbcpwoiparwnwgt}"

echo "🔍 Checking WhatsApp Webhook Health Status..."
echo "=============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_function() {
    local function_name=$1
    local endpoint="${SUPABASE_URL}/functions/v1/${function_name}"
    
    echo -n "Checking ${function_name}... "
    
    response=$(curl -s -w "\n%{http_code}" -X GET "${endpoint}" \
        -H "Content-Type: application/json" \
        --max-time 10 2>&1) || {
        echo -e "${RED}✗ FAILED${NC} - Connection error"
        return 1
    }
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "404" ]; then
        echo -e "${GREEN}✓ OK${NC} (HTTP $http_code)"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $http_code)"
        echo "  Response: $body"
        return 1
    fi
}

# Check all webhook functions
functions=(
    "wa-webhook-core"
    "wa-webhook-mobility"
    "wa-webhook-buy-sell"
    "wa-webhook-profile"
    "wa-webhook-insurance"
    "wa-webhook-voice-calls"
)

failed=0
passed=0

for func in "${functions[@]}"; do
    if check_function "$func"; then
        ((passed++))
    else
        ((failed++))
    fi
done

echo ""
echo "=============================================="
echo "Summary:"
echo "  ${GREEN}Passed: $passed${NC}"
echo "  ${RED}Failed: $failed${NC}"
echo "  Total: ${#functions[@]}"
echo ""

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✓ All webhooks are healthy!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some webhooks are not responding${NC}"
    exit 1
fi

