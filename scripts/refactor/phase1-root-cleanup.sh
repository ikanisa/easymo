#!/bin/bash
# Phase 1: Root Directory Cleanup
# Part of World-Class Repository Refactoring Plan
# Date: 2025-12-10

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "🚀 Phase 1: Root Directory Cleanup"
echo "=================================="
echo ""

# Create archive directory with timestamp
ARCHIVE_DATE=$(date +%Y%m%d-%H%M%S)
ARCHIVE_DIR=".archive/root-cleanup-$ARCHIVE_DATE"
mkdir -p "$ARCHIVE_DIR"

echo "✅ Created archive directory: $ARCHIVE_DIR"
echo ""

# Ensure documentation structure exists
echo "📁 Ensuring documentation structure..."
mkdir -p docs/sessions/{completed,status,archive}
mkdir -p docs/summaries
mkdir -p docs/runbooks
mkdir -p docs/onboarding

echo "✅ Documentation structure verified"
echo ""

# Archive orphan files if they exist
echo "🗂️  Checking for orphan files..."
ORPHAN_COUNT=0
ORPHAN_FILES=(
  "App.tsx"
  "index.tsx"
  "types.ts"
  "stress_test.ts"
  "metadata.json"
)

for file in "${ORPHAN_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "   Archiving: $file"
    mv "$file" "$ARCHIVE_DIR/"
    ORPHAN_COUNT=$((ORPHAN_COUNT + 1))
  fi
done

if [ $ORPHAN_COUNT -eq 0 ]; then
  echo "   No orphan files found"
fi

echo ""

# Archive vendor-portal backups
echo "🗂️  Checking for vendor-portal backups..."
BACKUP_COUNT=0
for dir in vendor-portal.backup-*; do
  if [ -d "$dir" ]; then
    echo "   Archiving: $dir"
    mv "$dir" "$ARCHIVE_DIR/"
    BACKUP_COUNT=$((BACKUP_COUNT + 1))
  fi
done 2>/dev/null || true

if [ $BACKUP_COUNT -eq 0 ]; then
  echo "   No backup directories found"
fi

echo ""
echo "✅ Phase 1 cleanup complete!"
echo ""
echo "📊 Summary:"
echo "   • Orphan files archived: $ORPHAN_COUNT"
echo "   • Backup directories archived: $BACKUP_COUNT"
echo "   • Archive location: $ARCHIVE_DIR"
echo ""
echo "🔍 Next steps:"
echo "   1. Review archived files: ls -la $ARCHIVE_DIR"
echo "   2. Check changes: git status"
echo "   3. Proceed to Phase 2"
