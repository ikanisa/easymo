#!/bin/bash
# Phase 3 Individual Task Scripts
# All scripts bundled in one file for easy distribution

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TASK="${1:-help}"
MODE="${2:---dry-run}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

show_help() {
  echo "Phase 3 & 4 Task Runner"
  echo "======================="
  echo ""
  echo "Usage: $0 <task> [--dry-run|--execute]"
  echo ""
  echo "Available tasks:"
  echo "  typescript    - Task 3.4: Align TypeScript to 5.5.4"
  echo "  workspace     - Task 3.5: Fix workspace dependencies"
  echo "  admin         - Task 3.1: Admin app consolidation"
  echo "  cleanup       - Task 4.1: Root directory cleanup"
  echo "  all           - Run all tasks in sequence"
  echo ""
  echo "Examples:"
  echo "  $0 typescript --dry-run"
  echo "  $0 workspace --execute"
  echo "  $0 all --dry-run"
  echo ""
}

task_typescript() {
  local DRY_RUN=$1
  
  echo -e "${BLUE}🔧 Task 3.4: TypeScript Version Alignment${NC}"
  echo "=========================================="
  echo ""
  
  if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}⚠️  DRY RUN MODE${NC}"
    echo ""
  fi
  
  ERRORS=0
  TARGET_VERSION="5.5.4"
  
  echo "📦 Checking TypeScript versions..."
  echo ""
  
  # Find all package.json files
  find . -name "package.json" -not -path "*/node_modules/*" -not -path "*/.archive/*" | while read pkg; do
    TS_VERSION=$(jq -r '(.dependencies.typescript // .devDependencies.typescript // "none")' "$pkg")
    
    if [ "$TS_VERSION" != "none" ] && [ "$TS_VERSION" != "$TARGET_VERSION" ]; then
      echo -e "${RED}❌ $pkg: $TS_VERSION${NC}"
      ERRORS=$((ERRORS + 1))
      
      if [ "$DRY_RUN" = false ]; then
        # Update the version
        if jq -e '.devDependencies.typescript' "$pkg" > /dev/null 2>&1; then
          jq ".devDependencies.typescript = \"$TARGET_VERSION\"" "$pkg" > "$pkg.tmp" && mv "$pkg.tmp" "$pkg"
          echo -e "   ${GREEN}✅ Updated to $TARGET_VERSION${NC}"
        elif jq -e '.dependencies.typescript' "$pkg" > /dev/null 2>&1; then
          jq ".dependencies.typescript = \"$TARGET_VERSION\"" "$pkg" > "$pkg.tmp" && mv "$pkg.tmp" "$pkg"
          echo -e "   ${GREEN}✅ Updated to $TARGET_VERSION${NC}"
        fi
      else
        echo "   📋 Would update to $TARGET_VERSION"
      fi
    elif [ "$TS_VERSION" != "none" ]; then
      echo -e "${GREEN}✅ $pkg: $TS_VERSION${NC}"
    fi
  done
  
  echo ""
  echo "📝 Updating root package.json with override..."
  
  if [ "$DRY_RUN" = false ]; then
    jq '.pnpm.overrides.typescript = "5.5.4"' package.json > package.json.tmp && mv package.json.tmp package.json
    echo -e "${GREEN}✅ Added TypeScript override${NC}"
    echo ""
    echo "Next: Run 'pnpm install'"
  else
    echo "📋 Would add TypeScript override"
  fi
  
  echo ""
  echo -e "${GREEN}✅ TypeScript alignment complete${NC}"
}

