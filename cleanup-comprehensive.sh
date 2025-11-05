#!/bin/bash
#
# EasyMO Comprehensive Repository Cleanup Script
# This script removes unused code, duplicates, and legacy files
# Author: GitHub Copilot
# Date: 2025-11-05
#

set -e

REPO_ROOT="/Users/jeanbosco/workspace/easymo"
cd "$REPO_ROOT"

echo "========================================"
echo "EASYMO REPOSITORY CLEANUP"
echo "========================================"
echo ""

# Create backup log
CLEANUP_LOG="cleanup-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$CLEANUP_LOG") 2>&1

echo "📋 Starting comprehensive cleanup..."
echo "Log file: $CLEANUP_LOG"
echo ""

# Track what we remove
REMOVED_ITEMS=()

#############################################
# PHASE 1: Archive Legacy Documentation
#############################################
echo "=== PHASE 1: Archive Legacy Documentation ==="
echo ""

if [ -d "docs/refactor" ]; then
  echo "✓ Archiving docs/refactor/"
  mkdir -p docs/_archive/
  mv docs/refactor docs/_archive/
  REMOVED_ITEMS+=("docs/refactor/")
fi

if [ -f "docs/admin/phase2_supabase_alignment.md" ]; then
  echo "✓ Archiving phase docs from docs/admin/"
  mkdir -p docs/_archive/admin/
  mv docs/admin/phase*.md docs/_archive/admin/ 2>/dev/null || true
  REMOVED_ITEMS+=("docs/admin/phase*.md")
fi

if [ -f "docs/env/phase2-env-alignment.md" ]; then
  echo "✓ Archiving phase docs from docs/env/"
  mkdir -p docs/_archive/env/
  mv docs/env/phase*.md docs/_archive/env/ 2>/dev/null || true
  REMOVED_ITEMS+=("docs/env/phase*.md")
fi

if [ -f "docs/security/phase1-service-auth.md" ]; then
  echo "✓ Archiving phase docs from docs/security/"
  mkdir -p docs/_archive/security/
  mv docs/security/phase*.md docs/_archive/security/ 2>/dev/null || true
  REMOVED_ITEMS+=("docs/security/phase*.md")
fi

if [ -f "docs/deployment/phase6-smoke-checklist.md" ]; then
  echo "✓ Archiving phase docs from docs/deployment/"
  mkdir -p docs/_archive/deployment/
  mv docs/deployment/phase*.md docs/_archive/deployment/ 2>/dev/null || true
  REMOVED_ITEMS+=("docs/deployment/phase*.md")
fi

echo ""

#############################################
# PHASE 2: Remove Voice-Only Services
#############################################
echo "=== PHASE 2: Remove Voice-Only Services ==="
echo ""

# ai-realtime service (voice calls only)
if [ -d "services/ai-realtime" ]; then
  echo "✓ Removing services/ai-realtime/ (voice-only service)"
  rm -rf services/ai-realtime
  REMOVED_ITEMS+=("services/ai-realtime/")
fi

# whatsapp-bot service (redundant with wa-webhook edge function)
if [ -d "services/whatsapp-bot" ]; then
  echo "✓ Removing services/whatsapp-bot/ (redundant service)"
  rm -rf services/whatsapp-bot
  REMOVED_ITEMS+=("services/whatsapp-bot/")
fi

echo ""

#############################################
# PHASE 3: Remove Duplicate/Unused Apps
#############################################
echo "=== PHASE 3: Remove Duplicate/Unused Apps ==="
echo ""

# apps/api (check if redundant with services/*)
if [ -d "apps/api" ]; then
  echo "✓ Removing apps/api/ (functionality moved to services)"
  rm -rf apps/api
  REMOVED_ITEMS+=("apps/api/")
fi

# apps/router-fn (strangler fig pattern - keep for now but document)
if [ -d "apps/router-fn" ]; then
  echo "ℹ  Keeping apps/router-fn/ (active strangler fig migration)"
fi

echo ""

#############################################
# PHASE 4: Remove Duplicate Admin Pages
#############################################
echo "=== PHASE 4: Remove Duplicate Admin Pages in src/ ==="
echo ""

# src/pages/Operations.tsx (duplicate of admin-app)
if [ -f "src/pages/Operations.tsx" ]; then
  echo "✓ Removing src/pages/Operations.tsx (duplicate)"
  rm -f src/pages/Operations.tsx
  REMOVED_ITEMS+=("src/pages/Operations.tsx")
fi

# src/pages/Dashboard.tsx (duplicate of admin-app)
if [ -f "src/pages/Dashboard.tsx" ]; then
  echo "✓ Removing src/pages/Dashboard.tsx (duplicate)"
  rm -f src/pages/Dashboard.tsx
  REMOVED_ITEMS+=("src/pages/Dashboard.tsx")
fi

# Check if entire src/pages/admin exists
if [ -d "src/pages/admin" ]; then
  echo "✓ Removing src/pages/admin/ (fully migrated to admin-app)"
  rm -rf src/pages/admin
  REMOVED_ITEMS+=("src/pages/admin/")
fi

echo ""

#############################################
# PHASE 5: Clean Package Dependencies
#############################################
echo "=== PHASE 5: Update Package Configuration ==="
echo ""

# Update pnpm-workspace.yaml to remove deleted packages
if [ -f "pnpm-workspace.yaml" ]; then
  echo "✓ Updating pnpm-workspace.yaml"
  # Remove services that were deleted
  sed -i.bak '/ai-realtime/d' pnpm-workspace.yaml
  sed -i.bak '/whatsapp-bot/d' pnpm-workspace.yaml
  rm -f pnpm-workspace.yaml.bak
fi

echo ""

#############################################
# PHASE 6: Update Docker Compose Files
#############################################
echo "=== PHASE 6: Update Docker Compose Files ==="
echo ""

# Remove ai-realtime from docker-compose files
if grep -q "ai-realtime" docker-compose*.yml 2>/dev/null; then
  echo "⚠  Found ai-realtime in docker-compose files"
  echo "   Manual review required for docker-compose updates"
fi

# Remove whatsapp-bot from docker-compose files
if grep -q "whatsapp-bot" docker-compose*.yml 2>/dev/null; then
  echo "⚠  Found whatsapp-bot in docker-compose files"
  echo "   Manual review required for docker-compose updates"
fi

echo ""

#############################################
# SUMMARY
#############################################
echo "========================================"
echo "CLEANUP SUMMARY"
echo "========================================"
echo ""
echo "Items removed:"
for item in "${REMOVED_ITEMS[@]}"; do
  echo "  ✓ $item"
done

echo ""
echo "📊 Repository Statistics:"
echo "  Files remaining: $(find . -type f -not -path "*/node_modules/*" -not -path "*/.git/*" | wc -l | tr -d ' ')"
echo "  Size: $(du -sh . 2>/dev/null | cut -f1)"

echo ""
echo "✅ Cleanup complete!"
echo "📝 Full log saved to: $CLEANUP_LOG"
echo ""
echo "Next steps:"
echo "  1. Review changes: git status"
echo "  2. Run tests: pnpm exec vitest run"
echo "  3. Reinstall dependencies: pnpm install"
echo "  4. Commit changes: git add . && git commit -m 'chore: comprehensive repository cleanup'"
echo ""
