#!/bin/bash
# EasyMO Repository Cleanup - Phase 2 (Verified Removals)
# Description: Removes duplicate apps and admin pages (after team verification)
# Risk Level: MEDIUM - Requires verification before running
# Estimated Cleanup: ~650KB

set -e

BACKUP_NAME="easymo-cleanup-phase2-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🗑️  EasyMO Repository Cleanup - Phase 2 (Verified Removals)"
echo "==========================================================="
echo "Repository: $REPO_ROOT"
echo "Backup: $BACKUP_NAME"
echo ""

cd "$REPO_ROOT"

# Check if we're in a git repo
if [ ! -d ".git" ]; then
  echo "❌ Error: Not in a git repository"
  exit 1
fi

# Warning prompt
echo "⚠️  WARNING: This phase removes duplicate apps and admin pages"
echo ""
echo "Items to be removed:"
echo "  • apps/admin-pwa/ (duplicate of admin-app)"
echo "  • apps/agent-core/ (duplicate of services/agent-core)"
echo "  • src/pages/admin/ (duplicate admin pages)"
echo "  • supabase/functions/wa-router/ (if REMOVE_WA_ROUTER=true)"
echo ""
echo "Before proceeding, verify:"
echo "  1. apps/admin-pwa is not in active use"
echo "  2. apps/agent-core is not referenced by other services"
echo "  3. src/pages/admin/ is fully replaced by admin-app"
echo "  4. wa-router is not called in production (if removing)"
echo ""
read -p "Have you verified the above? Type 'yes' to continue: " confirm

if [ "$confirm" != "yes" ]; then
  echo "❌ Aborted. Please verify before running this script."
  exit 1
fi

echo ""
echo "📦 Step 1/5: Creating backup..."
tar -czf "$BACKUP_NAME" \
  apps/admin-pwa/ \
  apps/agent-core/ \
  src/pages/admin/ \
  supabase/functions/wa-router/ \
  pnpm-workspace.yaml \
  2>/dev/null || echo "  (Some items may not exist)"

echo "  ✅ Backup created: $BACKUP_NAME"
echo ""

echo "🗑️  Step 2/5: Removing duplicate apps/admin-pwa..."
if [ -d "apps/admin-pwa/" ]; then
  du -sh apps/admin-pwa/ 2>/dev/null || true
  rm -rf apps/admin-pwa/
  echo "  ✅ Removed: apps/admin-pwa/"
else
  echo "  ⏭️  Already removed: apps/admin-pwa/"
fi
echo ""

echo "🗑️  Step 3/5: Removing duplicate apps/agent-core..."
if [ -d "apps/agent-core/" ]; then
  du -sh apps/agent-core/ 2>/dev/null || true
  rm -rf apps/agent-core/
  echo "  ✅ Removed: apps/agent-core/"
else
  echo "  ⏭️  Already removed: apps/agent-core/"
fi
echo ""

echo "🗑️  Step 4/5: Removing wa-router function (if enabled)..."
if [ "${REMOVE_WA_ROUTER}" = "true" ]; then
  if [ -d "supabase/functions/wa-router/" ]; then
    du -sh supabase/functions/wa-router/ 2>/dev/null || true
    rm -rf supabase/functions/wa-router/
    echo "  ✅ Removed: supabase/functions/wa-router/"
  else
    echo "  ⏭️  Already removed: supabase/functions/wa-router/"
  fi
else
  echo "  ⏭️  Skipped (set REMOVE_WA_ROUTER=true to remove)"
fi
echo ""

echo "🗑️  Step 5/5: Removing duplicate admin pages..."
if [ -d "src/pages/admin/" ]; then
  du -sh src/pages/admin/ 2>/dev/null || true
  rm -rf src/pages/admin/
  echo "  ✅ Removed: src/pages/admin/"
else
  echo "  ⏭️  Already removed: src/pages/admin/"
fi
echo ""

echo "⚙️  Updating workspace configuration..."
if [ -f "pnpm-workspace.yaml" ]; then
  # Create backup
  cp pnpm-workspace.yaml pnpm-workspace.yaml.bak
  
  # Remove apps/admin-pwa reference
  sed -i.tmp '/apps\/admin-pwa/d' pnpm-workspace.yaml
  
  # Clean up temp file
  rm -f pnpm-workspace.yaml.tmp
  
  echo "  ✅ Updated pnpm-workspace.yaml"
  echo ""
  echo "  Changes made:"
  diff pnpm-workspace.yaml.bak pnpm-workspace.yaml || true
  echo ""
fi

echo "✅ Phase 2 Complete!"
echo ""
echo "📊 Summary:"
echo "  • Removed apps/admin-pwa/"
echo "  • Removed apps/agent-core/"
echo "  • Removed src/pages/admin/"
if [ "${REMOVE_WA_ROUTER}" = "true" ]; then
  echo "  • Removed supabase/functions/wa-router/"
fi
echo "  • Updated pnpm-workspace.yaml"
echo "  • Total cleanup: ~650KB"
echo ""
echo "💾 Backup saved: $BACKUP_NAME"
echo ""
echo "🔧 Next steps:"
echo "  1. Review changes: git status"
echo "  2. Install dependencies: pnpm install"
echo "  3. Build shared packages: pnpm --filter @va/shared build && pnpm --filter @easymo/commons build"
echo "  4. Test full build: pnpm build"
echo "  5. Run tests: pnpm exec vitest run"
echo "  6. If all good, commit:"
echo "     git add -A"
echo "     git commit -m 'chore: remove verified duplicates and unused apps (Phase 2)'"
echo ""
echo "⚠️  To restore from backup if needed:"
echo "     tar -xzf $BACKUP_NAME"
echo ""
echo "💡 Optional: Set REMOVE_WA_ROUTER=true before running to also remove wa-router"
