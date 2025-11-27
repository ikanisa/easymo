#!/bin/bash
set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Root Directory Cleanup Script${NC}"
echo -e "${BLUE}========================================${NC}\n"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo -e "${YELLOW}⚠️  DRY RUN MODE - No files will be moved${NC}\n"
fi

# Create target directories
DIRS=(
  "docs/sessions"
  "docs/architecture/diagrams"
  "docs/roadmaps"
  "docs/archive"
  "scripts/deploy"
  "scripts/verify"
  "scripts/test"
  "scripts/checks"
  "scripts/maintenance"
  "supabase/scripts"
  ".archive/orphaned"
  ".archive/old-scripts"
)

for dir in "${DIRS[@]}"; do
  if [ "$DRY_RUN" = false ]; then
    mkdir -p "$dir"
  fi
  echo -e "${GREEN}✓${NC} Directory: $dir"
done

echo ""

# Move files function
move_files() {
  local pattern="$1"
  local destination="$2"
  local description="$3"
  
  # Find matching files
  files=$(find . -maxdepth 1 -name "$pattern" -type f 2>/dev/null | sort)
  
  if [ -n "$files" ]; then
    echo -e "${BLUE}📁 $description${NC}"
    for file in $files; do
      filename=$(basename "$file")
      if [ "$DRY_RUN" = false ]; then
        mv "$file" "$destination/$filename"
        echo -e "   ${GREEN}✓${NC} Moved: $filename → $destination/"
      else
        echo -e "   ${YELLOW}→${NC} Would move: $filename → $destination/"
      fi
    done
    echo ""
  fi
}

# Session notes and status files
move_files "*_COMPLETE*.md" "docs/sessions" "Session completion notes"
move_files "*_STATUS*.md" "docs/sessions" "Status reports"
move_files "*_SUMMARY*.md" "docs/sessions" "Session summaries"
move_files "*_SUMMARY*.txt" "docs/sessions" "Text summaries"

# Architecture diagrams
move_files "*_VISUAL*.txt" "docs/architecture/diagrams" "Visual architecture diagrams"
move_files "*_ARCHITECTURE*.txt" "docs/architecture/diagrams" "Architecture documents"
move_files "*_ARCHITECTURE*.md" "docs/architecture" "Architecture markdown"

# Roadmaps
move_files "*_ROADMAP*.md" "docs/roadmaps" "Roadmap documents"
move_files "WEEK*_*.md" "docs/roadmaps" "Weekly roadmaps"

# Deployment scripts
move_files "deploy-*.sh" "scripts/deploy" "Deployment scripts"
move_files "quick-deploy.sh" "scripts/deploy" "Quick deploy"

# Verification scripts
move_files "verify-*.sh" "scripts/verify" "Verification scripts"
move_files "validate-*.sh" "scripts/verify" "Validation scripts"

# Test scripts
move_files "test-*.sh" "scripts/test" "Test scripts"
move_files "run-*.sh" "scripts/test" "Test runners"

# Check scripts
move_files "check-*.sh" "scripts/checks" "Check scripts"
move_files "check_*.sh" "scripts/checks" "Check scripts (underscore)"

# SQL scripts (avoid moving migration files)
move_files "*.sql" "supabase/scripts" "SQL scripts"

# Old shell scripts
move_files "enable-*.sh" ".archive/old-scripts" "Enable scripts"
move_files "migrate-*.sh" ".archive/old-scripts" "Migration scripts"
move_files "setup-*.sh" ".archive/old-scripts" "Setup scripts"
move_files "start-*.sh" ".archive/old-scripts" "Start scripts"
move_files "execute-*.sh" ".archive/old-scripts" "Execute scripts"
move_files "retry-*.sh" ".archive/old-scripts" "Retry scripts"
move_files "final-*.sh" ".archive/old-scripts" "Final scripts"
move_files "monitor-*.sh" ".archive/old-scripts" "Monitor scripts"
move_files "waiter-*.sh" ".archive/old-scripts" "Waiter scripts"

# Commit message files
move_files "*COMMIT*.txt" ".archive/old-scripts" "Commit message templates"

# Generate index for archived content
if [ "$DRY_RUN" = false ]; then
  echo "# Archived Content Index" > docs/archive/INDEX.md
  echo "" >> docs/archive/INDEX.md
  echo "Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")" >> docs/archive/INDEX.md
  echo "" >> docs/archive/INDEX.md
  echo "## Session Notes" >> docs/archive/INDEX.md
  ls -1 docs/sessions/ 2>/dev/null | sed 's/^/- /' >> docs/archive/INDEX.md || echo "- (none)" >> docs/archive/INDEX.md
  echo "" >> docs/archive/INDEX.md
  echo "## Archived Scripts" >> docs/archive/INDEX.md
  ls -1 .archive/old-scripts/ 2>/dev/null | sed 's/^/- /' >> docs/archive/INDEX.md || echo "- (none)" >> docs/archive/INDEX.md
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Cleanup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"

if [ "$DRY_RUN" = true ]; then
  echo -e "\n${YELLOW}Run without --dry-run to apply changes${NC}"
fi
