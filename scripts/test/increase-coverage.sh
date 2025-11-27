#!/bin/bash
set -euo pipefail

# Script to help increase test coverage to 70%

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Test Coverage Improvement Plan${NC}"
echo -e "${BLUE}========================================${NC}\n"

# 1. Run coverage to see current state
echo -e "${YELLOW}📊 Running coverage analysis...${NC}\n"
pnpm test -- --coverage --reporter=verbose 2>&1 | tail -20

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# 2. Identify files without tests
echo -e "${YELLOW}🔍 Files without tests:${NC}\n"

# Find all TypeScript files
ALL_TS_FILES=$(find packages services -name "*.ts" -not -name "*.test.ts" -not -name "*.spec.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" | wc -l)

# Find test files
TEST_FILES=$(find packages services -name "*.test.ts" -o -name "*.spec.ts" | wc -l)

echo -e "Total source files: ${ALL_TS_FILES}"
echo -e "Total test files: ${TEST_FILES}"
echo -e "Coverage ratio: $(echo "scale=2; $TEST_FILES * 100 / $ALL_TS_FILES" | bc)%\n"

# 3. Priority files for testing
echo -e "${YELLOW}🎯 Priority files needing tests:${NC}\n"

PRIORITY_DIRS=(
  "packages/commons/src"
  "services/wallet-service/src"
  "services/profile/src"
  "services/agent-core/src"
)

for dir in "${PRIORITY_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    echo -e "${GREEN}$dir:${NC}"
    find "$dir" -name "*.ts" -not -name "*.test.ts" -not -name "*.spec.ts" | head -5
    echo ""
  fi
done

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# 4. Recommendations
echo -e "${YELLOW}💡 Recommendations:${NC}\n"
echo "1. Focus on packages/commons first (shared utilities)"
echo "2. Add tests for wallet-service (critical for payments)"
echo "3. Test profile service (user data)"
echo "4. Agent-core integration tests"
echo ""
echo -e "${GREEN}Target: 70% coverage${NC}"
echo ""
echo "Run this to generate detailed coverage report:"
echo "  pnpm test -- --coverage --reporter=html"
echo "  open coverage/index.html"

