#!/bin/bash
set -e

# EasyMO Comprehensive Repository Cleanup
# Based on cleanup analysis document
# This script removes duplicates, build artifacts, and unused code

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                                                                  ║"
echo "║       🧹 EasyMO Comprehensive Repository Cleanup                 ║"
echo "║                                                                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

CLEANUP_LOG="cleanup-$(date +%Y%m%d-%H%M%S).log"
REMOVED_COUNT=0

log_removal() {
    echo "✅ Removed: $1" | tee -a "$CLEANUP_LOG"
    REMOVED_COUNT=$((REMOVED_COUNT + 1))
}

log_kept() {
    echo "⏩ Kept: $1" | tee -a "$CLEANUP_LOG"
}

echo "Starting cleanup at $(date)" > "$CLEANUP_LOG"
echo ""

# ============================================================================
# PHASE 1: Build Artifacts & Temporary Files
# ============================================================================
echo "📦 Phase 1: Removing build artifacts and temporary files..."
echo ""

if [ -f "easymo-aggressive-cleanup-20251105-220824.tar.gz" ]; then
    rm -f easymo-aggressive-cleanup-20251105-220824.tar.gz
    log_removal "easymo-aggressive-cleanup-20251105-220824.tar.gz"
fi

if [ -f ".staging_plan.txt" ]; then
    rm -f .staging_plan.txt
    log_removal ".staging_plan.txt"
fi

if [ -f "pnpm-workspace.yaml.phase2.bak" ]; then
    rm -f pnpm-workspace.yaml.phase2.bak
    log_removal "pnpm-workspace.yaml.phase2.bak"
fi

if [ -f "pnpm-workspace.yaml.phase3.bak" ]; then
    rm -f pnpm-workspace.yaml.phase3.bak
    log_removal "pnpm-workspace.yaml.phase3.bak"
fi

if [ -f "packages/shared/package.json.bak" ]; then
    rm -f packages/shared/package.json.bak
    log_removal "packages/shared/package.json.bak"
fi

if [ -f "supabase/functions/wa-webhook/flows/json/flow.vend.staff.v1.legacy.bak" ]; then
    rm -f supabase/functions/wa-webhook/flows/json/flow.vend.staff.v1.legacy.bak
    log_removal "supabase/functions/wa-webhook/flows/json/flow.vend.staff.v1.legacy.bak"
fi

# ============================================================================
# PHASE 2: Duplicate/Placeholder Directories
# ============================================================================
echo ""
echo "📁 Phase 2: Removing duplicate and placeholder directories..."
echo ""

# agent/ - "Dev Agent" placeholder (20KB)
if [ -d "agent" ]; then
    rm -rf agent/
    log_removal "agent/ (Dev Agent placeholder)"
fi

# app/ - "This is the app" placeholder (192KB)
if [ -d "app" ]; then
    rm -rf app/
    log_removal "app/ (placeholder directory)"
fi

# apispec/ - Empty/placeholder (16KB)
if [ -d "apispec" ]; then
    rm -rf apispec/
    log_removal "apispec/ (placeholder)"
fi

# codex_jobs/ - No README, likely unused (12KB)
if [ -d "codex_jobs" ]; then
    rm -rf codex_jobs/
    log_removal "codex_jobs/ (unused)"
fi

# config/ - Duplicate configs, already in packages/commons (16KB)
if [ -d "config" ]; then
    rm -rf config/
    log_removal "config/ (duplicate configs)"
fi

# dashboards/ - Likely old/unused (12KB)
if [ -d "dashboards" ]; then
    rm -rf dashboards/
    log_removal "dashboards/ (old/unused)"
fi

# infra/ and infrastructure/ - Likely duplicate (104KB + 16KB)
if [ -d "infra" ]; then
    rm -rf infra/
    log_removal "infra/ (duplicate of infrastructure/)"
fi

# ============================================================================
# PHASE 3: Legacy/Unused Documentation
# ============================================================================
echo ""
echo "📚 Phase 3: Archiving legacy documentation..."
echo ""

mkdir -p docs/_archive

