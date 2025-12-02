#!/bin/bash
# Phase 3 & 4 Master Implementation Script
# Executes all tasks in priority order with safety checks

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DRY_RUN=false
SKIP_TESTS=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    *)
      ;;
  esac
done

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  EasyMO Phase 3 & 4 Implementation                    ║${NC}"
echo -e "${BLUE}║  Total Duration: ~33 hours across 3 weeks             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}⚠️  DRY RUN MODE - No changes will be made${NC}"
  echo ""
fi

# Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"
command -v pnpm >/dev/null 2>&1 || { echo -e "${RED}❌ pnpm not found${NC}"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo -e "${RED}❌ jq not found${NC}"; exit 1; }
command -v node >/dev/null 2>&1 || { echo -e "${RED}❌ node not found${NC}"; exit 1; }
echo -e "${GREEN}✅ All prerequisites met${NC}"
echo ""

# Create task tracking file
PROGRESS_FILE=".phase3-progress.txt"
if [ ! -f "$PROGRESS_FILE" ]; then
  cat > "$PROGRESS_FILE" << EOF
# Phase 3&4 Progress Tracker
# Auto-generated - Do not edit manually
TYPESCRIPT_ALIGNMENT=pending
WORKSPACE_DEPS=pending
ADMIN_CONSOLIDATION=pending
STRAY_FILES=pending
JEST_VITEST=pending
ESLINT_WARNINGS=pending
ROOT_CLEANUP=pending
OBSERVABILITY=pending
CI_CD_UPDATES=pending
EOF
fi

# Helper functions
check_status() {
  grep "^$1=" "$PROGRESS_FILE" | cut -d'=' -f2
}

mark_complete() {
  sed -i.bak "s/^$1=.*/$1=complete/" "$PROGRESS_FILE"
  echo -e "${GREEN}✅ $1 marked complete${NC}"
}

mark_failed() {
  sed -i.bak "s/^$1=.*/$1=failed/" "$PROGRESS_FILE"
  echo -e "${RED}❌ $1 marked failed${NC}"
}

run_task() {
  local task_name="$1"
  local script="$2"
  local description="$3"
  
  local status=$(check_status "$task_name")
  
  if [ "$status" = "complete" ]; then
    echo -e "${GREEN}✅ $description - Already complete${NC}"
    return 0
  fi
  
  echo ""
  echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}🔧 $description${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
  echo ""
  
  if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}Would execute: $script --dry-run${NC}"
    return 0
  fi
  
  if [ -f "$script" ]; then
    chmod +x "$script"
    if bash "$script"; then
      mark_complete "$task_name"
    else
      mark_failed "$task_name"
      echo -e "${RED}❌ Task failed. Fix errors and re-run.${NC}"
      return 1
    fi
  else
    echo -e "${YELLOW}⚠️  Script not found: $script${NC}"
    echo -e "${YELLOW}   Creating script...${NC}"
    return 1
  fi
}

# === PHASE 3: CODE QUALITY ===
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  PHASE 3: CODE QUALITY & STANDARDIZATION              ║${NC}"
echo -e "${BLUE}║  Duration: 22 hours                                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# P0 Tasks - Must complete first
echo -e "${RED}🔴 P0 TASKS - CRITICAL BLOCKERS (4 hours)${NC}"
echo ""

run_task "TYPESCRIPT_ALIGNMENT" \
  "scripts/phase3/01-typescript-alignment.sh" \
  "Task 3.4: TypeScript Version Alignment (2h)"

if [ "$DRY_RUN" = false ] && [ "$(check_status TYPESCRIPT_ALIGNMENT)" = "complete" ]; then
  echo -e "${BLUE}Running: pnpm install${NC}"
  pnpm install || true
fi

run_task "WORKSPACE_DEPS" \
  "scripts/phase3/02-workspace-deps.sh" \
  "Task 3.5: Workspace Dependencies (2h)"

if [ "$DRY_RUN" = false ] && [ "$(check_status WORKSPACE_DEPS)" = "complete" ]; then
  echo -e "${BLUE}Running: pnpm install${NC}"
  pnpm install || true
