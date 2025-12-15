#!/bin/bash
# Phase 3: Test Coverage & QA Verification Script
# Version: 1.0

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧪 Phase 3: Test Coverage & QA Verification${NC}"
echo "============================================================"

SERVICES=(
  "wa-webhook-core"
  "wa-webhook-profile"
  "wa-webhook-mobility"
  "wa-webhook-buy-sell"
)

PASSED=0
FAILED=0
WARNINGS=0

# Check test infrastructure
echo -e "\n${YELLOW}Checking test infrastructure...${NC}"

TEST_INFRA=(
  "supabase/functions/_shared/testing/test-utils.ts"
  "supabase/functions/_shared/testing/fixtures.ts"
)

for FILE in "${TEST_INFRA[@]}"; do
  if [ -f "$PROJECT_ROOT/$FILE" ]; then
    echo -e "${GREEN}✅ $FILE exists${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ $FILE missing${NC}"
    ((FAILED++))
  fi
done

# Check service test directories
echo -e "\n${YELLOW}Checking service test directories...${NC}"

for SERVICE in "${SERVICES[@]}"; do
  TEST_DIR="$PROJECT_ROOT/supabase/functions/$SERVICE/__tests__"
  
  if [ -d "$TEST_DIR" ]; then
    TEST_COUNT=$(find "$TEST_DIR" -name "*.test.ts" | wc -l | tr -d ' ')
    if [ "$TEST_COUNT" -gt 0 ]; then
      echo -e "${GREEN}✅ $SERVICE: $TEST_COUNT test files found${NC}"
      ((PASSED++))
    else
      echo -e "${YELLOW}⚠️  $SERVICE: Test directory exists but no test files${NC}"
      ((WARNINGS++))
    fi
  else
    echo -e "${YELLOW}⚠️  $SERVICE: No __tests__ directory${NC}"
    ((WARNINGS++))
  fi
done

# Run security tests
echo -e "\n${YELLOW}Running security tests...${NC}"

cd "$PROJECT_ROOT"
if deno test --reload --allow-all supabase/functions/_shared/security/__tests__/ 2>&1 | grep -q "ok |"; then
  SECURITY_RESULT=$(deno test --reload --allow-all supabase/functions/_shared/security/__tests__/ 2>&1 | grep "ok |")
  echo -e "${GREEN}✅ Security tests: $SECURITY_RESULT${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ Security tests failed${NC}"
  ((FAILED++))
fi

# Run service tests
echo -e "\n${YELLOW}Running service tests...${NC}"

TEST_RESULTS=()

for SERVICE in "${SERVICES[@]}"; do
  TEST_DIR="supabase/functions/$SERVICE/__tests__"
  
  if [ -d "$TEST_DIR" ]; then
    echo -e "${BLUE}Testing $SERVICE...${NC}"
    
    if deno test --reload --allow-all "$TEST_DIR/" 2>&1 | grep -q "ok |"; then
      RESULT=$(deno test --reload --allow-all "$TEST_DIR/" 2>&1 | grep "ok |" | head -1)
      echo -e "${GREEN}  ✅ $RESULT${NC}"
      TEST_RESULTS+=("$SERVICE:PASS")
      ((PASSED++))
    else
      echo -e "${RED}  ❌ Tests failed or no tests found${NC}"
      TEST_RESULTS+=("$SERVICE:FAIL")
      ((FAILED++))
    fi
  else
    echo -e "${YELLOW}  ⚠️  No tests directory${NC}"
    TEST_RESULTS+=("$SERVICE:SKIP")
    ((WARNINGS++))
  fi
done

# Check for test coverage configuration
echo -e "\n${YELLOW}Checking test configuration...${NC}"

if [ -f "$PROJECT_ROOT/supabase/functions/deno.test.json" ]; then
  echo -e "${GREEN}✅ deno.test.json configuration exists${NC}"
  ((PASSED++))
