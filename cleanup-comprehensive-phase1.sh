#!/bin/bash

# EasyMO Comprehensive Cleanup - Phase 1
# This script removes: Vouchers, Campaigns, Baskets, Legacy code, Duplicates
# Date: 2025-11-05

set -e

echo "🗑️  EasyMO Comprehensive Cleanup - Phase 1"
echo "============================================"
echo ""

# Track what we're removing
REMOVED_COUNT=0
REMOVED_SIZE=0

# Function to safely remove and log
safe_remove() {
    local path="$1"
    if [ -e "$path" ]; then
        local size=$(du -sh "$path" 2>/dev/null | cut -f1 || echo "0")
        echo "✓ Removing: $path ($size)"
        rm -rf "$path"
        REMOVED_COUNT=$((REMOVED_COUNT + 1))
        return 0
    else
        echo "⊗ Not found: $path"
        return 1
    fi
}

echo "📦 Phase 1: Campaign Infrastructure (Complete Removal)"
echo "-------------------------------------------------------"
safe_remove "supabase/functions/campaign-dispatch"
safe_remove "supabase/functions/cart-reminder"
safe_remove "supabase/functions/order-pending-reminder"
echo ""

echo "📦 Phase 2: Build Artifacts & Temp Files"
echo "-------------------------------------------------------"
safe_remove "cleanup-20251105-224843.log"
safe_remove "cleanup-20251105-231334.log"
safe_remove "cleanup-phase2-20251105-231601.log"
safe_remove "cleanup-comprehensive.sh"
safe_remove "cleanup-phase2-remove-legacy-features.sh"
echo ""

echo "📦 Phase 3: Legacy Documentation"
echo "-------------------------------------------------------"
mkdir -p docs/_archive/
if [ -d "docs/refactor" ]; then
    echo "✓ Archiving: docs/refactor → docs/_archive/"
    mv docs/refactor docs/_archive/ 2>/dev/null || true
fi
if [ -d "docs/admin" ]; then
    for file in docs/admin/phase2_*; do
        if [ -e "$file" ]; then
            echo "✓ Archiving: $file → docs/_archive/"
            mv "$file" docs/_archive/ 2>/dev/null || true
        fi
    done
fi
echo ""

echo "📦 Phase 4: Duplicate Services & Apps"
echo "-------------------------------------------------------"
# Check for whatsapp-bot (not used - wa-webhook handles it)
if [ -d "services/whatsapp-bot" ]; then
    echo "⚠️  Found services/whatsapp-bot (redundant with wa-webhook)"
    read -p "   Remove it? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        safe_remove "services/whatsapp-bot"
    fi
fi
echo ""

echo "📦 Phase 5: Voice Services (WhatsApp-only mode)"
echo "-------------------------------------------------------"
echo "The following are voice-only services not needed for WhatsApp text:"
echo "  - services/voice-bridge/"
echo "  - services/sip-ingress/"
echo ""
read -p "Remove voice services? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    safe_remove "services/voice-bridge"
    safe_remove "services/sip-ingress"
    safe_remove "apps/voice-bridge"
    safe_remove "apps/sip-webhook"
fi
echo ""

echo "📦 Phase 6: Legacy src/pages (Duplicated in admin-app)"
echo "-------------------------------------------------------"
if [ -d "src/pages/admin" ]; then
    echo "⚠️  Found src/pages/admin (duplicated in admin-app/app/(panel)/)"
    read -p "   Remove duplicate admin pages? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        safe_remove "src/pages/admin"
        safe_remove "src/pages/Operations.tsx"
        safe_remove "src/pages/Dashboard.tsx"
    fi
fi
echo ""

echo "📦 Phase 7: Workspace Configuration Update"
echo "-------------------------------------------------------"
echo "Updating pnpm-workspace.yaml..."
# Backup first
cp pnpm-workspace.yaml pnpm-workspace.yaml.backup
echo "✓ Backup created: pnpm-workspace.yaml.backup"
echo ""

echo "============================================"
echo "✅ Phase 1 Cleanup Complete!"
echo "============================================"
echo "Removed items: $REMOVED_COUNT"
echo ""
echo "📋 Next Steps:"
echo "1. Review changes: git status"
echo "2. Test build: pnpm install && pnpm build"
echo "3. Commit: git add -A && git commit -m 'chore: comprehensive cleanup phase 1'"
echo ""
echo "⚠️  Manual cleanup still needed:"
echo "  - Database migrations for campaigns/vouchers/baskets tables"
echo "  - Admin panel route updates"
echo "  - CI/CD workflow updates"
echo ""