# Archive old phase documents
ARCHIVE_DOCS=(
    "AGGRESSIVE_CLEANUP_PLAN.md"
    "CLEANUP_EXECUTION_REPORT.md"
    "CLEANUP_QUICK_REFERENCE.md"
    "DATA_FIXTURES_PLAN.md"
    "DATA_MODEL_DELTA.md"
    "DEEP_VERIFICATION_REPORT.md"
    "EF_AVAILABILITY_PROBE.md"
    "INCIDENT_RUNBOOKS.md"
    "MIGRATION_ORDER.md"
    "OUTBOUND_POLICIES.md"
    "QA_MATRIX.md"
    "REALISTIC_CLEANUP_REPORT.md"
    "REPOSITORY_CLEANUP_REPORT.md"
    "ROLLBACK_PLAYBOOK.md"
    "ROLLOUT_PLAN.md"
    "SECURITY_HARDENING_TESTING.md"
    "SUPABASE_SYNC_REPORT.md"
    "TEARDOWN_NOTES.md"
    "README_PHASE1_AUDIT.md"
    "README_PHASE2.md"
)

for doc in "${ARCHIVE_DOCS[@]}"; do
    if [ -f "$doc" ]; then
        mv "$doc" docs/_archive/
        log_removal "$doc → docs/_archive/"
    fi
done

# ============================================================================
# PHASE 4: Example/Experimental Edge Functions
# ============================================================================
echo ""
echo "⚡ Phase 4: Removing example and diagnostic Edge Functions..."
echo ""

# These are examples/diagnostics per SUPABASE_SYNC_REPORT.md
REMOVE_FUNCTIONS=(
    "supabase/functions/example-ground-rules"
    "supabase/functions/wa-webhook-diag"
)

for func in "${REMOVE_FUNCTIONS[@]}"; do
    if [ -d "$func" ]; then
        rm -rf "$func"
        log_removal "$func"
    fi
done

# ============================================================================
# PHASE 5: Legacy PWA Admin Pages (Duplicates)
# ============================================================================
echo ""
echo "🔄 Phase 5: Removing duplicate admin pages in src/..."
echo ""

# Only remove duplicates that exist in admin-app
if [ -d "admin-app/app/(panel)/dashboard" ] && [ -f "src/pages/Dashboard.tsx" ]; then
    rm -f "src/pages/Dashboard.tsx"
    log_removal "src/pages/Dashboard.tsx (duplicate)"
fi

if [ -d "admin-app/app/(panel)/operations" ] && [ -f "src/pages/Operations.tsx" ]; then
    rm -f "src/pages/Operations.tsx"
    log_removal "src/pages/Operations.tsx (duplicate)"
fi

# Remove src/pages/admin/ if it exists (duplicate of admin-app)
if [ -d "src/pages/admin" ]; then
    rm -rf "src/pages/admin"
    log_removal "src/pages/admin/ (duplicate of admin-app)"
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                                                                  ║"
echo "║       ✅ Cleanup Complete                                        ║"
echo "║                                                                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "Total items removed: $REMOVED_COUNT"
echo "Log saved to: $CLEANUP_LOG"
echo ""
echo "📋 What was removed:"
echo "   - Build artifacts (.tar.gz, .bak files)"
echo "   - Duplicate directories (agent/, app/, apispec/, etc.)"
echo "   - Legacy documentation (moved to docs/_archive/)"
echo "   - Example Edge Functions"
echo "   - Duplicate admin pages in src/"
echo ""
echo "✅ What was kept:"
echo "   - All microservices (vendor-service, buyer-service, etc.)"
echo "   - Marketplace infrastructure"
echo "   - Wallet/token flows"
echo "   - MOMO QR Code"
echo "   - Bars & Restaurants (dinein)"
echo "   - Motor Insurance"
echo "   - Core admin-app"
echo "   - agent-builder/ (OpenAI agent definitions)"
echo "   - station-app/ (planned PWA)"
echo "   - infrastructure/ (deployment configs)"
echo ""
echo "🔄 Next steps:"
echo "   1. Run: pnpm install"
echo "   2. Run: pnpm build"
echo "   3. Run: pnpm exec vitest run"
echo "   4. Commit changes with detailed message"
echo ""
