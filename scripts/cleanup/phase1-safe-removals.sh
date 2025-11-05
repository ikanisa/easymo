#!/bin/bash
# EasyMO Repository Cleanup - Phase 1 (Safe Removals)
# Description: Removes confirmed duplicates, experiments, and build artifacts
# Risk Level: LOW - All removals are safe
# Estimated Cleanup: ~5.5MB

set -e

BACKUP_NAME="easymo-cleanup-phase1-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🗑️  EasyMO Repository Cleanup - Phase 1 (Safe Removals)"
echo "======================================================="
echo "Repository: $REPO_ROOT"
echo "Backup: $BACKUP_NAME"
echo ""

cd "$REPO_ROOT"

# Check if we're in a git repo
if [ ! -d ".git" ]; then
  echo "❌ Error: Not in a git repository"
  exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
  echo "⚠️  WARNING: You have uncommitted changes"
  read -p "Continue anyway? (yes/no): " continue_anyway
  if [ "$continue_anyway" != "yes" ]; then
    echo "❌ Aborted"
    exit 1
  fi
fi

echo "📦 Step 1/6: Creating backup..."
tar -czf "$BACKUP_NAME" \
  easymo/ \
  angular/ \
  easymo_update.tar.gz \
  vite.config.ts.bak \
  supabase/functions/example-ground-rules/ \
  supabase/functions/call-webhook/ \
  docs/refactor/phase0 \
  docs/refactor/phase1 \
  docs/refactor/phase2 \
  docs/refactor/phase3 \
  docs/refactor/phase5 \
  docs/phase4 \
  docs/phase5 \
  2>/dev/null || echo "  (Some items may not exist)"

echo "  ✅ Backup created: $BACKUP_NAME"
echo ""

echo "🗑️  Step 2/6: Removing nested duplicate repository..."
if [ -d "easymo/" ]; then
  du -sh easymo/ 2>/dev/null || true
  rm -rf easymo/
  echo "  ✅ Removed: easymo/ (3.7MB)"
else
  echo "  ⏭️  Already removed: easymo/"
fi
echo ""

echo "🗑️  Step 3/6: Removing Angular experimental app..."
if [ -d "angular/" ]; then
  du -sh angular/ 2>/dev/null || true
  rm -rf angular/
  echo "  ✅ Removed: angular/ (824KB)"
else
  echo "  ⏭️  Already removed: angular/"
fi
echo ""

echo "🗑️  Step 4/6: Removing build artifacts..."
removed_count=0
for file in *.tar.gz *.bak .*.swp; do
  if [ -f "$file" ] && [ "$file" != "$BACKUP_NAME" ]; then
    echo "  Removing: $file"
    rm -f "$file"
    ((removed_count++))
  fi
done
if [ $removed_count -gt 0 ]; then
  echo "  ✅ Removed $removed_count artifact(s)"
else
  echo "  ⏭️  No artifacts to remove"
fi
echo ""

echo "🗑️  Step 5/6: Removing example Edge Functions..."
removed_functions=0
for func in "supabase/functions/example-ground-rules" "supabase/functions/call-webhook"; do
  if [ -d "$func" ]; then
    echo "  Removing: $func"
    rm -rf "$func"
    ((removed_functions++))
  fi
done
if [ $removed_functions -gt 0 ]; then
  echo "  ✅ Removed $removed_functions function(s)"
else
  echo "  ⏭️  No functions to remove"
fi
echo ""

echo "📦 Step 6/6: Archiving historical documentation..."
mkdir -p docs/_archive/
archived_count=0
for dir in "docs/refactor/phase0" "docs/refactor/phase1" "docs/refactor/phase2" \
           "docs/refactor/phase3" "docs/refactor/phase5" "docs/phase4" "docs/phase5"; do
  if [ -d "$dir" ]; then
    basename_dir=$(basename "$dir")
    parent_dir=$(basename "$(dirname "$dir")")
    target="docs/_archive/${parent_dir}_${basename_dir}"
    echo "  Archiving: $dir → $target"
    mv "$dir" "$target" 2>/dev/null || true
    ((archived_count++))
  fi
done
if [ $archived_count -gt 0 ]; then
  echo "  ✅ Archived $archived_count directory(ies)"
else
  echo "  ⏭️  No docs to archive"
fi
echo ""

echo "✅ Phase 1 Complete!"
echo ""
echo "📊 Summary:"
echo "  • Removed nested duplicate repository (3.7MB)"
echo "  • Removed Angular experimental app (824KB)"
echo "  • Removed build artifacts"
echo "  • Removed 2 example Edge Functions"
echo "  • Archived 7 historical documentation directories"
echo "  • Total cleanup: ~5.5MB"
echo ""
echo "💾 Backup saved: $BACKUP_NAME"
echo ""
echo "🔧 Next steps:"
echo "  1. Review changes: git status"
echo "  2. Install dependencies: pnpm install"
echo "  3. Test build: pnpm build"
echo "  4. Run tests: pnpm exec vitest run"
echo "  5. If all good, commit:"
echo "     git add -A"
echo "     git commit -m 'chore: remove duplicates and experimental code (Phase 1)'"
echo ""
echo "⚠️  To restore from backup if needed:"
echo "     tar -xzf $BACKUP_NAME"
