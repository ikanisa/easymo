#!/bin/bash
# Phase 2: Archive Folder Cleanup Script
# Moves .archive/ folder to archive-history branch

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "========================================"
echo "Phase 2: Archive Folder Cleanup"
echo "========================================"
echo ""

# Check if .archive exists
if [ ! -d ".archive" ]; then
    echo "❌ Error: .archive folder not found"
    exit 1
fi

echo "📋 Current .archive/ contents:"
ls -la .archive/
echo ""

# Count files
ARCHIVE_COUNT=$(find .archive -type f | wc -l | tr -d ' ')
echo "📊 Found $ARCHIVE_COUNT files in .archive/"
echo ""

# Confirmation
read -p "❓ Move .archive/ to archive-history branch? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Aborted"
    exit 1
fi

echo ""
echo "🚀 Starting archive cleanup..."
echo ""

# Save current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Stash any changes
STASH_RESULT=$(git stash) || true

# Check if archive-history branch exists
if git rev-parse --verify archive-history >/dev/null 2>&1; then
    echo "✓ archive-history branch exists, checking it out"
    git checkout archive-history
else
    echo "✓ Creating new archive-history branch"
    git checkout --orphan archive-history
    # Remove all files from index
    git rm -rf . || true
fi

# Add .archive folder
echo "✓ Adding .archive/ to archive-history branch"
git checkout "$CURRENT_BRANCH" -- .archive/
git add .archive/

# Commit to archive-history
git commit -m "Archive: .archive folder contents from main ($(date +%Y-%m-%d))

Archived from branch: $CURRENT_BRANCH
Total files: $ARCHIVE_COUNT

Contents:
- deprecated-apps/
- migrated-files/
- old-docs/
- old-scripts/
- root-cleanup-*/
- services-stray/

Reason: Consolidation Phase 2 - Clean main branch
All files preserved for historical reference."

echo "  ✓ Committed to archive-history branch"
echo ""

# Return to original branch
echo "✓ Returning to $CURRENT_BRANCH branch"
git checkout "$CURRENT_BRANCH"
[ "$STASH_RESULT" != "No local changes to save" ] && git stash pop || true

# Remove .archive from current branch
echo "✓ Removing .archive/ from $CURRENT_BRANCH"
git rm -r .archive/

echo ""
echo "✅ Archive cleanup complete!"
echo ""
echo "📊 Results:"
echo "- .archive/ removed from: $CURRENT_BRANCH"
echo "- .archive/ preserved in: archive-history branch"
echo "- Files archived: $ARCHIVE_COUNT"
echo ""
echo "🔍 To view archived files:"
echo "  git checkout archive-history"
echo "  git checkout $CURRENT_BRANCH  # Return"
echo ""
echo "💾 Next steps:"
echo "  1. Review changes: git status"
echo "  2. Commit: git commit -m 'chore: Move .archive to archive-history branch'"
echo "  3. Push: git push origin $CURRENT_BRANCH archive-history"
