#!/bin/bash
#
# EasyMO Phase 2: Remove Legacy Features (Baskets, Vouchers, Legacy Marketplace)
# Based on user requirements to focus on AI-agent-first WhatsApp flows
# Author: GitHub Copilot
# Date: 2025-11-05
#

set -e

REPO_ROOT="/Users/jeanbosco/workspace/easymo"
cd "$REPO_ROOT"

echo "========================================"
echo "EASYMO PHASE 2: REMOVE LEGACY FEATURES"
echo "========================================"
echo ""

# Create backup log
CLEANUP_LOG="cleanup-phase2-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$CLEANUP_LOG") 2>&1

echo "📋 Removing: Baskets, Vouchers, Legacy Marketplace"
echo "📋 Keeping: Pharmacy, Quincaillerie, Shops, Property Rentals, Bars/Restaurants, MOMO QR, Insurance"
echo "Log file: $CLEANUP_LOG"
echo ""

# Track what we remove
REMOVED_ITEMS=()

#############################################
# PHASE 2.1: Remove BASKETS Feature
#############################################
echo "=== PHASE 2.1: Remove BASKETS Feature ==="
echo ""

# Remove baskets tests
if [ -f "tests/api/integration/baskets-create.integration.test.ts" ]; then
  echo "✓ Removing tests/api/integration/baskets-create.integration.test.ts"
  rm -f tests/api/integration/baskets-create.integration.test.ts
  REMOVED_ITEMS+=("tests/api/integration/baskets-create.integration.test.ts")
fi

if [ -f "admin-app/tests/basket-create-route.test.ts" ]; then
  echo "✓ Removing admin-app/tests/basket-create-route.test.ts"
  rm -f admin-app/tests/basket-create-route.test.ts
  REMOVED_ITEMS+=("admin-app/tests/basket-create-route.test.ts")
fi

# Remove baskets lib files
if [ -f "admin-app/lib/baskets/baskets-service.ts" ]; then
  echo "✓ Removing admin-app/lib/baskets/"
  rm -rf admin-app/lib/baskets
  REMOVED_ITEMS+=("admin-app/lib/baskets/")
fi

if [ -f "admin-app/lib/queries/baskets.ts" ]; then
  echo "✓ Removing admin-app/lib/queries/baskets.ts"
  rm -f admin-app/lib/queries/baskets.ts
  REMOVED_ITEMS+=("admin-app/lib/queries/baskets.ts")
fi

# Remove baskets documentation
if [ -f "docs/dual_constraint_matching_and_baskets.md" ]; then
  echo "✓ Archiving baskets documentation"
  mkdir -p docs/_archive/baskets/
  mv docs/dual_constraint_matching_and_baskets.md docs/_archive/baskets/ 2>/dev/null || true
  mv docs/dual-constraint-matching-and-basket-readme.md docs/_archive/baskets/ 2>/dev/null || true
  mv docs/baskets-architecture.md docs/_archive/baskets/ 2>/dev/null || true
  REMOVED_ITEMS+=("docs/baskets*.md")
fi

# Remove baskets from wa-webhook
if [ -f "supabase/functions/wa-webhook/rpc/baskets.ts" ]; then
  echo "✓ Removing supabase/functions/wa-webhook/rpc/baskets.ts"
  rm -f supabase/functions/wa-webhook/rpc/baskets.ts
  REMOVED_ITEMS+=("supabase/functions/wa-webhook/rpc/baskets.ts")
fi

if [ -f "supabase/functions/wa-webhook/flows/json/flow.admin.baskets.v1.json" ]; then
  echo "✓ Removing supabase/functions/wa-webhook/flows/json/flow.admin.baskets.v1.json"
  rm -f supabase/functions/wa-webhook/flows/json/flow.admin.baskets.v1.json
  REMOVED_ITEMS+=("supabase/functions/wa-webhook/flows/json/flow.admin.baskets.v1.json")
fi

# Remove baskets from src/lib
if [ -f "src/lib/basketApi.ts" ]; then
  echo "✓ Removing src/lib/basketApi.ts"
  rm -f src/lib/basketApi.ts
  REMOVED_ITEMS+=("src/lib/basketApi.ts")
fi

# Note: Basket migrations are already in _disabled/, so they're inactive

echo ""

#############################################
# PHASE 2.2: Remove VOUCHERS Feature
#############################################
echo "=== PHASE 2.2: Remove VOUCHERS Feature ==="
echo ""

# Remove voucher Edge Functions
if [ -d "supabase/functions/ai-create-voucher" ]; then
  echo "✓ Removing supabase/functions/ai-create-voucher/"
  rm -rf supabase/functions/ai-create-voucher
  REMOVED_ITEMS+=("supabase/functions/ai-create-voucher/")
fi

if [ -d "supabase/functions/ai-redeem-voucher" ]; then
  echo "✓ Removing supabase/functions/ai-redeem-voucher/"
  rm -rf supabase/functions/ai-redeem-voucher
  REMOVED_ITEMS+=("supabase/functions/ai-redeem-voucher/")
fi

if [ -d "supabase/functions/ai-void-voucher" ]; then
  echo "✓ Removing supabase/functions/ai-void-voucher/"
  rm -rf supabase/functions/ai-void-voucher
  REMOVED_ITEMS+=("supabase/functions/ai-void-voucher/")
fi

