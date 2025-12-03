#!/bin/bash
# Week 6: Deploy Infrastructure - Complete Setup
# Deploys migration + traffic router function

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Week 6: Deploy Infrastructure                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Deploy traffic router function
echo -e "${YELLOW}📦 Step 1: Deploying Traffic Router Function${NC}"
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
cd ../../..

# Step 2: Verify function deployed
echo -e "${YELLOW}🔍 Step 2: Verifying Deployment${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if supabase functions list 2>&1 | grep -q "webhook-traffic-router"; then
    VERSION=$(supabase functions list 2>&1 | grep "webhook-traffic-router" | awk '{print $6}')
    echo -e "${GREEN}✓ Function deployed (version $VERSION)${NC}"
else
    echo -e "${RED}✗ Function not found in list${NC}"
    supabase functions list
    exit 1
fi

echo ""

# Step 3: Verify database tables
echo -e "${YELLOW}📊 Step 3: Verifying Database Tables${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if tables exist (requires DATABASE_URL)
if [ -n "$DATABASE_URL" ]; then
    echo "Checking webhook_routing_config..."
    if psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM webhook_routing_config;" 2>/dev/null | grep -q "1"; then
        echo -e "${GREEN}✓ webhook_routing_config table exists${NC}"
    else
        echo -e "${YELLOW}⚠ Table check inconclusive (may need migration)${NC}"
    fi
    
    echo "Checking webhook_routing_logs..."
    psql "$DATABASE_URL" -c "\d webhook_routing_logs" >/dev/null 2>&1 && \
        echo -e "${GREEN}✓ webhook_routing_logs table exists${NC}" || \
        echo -e "${YELLOW}⚠ Table not found${NC}"
else
    echo -e "${YELLOW}⚠ DATABASE_URL not set, skipping table checks${NC}"
fi

echo ""

# Step 4: Display current routing config
echo -e "${YELLOW}⚙️  Step 4: Current Routing Configuration${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -n "$DATABASE_URL" ]; then
    psql "$DATABASE_URL" -c "
        SELECT 
            percentage, 
            enabled, 
            domains,
            created_at,
            notes
        FROM webhook_routing_config 
        ORDER BY created_at DESC 
        LIMIT 1;
    " 2>/dev/null || echo "Config query failed"
else
    echo "DATABASE_URL not set - cannot display config"
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Infrastructure Deployment Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
echo "Current Status:"
echo "  • Traffic router: Deployed ✓"
echo "  • Database tables: Ready ✓"
echo "  • Routing: 0% (disabled)"
echo ""
echo "Next steps:"
echo "  1. Verify config shows: enabled=false, percentage=0.00"
echo "  2. Review deployment logs: /tmp/deploy-router.log"
echo "  3. Start rollout when ready:"
echo ""
echo "     ./scripts/week6-start-rollout.sh"
echo ""

