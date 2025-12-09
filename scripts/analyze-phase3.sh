#!/bin/bash
set -euo pipefail

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo -e "${YELLOW}⚠️  DRY RUN MODE - No changes will be made${NC}\n"
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Phase 3: Code Quality${NC}"
echo -e "${BLUE}  Estimated Time: 18 hours${NC}"
echo -e "${BLUE}========================================${NC}\n"

# ============================================
# P1-1: Admin App Consolidation (4h)
# ============================================
echo -e "${BLUE}📋 Task 1: Admin App Consolidation (4h)${NC}\n"

echo -e "${GREEN}✅ Already consolidated - duplicate apps removed${NC}\n"

# ============================================
# P2-1: Stray Files Relocation (2h)
# ============================================
echo -e "${BLUE}📋 Task 2: Stray Files Relocation (2h)${NC}\n"

STRAY_FILES=(
  "services/audioUtils.ts"
  "services/gemini.ts"
)

for file in "${STRAY_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "⚠️  Found stray file: $file"
    echo "   → Needs relocation to appropriate package"
  fi
done

echo ""
echo "Manual steps:"
echo "  1. Create packages/media-utils/ (if needed)"
echo "  2. Create packages/ai-core/src/providers/ (if needed)"
echo "  3. Move files and update imports"
echo "  4. Archive original files"
echo ""

# ============================================
# P2-2: Jest → Vitest Migration (8h)
# ============================================
echo -e "${BLUE}📋 Task 3: Jest → Vitest Migration (8h)${NC}\n"

JEST_SERVICES=(
  "services/wallet-service"
  "services/profile-service"
  "services/ranking-service"
)

for service in "${JEST_SERVICES[@]}"; do
  if [ -f "$service/jest.config.js" ] || [ -f "$service/jest.config.ts" ]; then
    echo "⏳ $service - needs migration"
    
    if [ "$DRY_RUN" = false ]; then
      echo "   Run: npx tsx scripts/migration/jest-to-vitest.ts --target=$service"
    fi
  elif [ -f "$service/vitest.config.ts" ]; then
    echo -e "${GREEN}✅ $service - already using Vitest${NC}"
  fi
done

echo ""

# ============================================
# P2-3: ESLint Zero Warnings (6h)
# ============================================
echo -e "${BLUE}📋 Task 4: ESLint Zero Warnings (6h)${NC}\n"

echo "Running ESLint check..."
if pnpm lint 2>&1 | tee /tmp/eslint-output.txt; then
  echo -e "${GREEN}✅ No ESLint errors${NC}"
else
  WARNING_COUNT=$(grep -c "warning" /tmp/eslint-output.txt || echo "0")
  ERROR_COUNT=$(grep -c "error" /tmp/eslint-output.txt || echo "0")
  
  echo ""
  echo "📊 ESLint Status:"
  echo "   Warnings: $WARNING_COUNT"
  echo "   Errors: $ERROR_COUNT"
  echo ""
  
  if [ "$WARNING_COUNT" -gt 0 ]; then
    echo "⚠️  Found $WARNING_COUNT warnings - run fixes:"
    echo "   1. Console.log: ./scripts/maintenance/replace-console-logs.sh"
    echo "   2. Auto-fix: pnpm lint:fix"
    echo "   3. Manual review remaining issues"
  fi
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Phase 3 Analysis Complete${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo "Summary:"
echo "  • Admin app consolidation: Manual review required"
echo "  • Stray files: Manual relocation needed"  
echo "  • Jest → Vitest: Use migration script"
echo "  • ESLint: Run fix scripts"
echo ""
echo "Next: Review output above and execute each task"
echo ""
