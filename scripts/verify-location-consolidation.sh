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
    local description="$1"
    local query="$2"
    
    if psql "$DATABASE_URL" -t -A -c "$query" 2>/dev/null | grep -q "^1$"; then
        echo -e "${GREEN}✓${NC} $description"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} $description"
        ((FAIL++))
    fi
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARN++))
}

# Check for DATABASE_URL
if [ -z "${DATABASE_URL:-}" ]; then
    echo -e "${RED}ERROR:${NC} DATABASE_URL environment variable not set"
    echo "Export your Supabase connection string:"
    echo "  export DATABASE_URL='postgresql://...'"
    exit 1
fi

echo ""
echo "1. Schema Verification"
echo "─────────────────────────────────────────────────────────────────────"

# Check saved_locations table
check "saved_locations table exists" \
    "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='saved_locations'"

# Check saved_locations.geog column
check "saved_locations.geog column exists" \
    "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='saved_locations' AND column_name='geog'"

# Check saved_locations.kind column
check "saved_locations.kind column exists" \
    "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='saved_locations' AND column_name='kind'"

# Check recent_locations table
check "recent_locations table exists" \
    "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='recent_locations'"

echo ""
echo "2. RPC Verification"
echo "─────────────────────────────────────────────────────────────────────"

RPCS=("save_recent_location" "get_recent_location" "has_recent_location" 
      "save_favorite_location" "get_saved_location" "list_saved_locations")

for rpc in "${RPCS[@]}"; do
    check "RPC $rpc exists" \
        "SELECT 1 FROM pg_proc WHERE proname='$rpc'"
done

echo ""
echo "3. RLS Policy Verification"
echo "─────────────────────────────────────────────────────────────────────"

check "recent_locations RLS enabled" \
    "SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public' AND c.relname='recent_locations' AND c.relrowsecurity=true"

check "saved_locations RLS enabled" \
    "SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public' AND c.relname='saved_locations' AND c.relrowsecurity=true"

echo ""
echo "4. Index Verification"
echo "─────────────────────────────────────────────────────────────────────"

check "saved_locations geog index exists" \
    "SELECT 1 FROM pg_indexes WHERE tablename='saved_locations' AND indexname='idx_saved_locations_geog'"

check "recent_locations geog index exists" \
    "SELECT 1 FROM pg_indexes WHERE tablename='recent_locations' AND indexname='idx_recent_locations_geog'"

echo ""
echo "5. Code Pattern Analysis (Local Repository)"
echo "─────────────────────────────────────────────────────────────────────"

# Check for legacy location_cache usage
if command -v grep &> /dev/null; then
    LEGACY_REFS=$(grep -r "location_cache" supabase/functions --include="*.ts" 2>/dev/null | grep -v "location-service" | grep -v "\.test\." | wc -l || echo "0")
    LEGACY_REFS=$(echo "$LEGACY_REFS" | tr -d ' ')
    
    if [ "$LEGACY_REFS" -gt 0 ]; then
        warn "Found $LEGACY_REFS references to legacy location_cache (should migrate to location-service)"
    else
        echo -e "${GREEN}✓${NC} No legacy location_cache references found"
        ((PASS++))
    fi
    
    # Check for location-service usage
    SERVICE_REFS=$(grep -r "location-service" supabase/functions --include="*.ts" 2>/dev/null | wc -l || echo "0")
    SERVICE_REFS=$(echo "$SERVICE_REFS" | tr -d ' ')
    
    if [ "$SERVICE_REFS" -gt 0 ]; then
        echo -e "${GREEN}✓${NC} Found $SERVICE_REFS references to location-service (good)"
        ((PASS++))
    else
        warn "No location-service references found yet (implementation pending)"
    fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "Summary: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}, ${YELLOW}$WARN warnings${NC}"
echo "═══════════════════════════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
    echo ""
    echo "Action required: Fix failing checks before proceeding"
    exit 1
fi

if [ "$WARN" -gt 0 ]; then
    echo ""
    echo "Warnings found - review recommended"
fi

exit 0