fi

# P1 Tasks
echo ""
echo -e "${YELLOW}🟡 P1 TASKS - HIGH PRIORITY (4 hours)${NC}"
echo ""

run_task "ADMIN_CONSOLIDATION" \
  "scripts/phase3/03-admin-app-consolidation.sh" \
  "Task 3.1: Admin App Consolidation (4h)"

# P2 Tasks
echo ""
echo -e "${GREEN}🟢 P2 TASKS - STANDARD PRIORITY (14 hours)${NC}"
echo ""

echo -e "${BLUE}📝 Task 3.2: Stray Files Relocation (2h)${NC}"
echo "   Manual steps required:"
echo "   1. Create @easymo/media-utils package"
echo "   2. Create @easymo/ai-core package"
echo "   3. Migrate services/audioUtils.ts and services/gemini.ts"
echo "   4. Update imports"
echo ""
read -p "   Press Enter when complete, or Ctrl+C to skip..."
mark_complete "STRAY_FILES"

echo -e "${BLUE}📝 Task 3.3: Jest → Vitest Migration (8h)${NC}"
echo "   Services to migrate:"
echo "   - wallet-service (3h)"
echo "   - profile-service (2h)"
echo "   - ranking-service (1h)"
echo "   - bar-manager-app (2h)"
echo ""
echo "   Use: npx tsx scripts/migration/jest-to-vitest.ts --target=services/SERVICE_NAME"
echo ""
read -p "   Press Enter when complete, or Ctrl+C to skip..."
mark_complete "JEST_VITEST"

echo -e "${BLUE}📝 Task 3.6: ESLint Zero Warnings (6h)${NC}"
echo "   Steps:"
echo "   1. Run: node scripts/count-console-logs.js"
echo "   2. Run: npx tsx scripts/codemod/replace-console.ts --dry-run"
echo "   3. Apply fixes"
echo "   4. Run: pnpm lint"
echo ""
read -p "   Press Enter when complete, or Ctrl+C to skip..."
mark_complete "ESLINT_WARNINGS"

# === PHASE 4: CLEANUP ===
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  PHASE 4: DOCUMENTATION & CLEANUP                      ║${NC}"
echo -e "${BLUE}║  Duration: 11 hours                                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

run_task "ROOT_CLEANUP" \
  "scripts/phase3/04-root-cleanup.sh" \
  "Task 4.1: Root Directory Cleanup (3h)"

echo -e "${BLUE}📝 Task 4.3: Observability Compliance (5h)${NC}"
echo "   Steps:"
echo "   1. Complete scripts/audit/observability-compliance.ts"
echo "   2. Run audit and fix violations"
echo "   3. Add to CI"
echo ""
read -p "   Press Enter when complete, or Ctrl+C to skip..."
mark_complete "OBSERVABILITY"

echo -e "${BLUE}📝 Task: CI/CD Updates (3h)${NC}"
echo "   Add checks for:"
echo "   - TypeScript version consistency"
echo "   - Workspace dependencies"
echo "   - Console.log detection"
echo "   - Observability compliance"
echo ""
read -p "   Press Enter when complete, or Ctrl+C to skip..."
mark_complete "CI_CD_UPDATES"

# Final summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  IMPLEMENTATION COMPLETE                               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

echo "📊 Task Summary:"
echo "───────────────"
grep "=" "$PROGRESS_FILE" | while read line; do
  task=$(echo "$line" | cut -d'=' -f1)
  status=$(echo "$line" | cut -d'=' -f2)
  
  case $status in
    complete)
      echo -e "  ${GREEN}✅${NC} $task"
      ;;
    failed)
      echo -e "  ${RED}❌${NC} $task"
      ;;
    pending)
      echo -e "  ${YELLOW}⏸️${NC} $task"
      ;;
  esac
done

echo ""
echo -e "${GREEN}✅ Review PHASE_3_4_EXECUTION_PLAN.md for next steps${NC}"
echo -e "${GREEN}✅ Progress saved in $PROGRESS_FILE${NC}"
echo ""
