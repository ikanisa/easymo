#!/bin/bash
set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Root Directory Final Cleanup${NC}"
echo -e "${BLUE}========================================${NC}\n"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo -e "${YELLOW}⚠️  DRY RUN MODE - No files will be moved${NC}\n"
fi

# Create archive structure
DIRS=(
  "docs/sessions"
  "docs/archive"
  ".archive/logs"
  ".archive/old-docs"
)

for dir in "${DIRS[@]}"; do
  if [ "$DRY_RUN" = false ]; then
    mkdir -p "$dir"
  fi
  echo -e "${GREEN}✓${NC} Directory: $dir"
done

echo ""

# Move session/status files to docs/sessions/
SESSION_FILES=(
  "REFACTORING_PROGRESS.md"
  "REFACTORING_QUICKSTART.md"
  "REFACTORING_SESSION_3_TYPESCRIPT_TESTING.md"
  "WAITER_AI_ANALYSIS_COMPLETE.txt"
  "WA_WEBHOOK_AI_FILES_INDEX.txt"
  "WA_WEBHOOK_CORE_FINAL_STATUS.txt"
  "console-usage-audit.txt"
)

echo -e "${BLUE}📁 Moving session files to docs/sessions/${NC}"
for file in "${SESSION_FILES[@]}"; do
  if [ -f "$file" ]; then
    if [ "$DRY_RUN" = false ]; then
      mv "$file" "docs/sessions/$file"
      echo -e "   ${GREEN}✓${NC} Moved: $file"
    else
      echo -e "   ${YELLOW}→${NC} Would move: $file"
    fi
  fi
done
echo ""

# Move old migration logs to archive
LOG_FILES=(
  "applied_migrations_20251114_132903.txt"
  "cleanup-execution.log"
  "crawler.log"
  "deploy.log"
  "migration-full.log"
  "migration-output.log"
  "migration-progress.log"
  "migration-run.log"
)

echo -e "${BLUE}📁 Moving log files to .archive/logs/${NC}"
for file in "${LOG_FILES[@]}"; do
  if [ -f "$file" ]; then
    if [ "$DRY_RUN" = false ]; then
      mv "$file" ".archive/logs/$file"
      echo -e "   ${GREEN}✓${NC} Moved: $file"
    else
      echo -e "   ${YELLOW}→${NC} Would move: $file"
    fi
  fi
done
echo ""

# Move old/duplicate documentation
OLD_DOCS=(
  "USSD_PAYMENT_FIX_CORRECTED.md"
  "DATABASE_OPTIMIZATION_PLAN.md"
  "README.md.bak"
)

echo -e "${BLUE}📁 Moving old docs to .archive/old-docs/${NC}"
for file in "${OLD_DOCS[@]}"; do
  if [ -f "$file" ]; then
    if [ "$DRY_RUN" = false ]; then
      mv "$file" ".archive/old-docs/$file"
      echo -e "   ${GREEN}✓${NC} Moved: $file"
    else
      echo -e "   ${YELLOW}→${NC} Would move: $file"
    fi
  fi
done
echo ""

# Create index for archived content
if [ "$DRY_RUN" = false ]; then
  cat > docs/archive/INDEX.md << 'EOF'
# Archived Content Index

Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")

## Session Notes (docs/sessions/)
All refactoring session notes, AI analysis, and progress tracking.

## Logs (.archive/logs/)
Migration logs, deployment logs, and historical execution logs.

## Old Documentation (.archive/old-docs/)
Superseded or deprecated documentation files.

## Navigation

- **Current Documentation**: See root-level markdown files
- **Active Development**: See CHECKLIST.md, PRODUCTION_READINESS_TRACKER.md
- **Getting Started**: See START_HERE.md, QUICKSTART.md
EOF

  echo -e "${GREEN}✓${NC} Created docs/archive/INDEX.md"
fi

# List remaining files in root
echo -e "\n${BLUE}📄 Essential files remaining in root:${NC}"
find . -maxdepth 1 -type f -name "*.md" 2>/dev/null | \
  grep -v "^\./\." | \
  sort | \
  while read -r file; do
    echo -e "   ${GREEN}✓${NC} $(basename "$file")"
  done

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  Cleanup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"

if [ "$DRY_RUN" = true ]; then
  echo -e "\n${YELLOW}Run without --dry-run to apply changes${NC}"
else
  echo -e "\nEssential root files:"
  echo "  - README.md, CONTRIBUTING.md, CHANGELOG.md"
  echo "  - QUICKSTART.md, START_HERE.md"
  echo "  - CHECKLIST.md, PRODUCTION_READINESS_TRACKER.md"
  echo "  - DEPLOYMENT_GUIDE.md, COUNTRIES.md"
fi
