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
    "supabase db query --csv 'SELECT 1 FROM information_schema.tables WHERE table_schema='\''app'\'' AND table_name='\''saved_locations'\''' 2>/dev/null | grep -q '1'"

# Check saved_locations.geog column
check "saved_locations.geog column exists" \
    "supabase db query --csv 'SELECT 1 FROM information_schema.columns WHERE table_schema='\''app'\'' AND table_name='\''saved_locations'\'' AND column_name='\''geog'\''' 2>/dev/null | grep -q '1'"

# Check recent_locations table
check "recent_locations table exists" \
    "supabase db query --csv 'SELECT 1 FROM information_schema.tables WHERE table_schema='\''app'\'' AND table_name='\''recent_locations'\''' 2>/dev/null | grep -q '1'"

echo ""
echo "2. RPC Verification"
echo "─────────────────────────────────────────────────────────────────────"

RPCS=("save_recent_location" "get_recent_location" "has_recent_location" 
      "save_favorite_location" "get_saved_location" "list_saved_locations")

for rpc in "${RPCS[@]}"; do
    check "RPC $rpc exists" \
        "supabase db query --csv \"SELECT 1 FROM pg_proc WHERE proname='$rpc'\" 2>/dev/null | grep -q '1'"
done

echo ""
echo "3. RLS Policy Verification"
echo "─────────────────────────────────────────────────────────────────────"

check "recent_locations RLS enabled" \
    "supabase db query --csv 'SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='\''app'\'' AND c.relname='\''recent_locations'\''' 2>/dev/null | grep -q 't'"

check "saved_locations RLS enabled" \
    "supabase db query --csv 'SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='\''app'\'' AND c.relname='\''saved_locations'\''' 2>/dev/null | grep -q 't'"

echo ""
echo "4. Deprecation Checks"
echo "─────────────────────────────────────────────────────────────────────"

# Check for legacy location_cache usage
LEGACY_REFS=$(grep -r "location_cache" supabase/functions --include="*.ts" 2>/dev/null | grep -v "location-service" | wc -l || echo "0")
if [ "$LEGACY_REFS" -gt 0 ]; then
    warn "Found $LEGACY_REFS references to legacy location_cache (should migrate)"
fi

# Check for direct table access
DIRECT_ACCESS=$(grep -rE "(from|into)\s+['\"]?(app\.)?recent_locations" supabase/functions --include="*.ts" 2>/dev/null | grep -v "\.rpc" | wc -l || echo "0")
if [ "$DIRECT_ACCESS" -gt 0 ]; then
    warn "Found $DIRECT_ACCESS direct table accesses (should use RPCs)"
fi

echo ""
echo "5. File Structure"
echo "─────────────────────────────────────────────────────────────────────"

check "Unified location service exists" \
    "test -f supabase/functions/_shared/location-service/index.ts"

check "Location service README exists" \
    "test -f supabase/functions/_shared/location-service/README.md"

check "Migration files exist" \
    "test -f supabase/migrations/20251210000000_location_schema_reconciliation.sql"

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "Summary: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}, ${YELLOW}$WARN warnings${NC}"
echo "═══════════════════════════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
    exit 1
fi
