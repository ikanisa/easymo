#!/bin/bash
# Week 6: Quick Status Check
# Shows current routing configuration and recent stats

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Week 6: Routing Status Check                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL not set${NC}"
    echo "Export it first: export DATABASE_URL=postgresql://..."
    exit 1
fi

echo -e "${YELLOW}📊 Current Configuration${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
psql "$DATABASE_URL" -c "
SELECT 
    percentage || '% → unified' as routing,
    CASE WHEN enabled THEN '✅ ENABLED' ELSE '❌ disabled' END as status,
    array_to_string(domains, ', ') as domains,
    to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') as last_updated
FROM webhook_routing_config 
ORDER BY created_at DESC 
LIMIT 1;
"

echo ""
echo -e "${YELLOW}📈 Stats (Last Hour)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
psql "$DATABASE_URL" -c "
SELECT 
    domain,
    routed_to,
    request_count as requests,
    ROUND(avg_response_ms::numeric, 0) || 'ms' as avg,
    ROUND(p95_ms::numeric, 0) || 'ms' as p95,
    error_count as errors,
    ROUND(error_rate_pct::numeric, 2) || '%' as error_rate
FROM webhook_routing_stats
ORDER BY domain, routed_to;
" 2>/dev/null || echo "No stats yet (routing may not be active)"

echo ""
echo -e "${YELLOW}🏥 Health Check${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
psql "$DATABASE_URL" -c "
SELECT 
    domain,
    routed_to,
    CASE WHEN is_healthy THEN '✅ Healthy' ELSE '⚠️  ' || issue END as status,
    ROUND(error_rate::numeric, 2) || '%' as errors,
    ROUND(p95_latency::numeric, 0) || 'ms' as p95
FROM check_routing_health();
" 2>/dev/null || echo "Health check not available yet"

echo ""