else
  echo -e "${YELLOW}⚠️  deno.test.json not found${NC}"
  ((WARNINGS++))
fi

# Check for CI/CD integration
echo -e "\n${YELLOW}Checking CI/CD integration...${NC}"

CI_FILES=(
  ".github/workflows/ci.yml"
  ".github/workflows/test.yml"
)

for FILE in "${CI_FILES[@]}"; do
  if [ -f "$PROJECT_ROOT/$FILE" ]; then
    if grep -q "deno test" "$PROJECT_ROOT/$FILE" 2>/dev/null; then
      echo -e "${GREEN}✅ $FILE includes deno test${NC}"
      ((PASSED++))
    else
      echo -e "${YELLOW}⚠️  $FILE exists but may not run tests${NC}"
      ((WARNINGS++))
    fi
  else
    echo -e "${YELLOW}⚠️  $FILE not found${NC}"
    ((WARNINGS++))
  fi
done

# Test coverage goals
echo -e "\n${YELLOW}Coverage goals assessment:${NC}"

TOTAL_TESTS=0
for RESULT in "${TEST_RESULTS[@]}"; do
  SERVICE="${RESULT%:*}"
  STATUS="${RESULT#*:}"
  
  if [ "$STATUS" == "PASS" ]; then
    TEST_DIR="supabase/functions/$SERVICE/__tests__"
    COUNT=$(find "$PROJECT_ROOT/$TEST_DIR" -name "*.test.ts" 2>/dev/null | wc -l | tr -d ' ')
    TOTAL_TESTS=$((TOTAL_TESTS + COUNT))
  fi
done

echo -e "  Total test files: $TOTAL_TESTS"

if [ $TOTAL_TESTS -ge 8 ]; then
  echo -e "${GREEN}  ✅ Good test file coverage${NC}"
  ((PASSED++))
elif [ $TOTAL_TESTS -ge 4 ]; then
  echo -e "${YELLOW}  ⚠️  Moderate test coverage - aim for more tests${NC}"
  ((WARNINGS++))
else
  echo -e "${RED}  ❌ Low test coverage${NC}"
  ((FAILED++))
fi

# Summary
echo ""
echo "============================================================"
echo -e "${BLUE}Phase 3 Test Verification Summary${NC}"
echo "============================================================"
echo -e "✅ Passed:   ${GREEN}$PASSED${NC}"
echo -e "⚠️  Warnings: ${YELLOW}$WARNINGS${NC}"
echo -e "❌ Failed:   ${RED}$FAILED${NC}"
echo "============================================================"
echo ""

# Test results breakdown
echo "Test Results by Service:"
for RESULT in "${TEST_RESULTS[@]}"; do
  SERVICE="${RESULT%:*}"
  STATUS="${RESULT#*:}"
  
  case "$STATUS" in
    PASS)
      echo -e "  ${GREEN}✅ $SERVICE${NC}"
      ;;
    FAIL)
      echo -e "  ${RED}❌ $SERVICE${NC}"
      ;;
    SKIP)
      echo -e "  ${YELLOW}⚠️  $SERVICE (no tests)${NC}"
      ;;
  esac
done

echo ""

if [ $FAILED -eq 0 ] && [ $WARNINGS -lt 10 ]; then
  echo -e "${GREEN}✅ Phase 3 verification passed!${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Add more tests to increase coverage"
  echo "  2. Run with coverage: deno test --coverage=coverage"
  echo "  3. Create E2E integration tests"
  echo "  4. Set up CI/CD pipeline"
  echo "  5. Proceed to Phase 4: Code Refactoring"
  exit 0
elif [ $FAILED -eq 0 ]; then
  echo -e "${YELLOW}⚠️  Phase 3 verification passed with warnings${NC}"
  echo ""
  echo "Consider addressing warnings before proceeding to Phase 4"
  exit 0
else
  echo -e "${RED}❌ Phase 3 verification failed${NC}"
  echo ""
  echo "Please address failed checks before proceeding"
  exit 1
fi
