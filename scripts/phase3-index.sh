#!/bin/bash
# Phase 3 & 4 - Master Index and Entry Point
# Run this script to see all available resources and quick start options

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

clear

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                                    ║${NC}"
echo -e "${BLUE}║  ${BOLD}EasyMO Phase 3 & 4: Code Refactoring & Cleanup${NC}${BLUE}                 ║${NC}"
echo -e "${BLUE}║  ${BOLD}Complete Implementation Package${NC}${BLUE}                                ║${NC}"
echo -e "${BLUE}║                                                                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Status: ✅ READY TO EXECUTE${NC}"
echo -e "${GREEN}Created: 2025-11-27${NC}"
echo -e "${GREEN}Effort: 34 min automated + 32.5 hours manual${NC}"
echo ""

echo -e "${BOLD}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}📚 DOCUMENTATION INDEX${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}🎯 Quick Start Paths:${NC}"
echo ""
echo -e "  ${BLUE}[1]${NC} ${BOLD}README_PHASE_3_4_START.md${NC}"
echo "      → Ultra-quick overview (1 min)"
echo "      → Choose your path (Quick/Full/Commands)"
echo "      → Recommended entry point"
echo ""
echo -e "  ${BLUE}[2]${NC} ${BOLD}PHASE_3_4_START_HERE.md${NC}"
echo "      → Complete getting started guide (10 min)"
echo "      → Step-by-step instructions"
echo "      → Troubleshooting included"
echo ""
echo -e "  ${BLUE}[3]${NC} ${BOLD}PHASE_3_4_QUICK_REF.md${NC}"
echo "      → Command cheat sheet (2 min)"
echo "      → Copy-paste commands"
echo "      → Quick reference card"
echo ""

echo -e "${YELLOW}📖 Detailed Documentation:${NC}"
echo ""
echo -e "  ${BLUE}[4]${NC} ${BOLD}PHASE_3_4_EXECUTION_PLAN.md${NC}"
echo "      → Complete 33-hour roadmap"
echo "      → All 9 tasks detailed"
echo "      → Success criteria & risks"
echo ""
echo -e "  ${BLUE}[5]${NC} ${BOLD}PHASE_3_4_IMPLEMENTATION_SUMMARY.md${NC}"
echo "      → What was created"
echo "      → How scripts work"
echo "      → Expected outcomes"
echo ""

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}🔧 AUTOMATION SCRIPTS${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}Main Scripts:${NC}"
echo ""
echo -e "  ${BLUE}[A]${NC} ${BOLD}scripts/phase3-tasks.sh${NC}"
echo "      → Primary task runner"
echo "      → Commands: typescript, workspace, admin, cleanup, all"
echo "      → Modes: --dry-run, --execute"
echo ""
echo -e "  ${BLUE}[B]${NC} ${BOLD}scripts/execute-phase3-4.sh${NC}"
echo "      → Master orchestrator"
echo "      → Progress tracking"
echo "      → Automatic task sequencing"
echo ""

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}⚡ QUICK START OPTIONS${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════════${NC}"
echo ""

PS3=$'\n'"${YELLOW}Select an option (1-8): ${NC}"
options=(
  "Read Quick Overview (README_PHASE_3_4_START.md)"
  "Read Full Start Guide (PHASE_3_4_START_HERE.md)"
  "View Quick Reference (PHASE_3_4_QUICK_REF.md)"
  "View Complete Plan (PHASE_3_4_EXECUTION_PLAN.md)"
  "Run All Automated Tasks (DRY-RUN)"
  "Run All Automated Tasks (EXECUTE)"
  "View Script Help (phase3-tasks.sh)"
  "Exit"
)

select opt in "${options[@]}"; do
  case $REPLY in
    1)
      echo ""
      echo -e "${GREEN}Opening README_PHASE_3_4_START.md...${NC}"
      echo ""
      cat README_PHASE_3_4_START.md | less -R
      break
      ;;
    2)
      echo ""
      echo -e "${GREEN}Opening PHASE_3_4_START_HERE.md...${NC}"
      echo ""
      cat PHASE_3_4_START_HERE.md | less -R
      break
      ;;
    3)
      echo ""
      echo -e "${GREEN}Opening PHASE_3_4_QUICK_REF.md...${NC}"
      echo ""
      cat PHASE_3_4_QUICK_REF.md | less -R
      break
      ;;
    4)
      echo ""
      echo -e "${GREEN}Opening PHASE_3_4_EXECUTION_PLAN.md...${NC}"
      echo ""
      cat PHASE_3_4_EXECUTION_PLAN.md | less -R
      break
      ;;
    5)
      echo ""
      echo -e "${YELLOW}Running all automated tasks in DRY-RUN mode...${NC}"
      echo -e "${YELLOW}This will show what would be changed WITHOUT modifying files.${NC}"
      echo ""
      read -p "Press Enter to continue or Ctrl+C to cancel..."
      chmod +x scripts/phase3-tasks.sh
      ./scripts/phase3-tasks.sh all --dry-run
      echo ""
      echo -e "${GREEN}DRY-RUN complete. Review output above.${NC}"
      echo -e "${GREEN}To execute: ./scripts/phase3-tasks.sh all --execute${NC}"
      break
      ;;
    6)
      echo ""
      echo -e "${RED}⚠️  WARNING: This will modify files in your repository!${NC}"
      echo ""
      echo "Automated tasks will:"
      echo "  • Update TypeScript versions in all package.json"
      echo "  • Fix workspace dependencies"
      echo "  • Create DEPRECATED.md in admin-app-v2"
      echo "  • Move 40+ files to docs/ and .archive/"
      echo ""
      read -p "Are you sure? Type 'YES' to continue: " confirm
      if [ "$confirm" = "YES" ]; then
        echo ""
        echo -e "${GREEN}Executing all automated tasks...${NC}"
        echo ""
        chmod +x scripts/phase3-tasks.sh
        ./scripts/phase3-tasks.sh all --execute
        echo ""
        echo -e "${GREEN}✅ Automated tasks complete!${NC}"
        echo ""
        echo "Next steps:"
        echo "  1. pnpm install"
        echo "  2. pnpm build"
        echo "  3. git status (review changes)"
        echo "  4. git add -A && git commit -m 'feat: Phase 3 automated tasks'"
      else
        echo ""
        echo -e "${YELLOW}Cancelled. No changes made.${NC}"
      fi
      break
      ;;
    7)
      echo ""
      echo -e "${GREEN}Showing script help...${NC}"
      echo ""
      chmod +x scripts/phase3-tasks.sh
      ./scripts/phase3-tasks.sh help
      break
      ;;
    8)
      echo ""
      echo -e "${GREEN}Goodbye!${NC}"
      echo ""
      echo "Quick start reminder:"
      echo "  cat README_PHASE_3_4_START.md"
      echo "  ./scripts/phase3-tasks.sh all --dry-run"
      echo ""
      break
      ;;
    *)
      echo -e "${RED}Invalid option. Please select 1-8.${NC}"
      ;;
  esac
done

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}For more information, run: cat README_PHASE_3_4_START.md${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
echo ""
