#!/bin/bash
# Week 6: Apply Database Migration
# Creates routing tables and functions

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Week 6: Apply Database Migration             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Check DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL not set${NC}"
    echo ""
    echo "Please set it first:"
    echo "  export DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres"
    echo ""
    exit 1
fi

echo -e "${YELLOW}📊 Applying Migration: 20251203140600_webhook_traffic_routing.sql${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Apply migration
if psql "$DATABASE_URL" < supabase/migrations/20251203140600_webhook_traffic_routing.sql 2>&1 | tee /tmp/migration-apply.log; then
    echo ""
    echo -e "${GREEN}✓ Migration applied successfully${NC}"
else
    echo ""
    echo -e "${RED}✗ Migration failed${NC}"
    echo "See: /tmp/migration-apply.log"
    exit 1
fi

echo ""
echo -e "${YELLOW}🔍 Verifying Tables and Functions${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verify tables
echo "Tables created:"
psql "$DATABASE_URL" -c "\dt webhook_routing*"

echo ""
echo "Views created:"
psql "$DATABASE_URL" -c "\dv webhook_routing*"

echo ""
echo "Functions created:"
psql "$DATABASE_URL" -c "\df *routing*"

echo ""
echo -e "${YELLOW}📋 Initial Configuration${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

psql "$DATABASE_URL" -c "
SELECT 
    percentage || '% traffic' as routing,
    CASE WHEN enabled THEN 'ENABLED' ELSE 'disabled' END as status,
    array_to_string(domains, ', ') as domains,
    created_at,
    notes
FROM webhook_routing_config 
ORDER BY created_at DESC 
LIMIT 1;
"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Migration Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
echo "Ready for traffic rollout:"
echo "  ./scripts/week6-start-rollout.sh"
echo ""

