#!/bin/bash
set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  EasyMO Phase 3-4 Implementation Status & Quick Start  ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}\n"

# Current status checks
echo -e "${CYAN}📊 CURRENT STATUS CHECK${NC}\n"

# 1. Console.log count
CONSOLE_COUNT=$(grep -r "console\.log" services/ packages/ apps/ --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')
echo -e "${YELLOW}Console.log instances:${NC} $CONSOLE_COUNT"
if [ "$CONSOLE_COUNT" -gt 0 ]; then
  echo -e "   ${RED}❌ Needs replacement with structured logging${NC}"
else
  echo -e "   ${GREEN}✅ Clean${NC}"
fi

# 2. Jest configs
JEST_COUNT=$(find services -name "jest.config.*" 2>/dev/null | wc -l | tr -d ' ')
echo -e "${YELLOW}Services using Jest:${NC} $JEST_COUNT"
if [ "$JEST_COUNT" -gt 0 ]; then
  echo -e "   ${RED}❌ Need migration to Vitest:${NC}"
  find services -name "jest.config.*" 2>/dev/null | sed 's/^/      /'
else
  echo -e "   ${GREEN}✅ All on Vitest${NC}"
fi

# 3. TypeScript versions
echo -e "${YELLOW}TypeScript versions:${NC}"
TS_VERSIONS=$(pnpm ls typescript 2>/dev/null | grep -v "5.5.4" | grep "typescript@" || echo "")
if [ -n "$TS_VERSIONS" ]; then
  echo -e "   ${RED}❌ Inconsistent versions found${NC}"
else
  echo -e "   ${GREEN}✅ All on 5.5.4${NC}"
fi

# 4. admin-app-v2 status
if [ -d "admin-app-v2" ]; then
  echo -e "${YELLOW}admin-app-v2:${NC}"
  if [ -f "admin-app-v2/DEPRECATED.md" ]; then
    echo -e "   ${YELLOW}⚠️  Deprecated but not removed${NC}"
  else
    echo -e "   ${RED}❌ Still active${NC}"
  fi
else
  echo -e "${YELLOW}admin-app-v2:${NC} ${GREEN}✅ Removed${NC}"
fi

# 5. Root directory clutter
ROOT_CLUTTER=$(find . -maxdepth 1 -name "*_COMPLETE*.md" -o -name "*_STATUS*.md" -o -name "*_SUMMARY*.md" 2>/dev/null | wc -l | tr -d ' ')
echo -e "${YELLOW}Root directory session files:${NC} $ROOT_CLUTTER"
if [ "$ROOT_CLUTTER" -gt 0 ]; then
  echo -e "   ${RED}❌ Need organization${NC}"
else
  echo -e "   ${GREEN}✅ Clean${NC}"
fi

# Summary
echo -e "\n${CYAN}═══════════════════════════════════════════════════════════${NC}"
TOTAL_ISSUES=$((CONSOLE_COUNT > 0 ? 1 : 0))
TOTAL_ISSUES=$((TOTAL_ISSUES + (JEST_COUNT > 0 ? 1 : 0)))
TOTAL_ISSUES=$((TOTAL_ISSUES + (ROOT_CLUTTER > 0 ? 1 : 0)))

if [ $TOTAL_ISSUES -eq 0 ]; then
  echo -e "${GREEN}✅ All Phase 3-4 tasks complete!${NC}"
else
  echo -e "${YELLOW}⚠️  $TOTAL_ISSUES categories need attention${NC}"
fi
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}\n"

# Quick actions
echo -e "${BLUE}🚀 QUICK START OPTIONS${NC}\n"
echo -e "${GREEN}1.${NC} View detailed pending tasks"
echo -e "   ${CYAN}cat PENDING_IMPLEMENTATION_TASKS.md${NC}\n"

echo -e "${GREEN}2.${NC} Check workspace dependencies"
echo -e "   ${CYAN}bash scripts/verify/workspace-deps.sh${NC}\n"

echo -e "${GREEN}3.${NC} Analyze admin-app consolidation (dry-run)"
echo -e "   ${CYAN}npx tsx scripts/migration/merge-admin-apps.ts --dry-run${NC}\n"

echo -e "${GREEN}4.${NC} Preview console.log replacement (dry-run)"
echo -e "   ${CYAN}bash scripts/maintenance/replace-console-logs.sh --dry-run${NC}\n"

echo -e "${GREEN}5.${NC} Preview root directory cleanup (dry-run)"
echo -e "   ${CYAN}bash scripts/maintenance/cleanup-root-directory.sh --dry-run${NC}\n"

echo -e "${GREEN}6.${NC} Run observability compliance audit"
echo -e "   ${CYAN}npx tsx scripts/audit/observability-compliance.ts${NC}\n"

echo -e "${GREEN}7.${NC} Migrate wallet-service to Vitest"
echo -e "   ${CYAN}cd services/wallet-service && npx tsx ../../scripts/migration/jest-to-vitest.ts --target=services/wallet-service${NC}\n"

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}📖 Full documentation:${NC} PENDING_IMPLEMENTATION_TASKS.md"
echo -e "${YELLOW}📋 Estimated remaining:${NC} 33 hours (~2 weeks)"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}\n"

# Interactive mode
if [ "${1:-}" != "--no-interactive" ]; then
  echo -e "${BLUE}Would you like to:${NC}"
  echo "  [1] Make all scripts executable"
  echo "  [2] Run all dry-run checks"
  echo "  [3] Exit and review PENDING_IMPLEMENTATION_TASKS.md"
  echo ""
  read -p "Choice (1-3): " choice
  
  case $choice in
    1)
      echo -e "\n${CYAN}Making scripts executable...${NC}"
      find scripts -name "*.sh" -exec chmod +x {} \;
      echo -e "${GREEN}✅ Done!${NC}\n"
      ;;
    2)
      echo -e "\n${CYAN}Running dry-run checks...${NC}\n"
      
      if [ -f "scripts/verify/workspace-deps.sh" ]; then
        echo -e "${BLUE}▶ Workspace dependencies:${NC}"
        bash scripts/verify/workspace-deps.sh || true
        echo ""
      fi
      
      if [ -f "scripts/maintenance/replace-console-logs.sh" ]; then
        echo -e "${BLUE}▶ Console.log replacement preview:${NC}"
        bash scripts/maintenance/replace-console-logs.sh --dry-run 2>/dev/null | head -50 || echo "Script not ready"
        echo ""
      fi
      
      if [ -f "scripts/maintenance/cleanup-root-directory.sh" ]; then
        echo -e "${BLUE}▶ Root cleanup preview:${NC}"
        bash scripts/maintenance/cleanup-root-directory.sh --dry-run 2>/dev/null | head -50 || echo "Script not ready"
        echo ""
      fi
      
      echo -e "${GREEN}✅ Dry-run checks complete${NC}"
      echo -e "${YELLOW}Review output and run individual commands to apply changes${NC}\n"
      ;;
    3)
      echo -e "\n${CYAN}Opening documentation...${NC}"
      if command -v less &> /dev/null; then
        less PENDING_IMPLEMENTATION_TASKS.md
      else
        cat PENDING_IMPLEMENTATION_TASKS.md
      fi
      ;;
    *)
      echo -e "${YELLOW}Invalid choice. Exiting.${NC}"
      ;;
  esac
fi

echo -e "${GREEN}Ready to begin! Start with option 1 above.${NC}"
