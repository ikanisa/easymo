#!/bin/bash
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Phase 0: Critical Blockers${NC}"
echo -e "${BLUE}  Estimated Time: 4 hours${NC}"
echo -e "${BLUE}========================================${NC}\n"

ERRORS=0

# ============================================
# P0-1: TypeScript Version Alignment
# ============================================
echo -e "${BLUE}📋 P0-1: TypeScript Version Alignment${NC}\n"

echo "1. Auditing TypeScript versions..."
if node scripts/verify/typescript-versions.js; then
  echo -e "${GREEN}✅ TypeScript versions correct${NC}\n"
else
  echo -e "${YELLOW}⚠️  TypeScript version issues found${NC}"
  echo -e "${YELLOW}   Fix with: pnpm add -D -w typescript@5.5.4${NC}\n"
  ERRORS=$((ERRORS + 1))
fi

# ============================================
# P0-2: Workspace Dependencies
# ============================================
echo -e "${BLUE}📋 P0-2: Workspace Dependencies${NC}\n"

echo "2. Verifying workspace dependencies..."
if bash scripts/verify/workspace-deps.sh; then
  echo -e "${GREEN}✅ Workspace dependencies correct${NC}\n"
else
  echo -e "${RED}❌ Workspace dependency issues found${NC}"
  echo -e "${YELLOW}   Review output above and fix manually${NC}\n"
  ERRORS=$((ERRORS + 1))
fi

# ============================================
# Verification
# ============================================
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}  Phase 0 Complete! ✅${NC}"
  echo -e "${GREEN}========================================${NC}\n"
  
  echo "3. Running pnpm install to verify..."
  if pnpm install; then
    echo -e "${GREEN}✅ pnpm install successful${NC}\n"
  else
    echo -e "${RED}❌ pnpm install failed${NC}\n"
    exit 1
  fi
  
  echo "4. Testing build..."
  if pnpm run build:deps; then
    echo -e "${GREEN}✅ Shared packages build successful${NC}\n"
  else
    echo -e "${RED}❌ Build failed${NC}\n"
    exit 1
  fi
  
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}  All P0 Tasks Complete! 🎉${NC}"
  echo -e "${GREEN}========================================${NC}\n"
  
  echo "Next Steps:"
  echo "  1. Review any warnings above"
  echo "  2. Commit changes: git add -A && git commit -m 'feat: complete Phase 0 blockers'"
  echo "  3. Proceed to Phase 3: bash scripts/phase3/run-all.sh"
  echo ""
  
  exit 0
else
  echo -e "${RED}========================================${NC}"
  echo -e "${RED}  Phase 0 Failed with $ERRORS errors${NC}"
  echo -e "${RED}========================================${NC}\n"
  
  echo "Fix the errors above and run again:"
  echo "  bash scripts/phase0-blockers.sh"
  echo ""
  
  exit 1
fi
