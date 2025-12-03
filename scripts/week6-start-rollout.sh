#!/bin/bash
# Week 6: Start Traffic Rollout - 10% Traffic
# Enables routing and sets initial 10% traffic

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Week 6: Start 10% Traffic Rollout            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo "Date: $(date)"
echo ""

# Check DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL not set${NC}"
    echo "Export it first: export DATABASE_URL=postgresql://..."
    exit 1
fi

echo -e "${YELLOW}⚠️  WARNING: This will start routing webhook traffic${NC}"
echo ""
echo "This will:"
echo "  • Enable routing (set enabled=true)"
echo "  • Route 10% of traffic to wa-webhook-unified"
echo "  • Domains: jobs, marketplace, property"
echo "  • Protected: mobility, profile, insurance (never routed)"
echo ""
echo "Press Enter to continue or Ctrl+C to cancel..."
read

echo ""
echo -e "${YELLOW}🚀 Step 1: Enable Routing${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

psql "$DATABASE_URL" -c "
    SELECT set_routing_enabled(true, 'Week 6 Day 3: Starting 10% rollout');
" 2>&1 | tee /tmp/enable-routing.log

echo ""
echo -e "${YELLOW}📈 Step 2: Set 10% Traffic${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

psql "$DATABASE_URL" -c "
    SELECT update_routing_percentage(10.00, 'Initial 10% rollout - monitoring for 4 hours');
" 2>&1 | tee /tmp/set-10pct.log

echo ""
echo -e "${YELLOW}📊 Step 3: Current Configuration${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

psql "$DATABASE_URL" -c "
    SELECT 
        percentage || '% traffic' as routing,
        CASE WHEN enabled THEN 'ACTIVE' ELSE 'disabled' END as status,
        array_to_string(domains, ', ') as domains,
        updated_at,
        notes
    FROM webhook_routing_config 
    ORDER BY created_at DESC 
    LIMIT 1;
"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ 10% Traffic Rollout Started!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
echo "Status:"
echo "  • Routing: ENABLED ✓"
echo "  • Percentage: 10%"
echo "  • Target: wa-webhook-unified"
echo "  • Domains: jobs, marketplace, property"
echo ""
echo "⏰ Monitoring Required (4 hours):"
echo ""
echo "1. Check stats every 15 minutes:"
echo "   psql \"\$DATABASE_URL\" -c 'SELECT * FROM webhook_routing_stats;'"
echo ""
echo "2. Check health:"
echo "   psql \"\$DATABASE_URL\" -c 'SELECT * FROM check_routing_health();'"
echo ""
echo "3. Monitor error rate (target: < 0.1%)"
echo "4. Monitor P95 latency (target: < 2000ms)"
echo ""
echo "If issues arise, rollback immediately:"
echo "   psql \"\$DATABASE_URL\" -c \"SELECT set_routing_enabled(false);\""
echo ""
echo "After 4 hours of stable operation:"
echo "   ./scripts/week6-scale-to-25pct.sh"
echo ""

