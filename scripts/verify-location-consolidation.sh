#!/usr/bin/env bash
set -euo pipefail

echo "═══════════════════════════════════════════════════════════════════"
echo "Location Consolidation Verification"
echo "═══════════════════════════════════════════════════════════════════"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

check() {
    if eval "$2"; then
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

echo ""
echo "1. Schema Verification"
echo "─────────────────────────────────────────────────────────────────────"

# Check saved_locations table
check "saved_locations table exists" \
    "grep -q 'CREATE TABLE.*saved_locations' supabase/migrations/*.sql"

# Check saved_locations.geog column
check "saved_locations.geog column exists" \
    "grep -q 'geog GEOGRAPHY' supabase/migrations/*.sql"

# Check recent_locations table
check "recent_locations table exists" \
    "grep -q 'CREATE TABLE.*recent_locations' supabase/migrations/*.sql"

echo ""
echo "2. RPC Verification"
echo "─────────────────────────────────────────────────────────────────────"

RPCS=("save_recent_location" "get_recent_location" "has_recent_location" 
      "save_favorite_location" "get_saved_location" "list_saved_locations")

for rpc in "${RPCS[@]}"; do
    check "RPC $rpc exists" \
        "grep -q 'CREATE OR REPLACE FUNCTION.*$rpc' supabase/migrations/*.sql"
done

echo ""
echo "3. Unified Service Verification"
echo "─────────────────────────────────────────────────────────────────────"

check "location-service module exists" \
    "test -f supabase/functions/_shared/location-service/index.ts"

check "location-service exports types" \
    "grep -q 'export interface SavedLocation' supabase/functions/_shared/location-service/index.ts"

check "location-service exports functions" \
    "grep -q 'export async function saveFavoriteLocation' supabase/functions/_shared/location-service/index.ts"

echo ""
echo "4. Consumer Migration Status"
echo "─────────────────────────────────────────────────────────────────────"

# Check mobility updated
check "wa-webhook-mobility uses location-service" \
    "grep -q 'from.*location-service' supabase/functions/wa-webhook-mobility/handlers/locations.ts"

# Check for legacy patterns
LEGACY_REFS=$(grep -r "location_cache" supabase/functions --include="*.ts" 2>/dev/null | grep -v "location-service" | grep -v "Legacy bridge" | wc -l || echo "0")
if [ "$LEGACY_REFS" -gt 0 ]; then
    warn "Found $LEGACY_REFS references to legacy location_cache (should migrate)"
else
    echo -e "${GREEN}✓${NC} No legacy location_cache references found"
    ((PASS++))
fi

# Check for direct table access outside service
DIRECT_ACCESS=$(grep -rE "(from|into)\s+['\"]?(app\.)?recent_locations" supabase/functions --include="*.ts" 2>/dev/null | grep -v "\.rpc" | grep -v "location-service" | wc -l || echo "0")
if [ "$DIRECT_ACCESS" -gt 0 ]; then
    warn "Found $DIRECT_ACCESS direct table accesses (should use location-service)"
else
    echo -e "${GREEN}✓${NC} No direct table access found"
    ((PASS++))
fi

echo ""
echo "5. Documentation Verification"
echo "─────────────────────────────────────────────────────────────────────"

check "LOCATION_CONSOLIDATION_STATUS.md exists" \
    "test -f LOCATION_CONSOLIDATION_STATUS.md"

check "README updated with location service" \
    "grep -q 'location-service' LOCATION_CONSOLIDATION_STATUS.md"

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "Summary: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}, ${YELLOW}$WARN warnings${NC}"
echo "═══════════════════════════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
    echo -e "${RED}Verification failed. Fix issues before deploying.${NC}"
    exit 1
elif [ "$WARN" -gt 0 ]; then
    echo -e "${YELLOW}Verification passed with warnings. Review before deploying.${NC}"
    exit 0
else
    echo -e "${GREEN}All checks passed! Location consolidation is complete.${NC}"
    exit 0
fi
