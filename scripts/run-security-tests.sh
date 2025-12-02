#!/bin/bash
# Run all security tests
# Usage: ./scripts/run-security-tests.sh

set -e

echo "🔐 Running Security Tests"
echo "========================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Track results
PASSED=0
FAILED=0

run_test() {
    local test_file=$1
    local test_name=$2
    
    echo -e "${YELLOW}Running: ${test_name}${NC}"
    
    if deno test --allow-all "$test_file" 2>&1; then
        echo -e "${GREEN}✅ ${test_name} passed${NC}"
        ((PASSED++))
    else
        echo -e "${RED}❌ ${test_name} failed${NC}"
        ((FAILED++))
    fi
    echo ""
}

# Run signature tests
run_test "supabase/functions/_shared/security/__tests__/signature.test.ts" "Signature Verification"

# Run input validation tests
run_test "supabase/functions/_shared/security/__tests__/input-validator.test.ts" "Input Validation"

# Run rate limiting tests
run_test "supabase/functions/_shared/security/__tests__/rate-limit.test.ts" "Rate Limiting"

# Summary
echo "========================="
echo "📊 Test Summary"
echo "========================="
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✅ All security tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed${NC}"
    exit 1
fi
