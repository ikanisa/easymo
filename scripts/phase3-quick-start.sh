#!/bin/bash
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  EasyMO Phase 3 Quick Start           ║${NC}"
echo -e "${BLUE}║  Code Quality & Standardization        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}\n"

# Check if we're in the right directory
if [ ! -f "pnpm-workspace.yaml" ]; then
  echo -e "${RED}❌ Error: Must run from repository root${NC}"
  exit 1
fi

# Parse arguments
DRY_RUN=false
SKIP_TESTS=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Usage: $0 [--dry-run] [--skip-tests]"
      exit 1
      ;;
  esac
done

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}⚠️  DRY RUN MODE - No changes will be made${NC}\n"
fi

# Step 1: Workspace Dependencies
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 1/6: Fix Workspace Dependencies${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo "📊 Current state:"
bash scripts/verify/workspace-deps.sh || true

echo -e "\n🔧 Fixing workspace dependencies..."
if [ "$DRY_RUN" = true ]; then
  npx tsx scripts/migration/fix-workspace-deps.ts --dry-run
else
  npx tsx scripts/migration/fix-workspace-deps.ts
  echo -e "\n📦 Reinstalling packages..."
  pnpm install --frozen-lockfile
  echo -e "\n✅ Verification:"
  bash scripts/verify/workspace-deps.sh
fi

# Step 2: TypeScript Version
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 2/6: Verify TypeScript Version${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo "📊 Checking TypeScript versions..."
TS_VERSIONS=$(find . -name "package.json" -not -path "*/node_modules/*" -exec grep -H '"typescript"' {} \; | grep -v "5.5.4" || true)

if [ -z "$TS_VERSIONS" ]; then
  echo -e "${GREEN}✅ All packages use TypeScript 5.5.4${NC}"
else
  echo -e "${YELLOW}⚠️  Found packages not using 5.5.4:${NC}"
  echo "$TS_VERSIONS"
  echo -e "\n${YELLOW}Manual fix needed: Update these to 5.5.4${NC}"
fi

# Step 3: Build Shared Packages
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 3/6: Build Shared Packages${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

if [ "$DRY_RUN" = false ]; then
  echo "🔨 Building @va/shared..."
  pnpm --filter @va/shared build
  
  echo "🔨 Building @easymo/commons..."
  pnpm --filter @easymo/commons build
  
  echo -e "${GREEN}✅ Shared packages built${NC}"
fi

# Step 4: Observability Compliance Check
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 4/6: Check Observability Compliance${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo "📊 Running compliance check..."
npx tsx scripts/audit/observability-compliance.ts > compliance-phase3-check.txt || true

NON_COMPLIANT=$(grep -c "❌ Non-compliant" compliance-phase3-check.txt || echo "0")
echo -e "Found ${YELLOW}$NON_COMPLIANT${NC} categories with issues"
echo -e "Full report: ${BLUE}compliance-phase3-check.txt${NC}"

# Step 5: Security Audit
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 5/6: Security Audit${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo "🔐 Checking environment files..."
bash scripts/security/audit-env-files.sh

# Step 6: Lint & Test
if [ "$SKIP_TESTS" = false ]; then
  echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}Step 6/6: Lint & Test${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
  
  if [ "$DRY_RUN" = false ]; then
    echo "🔍 Running linter..."
    pnpm lint || echo -e "${YELLOW}⚠️  Lint warnings found${NC}"
    
    echo -e "\n🧪 Running tests..."
    pnpm exec vitest run || echo -e "${YELLOW}⚠️  Some tests failed${NC}"
  fi
else
  echo -e "\n${YELLOW}⏭️  Skipping tests (--skip-tests flag)${NC}"
fi

# Summary
echo -e "\n${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Summary                               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}\n"

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}This was a dry run. No changes were made.${NC}"
  echo -e "Run without --dry-run to apply changes.\n"
else
  echo -e "${GREEN}✅ Phase 3 setup complete!${NC}\n"
fi

echo "📋 Next steps:"
echo "1. Review compliance report: cat compliance-phase3-check.txt"
echo "2. Fix console.log: npx tsx scripts/codemod/replace-console.ts --target=services/<name>"
echo "3. Migrate tests: npx tsx scripts/migration/jest-to-vitest.ts --target=services/<name>"
echo "4. Update documentation: see docs/PHASE_3_QUICK_ACTION_GUIDE.md"
echo ""
echo "📚 Documentation:"
echo "- Phase 3 Status: docs/PHASE_3_IMPLEMENTATION_STATUS.md"
echo "- Quick Action Guide: docs/PHASE_3_QUICK_ACTION_GUIDE.md"
echo "- Next Steps: docs/IMPLEMENTATION_NEXT_STEPS_2025-11-27.md"
echo ""

if [ "$DRY_RUN" = false ]; then
  echo -e "${GREEN}🎉 Ready to continue with Phase 3 implementation!${NC}"
fi