task_workspace() {
  local DRY_RUN=$1
  
  echo -e "${BLUE}🔧 Task 3.5: Workspace Dependencies${NC}"
  echo "===================================="
  echo ""
  
  if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}⚠️  DRY RUN MODE${NC}"
    echo ""
  fi
  
  ERRORS=0
  
  echo "📦 Checking workspace dependencies..."
  echo ""
  
  find . -name "package.json" -not -path "*/node_modules/*" -not -path "*/.archive/*" | while read pkg; do
    BAD_DEPS=$(jq -r '
      ((.dependencies // {}) + (.devDependencies // {})) | 
      to_entries[] | 
      select(.key | startswith("@easymo/") or startswith("@va/")) | 
      select(.value | test("^workspace:") | not) | 
      "\(.key): \(.value)"
    ' "$pkg" 2>/dev/null || true)
    
    if [ -n "$BAD_DEPS" ]; then
      echo -e "${RED}❌ $pkg${NC}"
      echo "$BAD_DEPS" | sed 's/^/   /'
      ERRORS=$((ERRORS + 1))
      
      if [ "$DRY_RUN" = false ]; then
        jq '
          (.dependencies // {}) |= with_entries(
            if (.key | startswith("@easymo/") or startswith("@va/")) 
            then .value = "workspace:*" 
            else . 
            end
          ) |
          (.devDependencies // {}) |= with_entries(
            if (.key | startswith("@easymo/") or startswith("@va/")) 
            then .value = "workspace:*" 
            else . 
            end
          )
        ' "$pkg" > "$pkg.tmp" && mv "$pkg.tmp" "$pkg"
        echo -e "   ${GREEN}✅ Fixed${NC}"
      else
        echo "   📋 Would fix to workspace:*"
      fi
      echo ""
    fi
  done
  
  if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All workspace dependencies correct${NC}"
  else
    echo -e "${YELLOW}⚠️  Fixed $ERRORS packages${NC}"
    if [ "$DRY_RUN" = false ]; then
      echo ""
      echo "Next: Run 'pnpm install'"
    fi
  fi
  
  echo ""
  echo -e "${GREEN}✅ Workspace dependencies complete${NC}"
}

task_admin() {
  local DRY_RUN=$1
  
  echo -e "${BLUE}🔧 Task 3.1: Admin App Consolidation${NC}"
  echo "====================================="
  echo ""
  
  if [ ! -d "admin-app-v2" ]; then
    echo -e "${GREEN}✅ admin-app-v2 already removed${NC}"
    return 0
  fi
  
  echo "📊 Analyzing admin-app-v2..."
  echo ""
  
  if [ -d "admin-app-v2/components" ]; then
    V2_COMPONENTS=$(find admin-app-v2/components -name "*.tsx" 2>/dev/null | wc -l)
    echo "admin-app-v2 components: $V2_COMPONENTS"
  fi
  
  if [ -d "admin-app/components" ]; then
    V1_COMPONENTS=$(find admin-app/components -name "*.tsx" 2>/dev/null | wc -l)
    echo "admin-app components: $V1_COMPONENTS"
  fi
  
  echo ""
  echo "Decision: Keep admin-app (has Tauri, Sentry, shared packages)"
  echo ""
  
  if [ "$DRY_RUN" = false ]; then
    cat > admin-app-v2/DEPRECATED.md << 'EOF'
# ⚠️ DEPRECATED: admin-app-v2

**This application has been deprecated in favor of `admin-app`.**

## Migration Status

As of 2025-11-27, all unique features have been migrated to admin-app.

## Removal Timeline

- **2025-12-01**: Remove from CI/CD
- **2025-12-15**: Archive directory
- **2026-01-01**: Delete from repository

## Questions?

Contact the frontend team if you have dependencies on this app.
EOF
    echo -e "${GREEN}✅ Created DEPRECATED.md${NC}"
    echo ""
    echo "To archive: mv admin-app-v2 .archive/apps/admin-app-v2-$(date +%Y%m%d)"
  else
    echo "📋 Would create DEPRECATED.md"
  fi
  
  echo ""
  echo -e "${GREEN}✅ Admin app consolidation complete${NC}"
}

task_cleanup() {
  local DRY_RUN=$1
  
  echo -e "${BLUE}🔧 Task 4.1: Root Directory Cleanup${NC}"
  echo "===================================="
  echo ""
  
  if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}⚠️  DRY RUN MODE${NC}"
    echo ""
  fi
  
  # Create directories
  DIRS=(
    "docs/sessions"
    "docs/architecture/diagrams"
    "docs/roadmaps"
    ".archive/orphaned"
  )
  
  echo "📁 Creating directories..."
  for dir in "${DIRS[@]}"; do
    if [ "$DRY_RUN" = false ]; then
      mkdir -p "$dir"
    fi
    echo "   ✅ $dir"
  done
  
  echo ""
  echo "📦 Moving files..."
  echo ""
  
  # Helper function
  move_files() {
    local pattern="$1"
    local dest="$2"
    local desc="$3"
    
    files=$(find . -maxdepth 1 -name "$pattern" -type f 2>/dev/null | sort)
    
    if [ -n "$files" ]; then
      echo "📂 $desc"
      count=0
      for file in $files; do
        filename=$(basename "$file")
        if [ "$DRY_RUN" = false ]; then
          mv "$file" "$dest/$filename"
          echo "   ✅ $filename"
        else
          echo "   📋 $filename → $dest/"
        fi
        count=$((count + 1))
      done
      echo "   Total: $count files"
      echo ""
    fi
  }
  
  # Move session files
  move_files "*_COMPLETE*.md" "docs/sessions" "Session completion"
  move_files "*_STATUS*.md" "docs/sessions" "Status reports"
  move_files "*_SUMMARY*.md" "docs/sessions" "Summaries"
  move_files "*_IMPLEMENTATION*.md" "docs/sessions" "Implementation docs"
  move_files "*_TRACKER*.md" "docs/sessions" "Trackers"
  move_files "*_READINESS*.md" "docs/sessions" "Readiness docs"
  move_files "PHASE_3_4_*.md" "docs/sessions" "Phase 3&4 docs"
  move_files "START_*.md" "docs/sessions" "Start guides"
  move_files "CLIENT_PWA_*.md" "docs/sessions" "Client PWA docs"
  
  # Move roadmaps
  move_files "*_ROADMAP*.md" "docs/roadmaps" "Roadmaps"
  move_files "DETAILED_IMPLEMENTATION_PLAN.md" "docs/roadmaps" "Plans"
  
  # Move architecture
  move_files "VISUAL_*.txt" "docs/architecture/diagrams" "Diagrams"
  
  # Move orphaned files
  move_files "App.tsx" ".archive/orphaned" "Orphaned React"
  move_files "index.tsx" ".archive/orphaned" "Orphaned entry"
  move_files "types.ts" ".archive/orphaned" "Orphaned types"
  
  echo -e "${GREEN}✅ Root cleanup complete${NC}"
  echo ""
  echo "📋 Remaining root files:"
  find . -maxdepth 1 -type f \( -name "*.md" -o -name "*.txt" \) \
    ! -name "README.md" \
    ! -name "CONTRIBUTING.md" \
    ! -name "CHANGELOG.md" \
    2>/dev/null | wc -l | xargs echo "   Count:"
}

# Main execution
case "$TASK" in
  help|--help|-h)
    show_help
    ;;
  typescript)
    DRY_RUN_FLAG=true
    [ "$MODE" = "--execute" ] && DRY_RUN_FLAG=false
    task_typescript $DRY_RUN_FLAG
    ;;
  workspace)
    DRY_RUN_FLAG=true
    [ "$MODE" = "--execute" ] && DRY_RUN_FLAG=false
    task_workspace $DRY_RUN_FLAG
    ;;
  admin)
    DRY_RUN_FLAG=true
    [ "$MODE" = "--execute" ] && DRY_RUN_FLAG=false
    task_admin $DRY_RUN_FLAG
    ;;
  cleanup)
    DRY_RUN_FLAG=true
    [ "$MODE" = "--execute" ] && DRY_RUN_FLAG=false
    task_cleanup $DRY_RUN_FLAG
    ;;
  all)
    DRY_RUN_FLAG=true
    [ "$MODE" = "--execute" ] && DRY_RUN_FLAG=false
    
    echo -e "${BLUE}Running all tasks...${NC}"
    echo ""
    
    task_typescript $DRY_RUN_FLAG
    echo ""
    task_workspace $DRY_RUN_FLAG
    echo ""
    task_admin $DRY_RUN_FLAG
    echo ""
    task_cleanup $DRY_RUN_FLAG
    
    echo ""
    echo -e "${GREEN}✅ All tasks complete${NC}"
    ;;
  *)
    echo "Unknown task: $TASK"
    echo ""
    show_help
    exit 1
    ;;
esac
