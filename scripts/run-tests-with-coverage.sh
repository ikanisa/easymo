#!/bin/bash
# Run all tests with coverage reporting
# Usage: ./scripts/run-tests-with-coverage.sh

set -e

echo "🧪 Running Tests with Coverage"
echo "==============================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Create coverage directory
mkdir -p coverage

# Track results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

run_test_suite() {
    local suite_name=$1
    local test_path=$2
    
    echo -e "${BLUE}Running: ${suite_name}${NC}"
    echo "----------------------------------------"
    
    if deno test --allow-all --coverage=coverage/${suite_name} "${test_path}" 2>&1; then
        echo -e "${GREEN}✅ ${suite_name} passed${NC}"
        ((PASSED_TESTS++))
    else
        echo -e "${RED}❌ ${suite_name} failed${NC}"
        ((FAILED_TESTS++))
    fi
    ((TOTAL_TESTS++))
    echo ""
}

# Verify test infrastructure
echo -e "${YELLOW}📦 Verifying Test Infrastructure${NC}"
echo "==============================="
deno check supabase/functions/_shared/testing/test-utils.ts 2>&1 || echo "⚠️ test-utils type check issues"
deno check supabase/functions/_shared/testing/fixtures.ts 2>&1 || echo "⚠️ fixtures type check issues"
echo ""

# Core Service Tests
echo -e "${YELLOW}📦 Core Service Tests${NC}"
echo "==============================="
run_test_suite "core-router" "supabase/functions/wa-webhook-core/__tests__/router.test.ts"
run_test_suite "core-health" "supabase/functions/wa-webhook-core/__tests__/health.test.ts"

# Mobility Service Tests
echo -e "${YELLOW}📦 Mobility Service Tests${NC}"
echo "==============================="
run_test_suite "mobility-nearby" "supabase/functions/wa-webhook-mobility/__tests__/nearby.test.ts"
run_test_suite "mobility-lifecycle" "supabase/functions/wa-webhook-mobility/__tests__/trip-lifecycle.test.ts"

# Insurance Service Tests
echo -e "${YELLOW}📦 Insurance Service Tests${NC}"
echo "==============================="
run_test_suite "insurance-claims" "supabase/functions/wa-webhook-insurance/__tests__/claims.test.ts"
run_test_suite "insurance-ocr" "supabase/functions/wa-webhook-insurance/__tests__/ocr.test.ts"

# Profile Service Tests
echo -e "${YELLOW}�� Profile Service Tests${NC}"
echo "==============================="
run_test_suite "profile-wallet" "supabase/functions/wa-webhook-profile/__tests__/wallet.test.ts"
run_test_suite "profile-management" "supabase/functions/wa-webhook-profile/__tests__/profile.test.ts"

# E2E Tests
echo -e "${YELLOW}📦 End-to-End Tests${NC}"
echo "==============================="
run_test_suite "e2e-flows" "supabase/functions/_shared/testing/__tests__/e2e-flows.test.ts"

# Generate coverage report
echo ""
echo "📊 Generating Coverage Report..."
echo "==============================="

# Merge coverage data
deno coverage coverage --lcov --output=coverage/lcov.info 2>/dev/null || true

# Generate HTML report if lcov is available
if command -v genhtml &> /dev/null; then
    genhtml coverage/lcov.info -o coverage/html 2>/dev/null
    echo -e "${GREEN}✓ HTML coverage report generated: coverage/html/index.html${NC}"
else
    echo -e "${YELLOW}⚠ genhtml not found. Install lcov for HTML reports.${NC}"
fi

# Summary
echo ""
echo "==============================="
echo "📊 Test Summary"
echo "==============================="
echo "Total test suites: ${TOTAL_TESTS}"
echo -e "Passed: ${GREEN}${PASSED_TESTS}${NC}"
echo -e "Failed: ${RED}${FAILED_TESTS}${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi
