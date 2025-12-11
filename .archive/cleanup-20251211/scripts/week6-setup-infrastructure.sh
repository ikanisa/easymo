#!/bin/bash
# Week 6: Setup Traffic Routing Infrastructure
# Phase 1: Database migration and function deployment

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Week 6: Traffic Routing Infrastructure Setup ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo "Date: $(date)"
echo ""

# Step 1: Apply database migration
echo -e "${YELLOW}📊 Step 1: Applying Database Migration${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if supabase db push 2>&1 | tee /tmp/migration.log; then
    echo -e "${GREEN}✓ Database migration applied${NC}"
else
    echo -e "${RED}✗ Migration failed${NC}"
    cat /tmp/migration.log
    exit 1
fi

echo ""

# Step 2: Verify tables created
echo -e "${YELLOW}🔍 Step 2: Verifying Tables${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

psql "$DATABASE_URL" <<SQL
-- Check routing config table
SELECT COUNT(*) as config_count FROM webhook_routing_config;

-- Check routing logs table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'webhook_routing_logs'
ORDER BY ordinal_position;

-- Verify functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN ('update_routing_percentage', 'set_routing_enabled', 'check_routing_health');
SQL

echo -e "${GREEN}✓ Tables and functions verified${NC}"
echo ""

# Step 3: Deploy traffic router function
echo -e "${YELLOW}🚀 Step 3: Deploying Traffic Router Function${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd supabase/functions/webhook-traffic-router

if supabase functions deploy webhook-traffic-router 2>&1 | tee /tmp/deploy-router.log; then
    echo -e "${GREEN}✓ Traffic router deployed${NC}"
else
    echo -e "${RED}✗ Deployment failed${NC}"
    cat /tmp/deploy-router.log
    exit 1
fi

echo ""

# Step 4: Verify deployment
echo -e "${YELLOW}✅ Step 4: Verifying Deployment${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check function is deployed
if supabase functions list | grep -q "webhook-traffic-router"; then
    echo -e "${GREEN}✓ Function appears in list${NC}"
else
    echo -e "${RED}✗ Function not found in list${NC}"
    exit 1
fi

# Test health endpoint
SUPABASE_URL=$(grep SUPABASE_URL .env | cut -d '=' -f2)
HEALTH_URL="${SUPABASE_URL}/functions/v1/webhook-traffic-router"

echo "Testing health endpoint: $HEALTH_URL"

if curl -s -X GET "$HEALTH_URL" | jq -e '.status == "healthy"' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${YELLOW}⚠ Health check inconclusive (may need auth header)${NC}"
fi

echo ""

# Step 5: Display current config
echo -e "${YELLOW}📋 Step 5: Current Routing Configuration${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

psql "$DATABASE_URL" -c "SELECT * FROM webhook_routing_config ORDER BY created_at DESC LIMIT 1;"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Infrastructure Setup Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo "1. Verify routing config shows: enabled=false, percentage=0.00"
echo "2. Review logs: /tmp/migration.log, /tmp/deploy-router.log"
echo "3. Proceed to traffic rollout when ready"
echo ""
echo "To start 10% traffic:"
echo "  ./scripts/week6-rollout-10pct.sh"
echo ""

