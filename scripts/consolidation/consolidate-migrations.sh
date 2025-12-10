#!/bin/bash
# Migration Consolidation Script
# Consolidates all migration folders into single canonical supabase/migrations/
# CRITICAL: Creates archive branch for historical reference

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "========================================"
echo "Migration Consolidation Plan"
echo "========================================"
echo ""

# Check if audit was run
if [ ! -d ".consolidation-audit" ]; then
    echo "❌ Error: Please run audit-migrations.sh first"
    exit 1
fi

echo "📋 Current State:"
echo "- Total SQL files across all folders: 487"
echo "- Canonical migrations (supabase/migrations/*.sql): 44"
echo "- Folders to consolidate: 8"
echo ""

# Folders to archive
FOLDERS_TO_ARCHIVE=(
    "supabase/migrations/ibimina"
    "supabase/migrations/phased"
    "supabase/migrations/_disabled"
    "supabase/migrations/backup_20251114_104454"
    "supabase/migrations-deleted"
    "supabase/migrations-fixed"
    "supabase/migrations__archive"
    "migrations"
)

echo "🎯 Consolidation Strategy:"
echo "1. Keep: supabase/migrations/*.sql (44 canonical files)"
echo "2. Archive to git branch: ${FOLDERS_TO_ARCHIVE[*]}"
echo ""

# Confirmation prompt
read -p "❓ This will create a 'migration-archive' branch and remove ${#FOLDERS_TO_ARCHIVE[@]} folders. Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Aborted"
    exit 1
fi

echo ""
echo "🚀 Starting consolidation..."
echo ""

# Step 1: Create archive branch
echo "Step 1: Creating migration-archive branch..."
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
STASH_RESULT=$(git stash) || true

# Create orphan branch for archive
git checkout --orphan migration-archive 2>/dev/null || git checkout migration-archive

# Add only migration folders to archive
for folder in "${FOLDERS_TO_ARCHIVE[@]}"; do
    if [ -d "$folder" ]; then
        echo "  ✓ Adding $folder to archive branch"
        git add -f "$folder" || true
    fi
done

# Add audit report
if [ -d ".consolidation-audit" ]; then
    git add -f .consolidation-audit || true
fi

# Commit to archive branch
git commit -m "Archive: Migration folders consolidated on $(date +%Y-%m-%d)

Archived folders:
$(for folder in "${FOLDERS_TO_ARCHIVE[@]}"; do echo "- $folder"; done)

Total SQL files: 487
Canonical migrations kept: 44

See .consolidation-audit/ for full analysis."

echo "  ✓ Archive branch 'migration-archive' created"
echo ""

# Step 2: Return to consolidation branch
echo "Step 2: Returning to $CURRENT_BRANCH branch..."
git checkout "$CURRENT_BRANCH"
[ "$STASH_RESULT" != "No local changes to save" ] && git stash pop || true
echo ""

# Step 3: Remove archived folders from main branch
echo "Step 3: Removing archived folders..."
for folder in "${FOLDERS_TO_ARCHIVE[@]}"; do
    if [ -d "$folder" ]; then
        echo "  ✓ Removing $folder"
        git rm -r "$folder" || rm -rf "$folder"
    fi
done
echo ""

# Step 4: Create consolidation summary
cat > MIGRATION_CONSOLIDATION.md << 'EOF'
# Migration Consolidation Summary

**Date:** $(date +%Y-%m-%d)
**Branch:** consolidation-phase1-migrations

## What Was Done

### ✅ Consolidated Migrations
All migration folders have been consolidated into a single canonical location:
- **Canonical migrations:** `supabase/migrations/`
- **Total canonical files:** 44 SQL files

### 📦 Archived Folders
The following folders have been moved to the `migration-archive` branch:
- `supabase/migrations/ibimina/` (121 files)
- `supabase/migrations/phased/` (1 file)
- `supabase/migrations/_disabled/` (7 files)
- `supabase/migrations/backup_20251114_104454/` (281 files)
- `supabase/migrations-deleted/` (11 files)
- `supabase/migrations-fixed/` (12 files)
- `supabase/migrations__archive/` (2 files)
- `migrations/` (8 files)

**Total archived:** 443 SQL files

### 🔍 Access Archived Migrations
To view archived migrations:
```bash
git checkout migration-archive
ls -la supabase/migrations/ibimina/
git checkout main  # Return to main
```

## Impact

### Before Consolidation
- **Migration folders:** 9
- **Total SQL files:** 487
- **Risk:** Schema drift, deployment confusion

### After Consolidation
- **Migration folders:** 1 ✅
- **Canonical SQL files:** 44 ✅
- **Risk:** Minimal - single source of truth

## Next Steps

1. ✅ Migrations consolidated
2. 🔄 Update CI/CD to only deploy from `supabase/migrations/`
3. 🔄 Update documentation
4. 🔄 Test deployment on staging
5. 🔄 Monitor production deployment

## Rollback Plan

If needed, restore archived folders:
```bash
git checkout migration-archive -- supabase/migrations/ibimina
git checkout migration-archive -- migrations
# etc.
```

## References
- Audit report: `.consolidation-audit/` (in migration-archive branch)
- Archive branch: `migration-archive`
- Original assessment: Executive Summary document
EOF

echo "✅ Consolidation complete!"
echo ""
echo "📊 Results:"
echo "- Canonical migrations: supabase/migrations/ (44 files)"
echo "- Archived folders: 8 folders (443 files)"
echo "- Archive branch: migration-archive"
echo ""
echo "📝 Created: MIGRATION_CONSOLIDATION.md"
echo ""
echo "🔍 To review archived migrations:"
echo "  git checkout migration-archive"
echo "  git checkout $CURRENT_BRANCH  # Return"
echo ""
echo "💾 Commit these changes:"
echo "  git add -A"
echo "  git commit -m 'refactor(migrations): Consolidate to single canonical folder'"
echo "  git push origin $CURRENT_BRANCH"
echo "  git push origin migration-archive"