# Remove voucher tests
if [ -f "admin-app/tests/voucher-generate-route.test.ts" ]; then
  echo "✓ Removing admin-app/tests/voucher-generate-route.test.ts"
  rm -f admin-app/tests/voucher-generate-route.test.ts
  REMOVED_ITEMS+=("admin-app/tests/voucher-generate-route.test.ts")
fi

if [ -f "admin-app/tests/e2e/vouchers-page.test.tsx" ]; then
  echo "✓ Removing admin-app/tests/e2e/vouchers-page.test.tsx"
  rm -f admin-app/tests/e2e/vouchers-page.test.tsx
  REMOVED_ITEMS+=("admin-app/tests/e2e/vouchers-page.test.tsx")
fi

# Remove voucher lib files
if [ -f "admin-app/lib/flow-exchange/admin-vouchers.ts" ]; then
  echo "✓ Removing admin-app/lib/flow-exchange/admin-vouchers.ts"
  rm -f admin-app/lib/flow-exchange/admin-vouchers.ts
  REMOVED_ITEMS+=("admin-app/lib/flow-exchange/admin-vouchers.ts")
fi

if [ -f "admin-app/lib/admin/admin-vouchers-service.ts" ]; then
  echo "✓ Removing admin-app/lib/admin/admin-vouchers-service.ts"
  rm -f admin-app/lib/admin/admin-vouchers-service.ts
  REMOVED_ITEMS+=("admin-app/lib/admin/admin-vouchers-service.ts")
fi

if [ -f "admin-app/lib/queries/vouchers.ts" ]; then
  echo "✓ Removing admin-app/lib/queries/vouchers.ts"
  rm -f admin-app/lib/queries/vouchers.ts
  REMOVED_ITEMS+=("admin-app/lib/queries/vouchers.ts")
fi

if [ -f "admin-app/lib/vouchers/vouchers-service.ts" ]; then
  echo "✓ Removing admin-app/lib/vouchers/"
  rm -rf admin-app/lib/vouchers
  REMOVED_ITEMS+=("admin-app/lib/vouchers/")
fi

# Remove vouchers from wa-webhook
if [ -f "supabase/functions/wa-webhook/exchange/admin/vouchers.ts" ]; then
  echo "✓ Removing supabase/functions/wa-webhook/exchange/admin/vouchers.ts"
  rm -f supabase/functions/wa-webhook/exchange/admin/vouchers.ts
  REMOVED_ITEMS+=("supabase/functions/wa-webhook/exchange/admin/vouchers.ts")
fi

if [ -f "supabase/functions/wa-webhook/flows/admin/vouchers.ts" ]; then
  echo "✓ Removing supabase/functions/wa-webhook/flows/admin/vouchers.ts"
  rm -f supabase/functions/wa-webhook/flows/admin/vouchers.ts
  REMOVED_ITEMS+=("supabase/functions/wa-webhook/flows/admin/vouchers.ts")
fi

if [ -f "supabase/functions/wa-webhook/flows/json/flow.admin.vouchers.v1.json" ]; then
  echo "✓ Removing supabase/functions/wa-webhook/flows/json/flow.admin.vouchers.v1.json"
  rm -f supabase/functions/wa-webhook/flows/json/flow.admin.vouchers.v1.json
  REMOVED_ITEMS+=("supabase/functions/wa-webhook/flows/json/flow.admin.vouchers.v1.json")
fi

# Archive voucher migration (we need to create a migration to drop tables later)
if [ -f "supabase/migrations/20251006170000_fuel_vouchers.sql" ]; then
  echo "ℹ  Note: Voucher database migration still exists - will need DROP migration"
fi

echo ""

#############################################
# PHASE 2.3: Remove Legacy MARKETPLACE Page
#############################################
echo "=== PHASE 2.3: Remove Legacy MARKETPLACE Page ==="
echo ""

# Remove legacy marketplace page (NOT the marketplace_entries table which we need for pharmacy/quincaillerie/shops)
if [ -f "src/pages/Marketplace.tsx" ]; then
  echo "✓ Removing src/pages/Marketplace.tsx (legacy marketplace page)"
  rm -f src/pages/Marketplace.tsx
  REMOVED_ITEMS+=("src/pages/Marketplace.tsx")
fi

echo "ℹ  Keeping: marketplace_entries table (used by pharmacy/quincaillerie/shops)"
echo "ℹ  Keeping: supabase/functions/wa-webhook/domains/marketplace/ (will be restructured for AI agents)"

echo ""

#############################################
# PHASE 2.4: Remove config Package (Unused)
#############################################
echo "=== PHASE 2.4: Remove Unused config Package ==="
echo ""

if [ -d "packages/config" ]; then
  echo "✓ Removing packages/config/ (0 references found)"
  rm -rf packages/config
  REMOVED_ITEMS+=("packages/config/")
fi

echo ""

#############################################
# SUMMARY
#############################################
echo "========================================"
echo "PHASE 2 CLEANUP SUMMARY"
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
echo "✅ Phase 2 cleanup complete!"
echo "📝 Full log saved to: $CLEANUP_LOG"
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo "  1. Review changes: git status"
echo "  2. Create DROP migration for vouchers table"
echo "  3. Remove baskets references from admin panel UI"
echo "  4. Update pnpm-workspace.yaml"
echo "  5. Run: pnpm install"
echo "  6. Test: pnpm exec vitest run"
echo ""
