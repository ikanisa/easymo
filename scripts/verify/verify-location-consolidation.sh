#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════
# Location Consolidation Verification Script
# Verifies Phase 1 & 2 implementation of location caching consolidation
# ═══════════════════════════════════════════════════════════════════════════

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

check() {
    if eval "$2" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $1"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} $1"
        ((FAIL++))
    fi
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARN++))
}

info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}        Location Consolidation Verification${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# Phase 0: Environment Check
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}Phase 0: Environment Check${NC}"
echo "─────────────────────────────────────────────────────────────────────"

check "Supabase CLI installed" "command -v supabase"
check "Git repository is clean" "[ -z \"\$(git status --porcelain)\" ]"

echo ""

# ═══════════════════════════════════════════════════════════════════════════
# Phase 1: Schema Verification
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}Phase 1: Schema Verification${NC}"
echo "─────────────────────────────────────────────────────────────────────"

# Check saved_locations table
if supabase db query "SELECT 1 FROM information_schema.tables WHERE table_schema='app' AND table_name='saved_locations'" | grep -q "1"; then
    echo -e "${GREEN}✓${NC} saved_locations table exists"
    ((PASS++))
    
    # Check geog column
    check "saved_locations.geog column exists" \
        "supabase db query \"SELECT 1 FROM information_schema.columns WHERE table_schema='app' AND table_name='saved_locations' AND column_name='geog'\" | grep -q '1'"
    
    # Check kind column
    check "saved_locations.kind column exists" \
        "supabase db query \"SELECT 1 FROM information_schema.columns WHERE table_schema='app' AND table_name='saved_locations' AND column_name='kind'\" | grep -q '1'"
else
    echo -e "${RED}✗${NC} saved_locations table missing"
    ((FAIL++))
fi

# Check recent_locations table
if supabase db query "SELECT 1 FROM information_schema.tables WHERE table_schema='app' AND table_name='recent_locations'" | grep -q "1"; then
    echo -e "${GREEN}✓${NC} recent_locations table exists"
    ((PASS++))
    
    # Check columns
    check "recent_locations.expires_at column exists" \
        "supabase db query \"SELECT 1 FROM information_schema.columns WHERE table_schema='app' AND table_name='recent_locations' AND column_name='expires_at'\" | grep -q '1'"
    
    check "recent_locations.geog column exists" \
        "supabase db query \"SELECT 1 FROM information_schema.columns WHERE table_schema='app' AND table_name='recent_locations' AND column_name='geog'\" | grep -q '1'"
else
    echo -e "${RED}✗${NC} recent_locations table missing"
    ((FAIL++))
fi

echo ""

# ═══════════════════════════════════════════════════════════════════════════
# Phase 2: RPC Verification
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}Phase 2: RPC Function Verification${NC}"
echo "─────────────────────────────────────────────────────────────────────"

RPCS=(
    "save_recent_location"
    "get_recent_location"
    "has_recent_location"
    "save_favorite_location"
    "get_saved_location"
    "list_saved_locations"
)

for rpc in "${RPCS[@]}"; do
    check "RPC $rpc exists" \
        "supabase db query \"SELECT 1 FROM pg_proc WHERE proname='$rpc'\" | grep -q '1'"
done

echo ""

# ═══════════════════════════════════════════════════════════════════════════
# Phase 3: RLS Policy Verification
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}Phase 3: RLS Policy Verification${NC}"
echo "─────────────────────────────────────────────────────────────────────"

check "recent_locations RLS enabled" \
    "supabase db query \"SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='app' AND c.relname='recent_locations'\" | grep -q 't'"

check "saved_locations RLS enabled" \
    "supabase db query \"SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='app' AND c.relname='saved_locations'\" | grep -q 't'"

echo ""

# ═══════════════════════════════════════════════════════════════════════════
# Phase 4: Index Verification
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}Phase 4: Index Verification${NC}"
echo "─────────────────────────────────────────────────────────────────────"

check "idx_recent_locations_user_expires exists" \
    "supabase db query \"SELECT 1 FROM pg_indexes WHERE schemaname='app' AND tablename='recent_locations' AND indexname='idx_recent_locations_user_expires'\" | grep -q '1'"

check "idx_recent_locations_geog exists" \
    "supabase db query \"SELECT 1 FROM pg_indexes WHERE schemaname='app' AND tablename='recent_locations' AND indexname='idx_recent_locations_geog'\" | grep -q '1'"

check "idx_saved_locations_geog exists" \
    "supabase db query \"SELECT 1 FROM pg_indexes WHERE schemaname='app' AND tablename='saved_locations' AND indexname='idx_saved_locations_geog'\" | grep -q '1'"

echo ""

# ═══════════════════════════════════════════════════════════════════════════
# Phase 5: Migration Verification
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}Phase 5: Migration Verification${NC}"
echo "─────────────────────────────────────────────────────────────────────"

# Check if migration tracking column exists
if supabase db query "SELECT 1 FROM information_schema.columns WHERE table_schema='app' AND table_name='whatsapp_users' AND column_name='location_cache_migrated_at'" | grep -q "1"; then
    echo -e "${GREEN}✓${NC} Migration tracking column exists"
    ((PASS++))
    
    # Count migrated records
    MIGRATED_COUNT=$(supabase db query "SELECT COUNT(*) FROM app.recent_locations WHERE source='migrated_from_whatsapp_users'" | grep -oE '[0-9]+' | head -1 || echo "0")
    info "Migrated records: $MIGRATED_COUNT"
else
    warn "Migration tracking column not found (migration may not have run)"
fi

echo ""

# ═══════════════════════════════════════════════════════════════════════════
# Phase 6: Code Hygiene Checks
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}Phase 6: Code Hygiene Checks${NC}"
echo "─────────────────────────────────────────────────────────────────────"

# Check for location-service module
if [ -f "supabase/functions/_shared/location-service/index.ts" ]; then
    echo -e "${GREEN}✓${NC} Unified location-service module exists"
    ((PASS++))
else
    echo -e "${RED}✗${NC} Unified location-service module missing"
    ((FAIL++))
fi

# Check for legacy direct table access patterns
DIRECT_ACCESS=$(grep -rE "from.*['\"]?(app\.)?recent_locations" supabase/functions --include="*.ts" 2>/dev/null | grep -v "\.rpc\|location-service" | wc -l || echo "0")
if [ "$DIRECT_ACCESS" -gt 0 ]; then
    warn "Found $DIRECT_ACCESS direct table accesses (should use location-service)"
else
    echo -e "${GREEN}✓${NC} No direct table accesses found"
    ((PASS++))
fi

# Check for deprecated location_cache usage in new code
LEGACY_REFS=$(grep -r "location_cache" supabase/functions --include="*.ts" 2>/dev/null | grep -v "location-service\|updateLegacyLocationCache\|migration" | wc -l || echo "0")
if [ "$LEGACY_REFS" -gt 0 ]; then
    warn "Found $LEGACY_REFS legacy location_cache references (review for migration)"
else
    echo -e "${GREEN}✓${NC} No legacy location_cache references"
    ((PASS++))
fi

echo ""

# ═══════════════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "Summary: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}, ${YELLOW}$WARN warnings${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
echo ""

if [ "$FAIL" -gt 0 ]; then
    echo -e "${RED}❌ Verification failed. Please fix the issues above.${NC}"
    exit 1
elif [ "$WARN" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Verification passed with warnings. Review recommended.${NC}"
    exit 0
else
    echo -e "${GREEN}✅ All checks passed! Location consolidation is complete.${NC}"
    exit 0
fi
