#!/bin/bash
# Deploy Mobility P3 Enhancements
# Run this script to deploy all mobility improvements

set -e

echo "🚀 EasyMO Mobility - P3 Enhancement Deployment"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Must run from repository root${NC}"
    exit 1
fi

# Check for Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Error: Supabase CLI not found${NC}"
    echo "Install: npm install -g supabase"
    exit 1
fi

echo -e "${YELLOW}Step 1: Deploying migrations...${NC}"
echo "-----------------------------------"

# Apply migrations
echo "Applying 20251201082000_fix_trip_matching_and_intent_storage.sql..."
supabase db push --db-url "$DATABASE_URL" --include-all

echo "Applying 20251201082100_add_recommendation_functions.sql..."
# Already applied in previous step

echo "Applying 20251201100200_add_mobility_cron_jobs.sql..."
# Already applied in previous step

echo -e "${GREEN}✅ Migrations applied${NC}"
echo ""

echo -e "${YELLOW}Step 2: Deploying edge functions...${NC}"
echo "-----------------------------------"

echo "Deploying activate-recurring-trips..."
supabase functions deploy activate-recurring-trips

echo "Deploying cleanup-expired-intents..."
supabase functions deploy cleanup-expired-intents

echo -e "${GREEN}✅ Edge functions deployed${NC}"
echo ""

echo -e "${YELLOW}Step 3: Testing cron job functions...${NC}"
echo "-----------------------------------"

# Get Supabase URL and key from environment
SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${YELLOW}⚠️  Skipping tests - SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set${NC}"
    echo "To test manually:"
    echo "  curl -X POST \$SUPABASE_URL/functions/v1/activate-recurring-trips -H \"Authorization: Bearer \$SUPABASE_SERVICE_ROLE_KEY\""
    echo "  curl -X POST \$SUPABASE_URL/functions/v1/cleanup-expired-intents -H \"Authorization: Bearer \$SUPABASE_SERVICE_ROLE_KEY\""
else
    echo "Testing activate-recurring-trips..."
    ACTIVATE_RESULT=$(curl -s -X POST "$SUPABASE_URL/functions/v1/activate-recurring-trips" \
        -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")
    echo "Result: $ACTIVATE_RESULT"
    
    echo "Testing cleanup-expired-intents..."
    CLEANUP_RESULT=$(curl -s -X POST "$SUPABASE_URL/functions/v1/cleanup-expired-intents" \
        -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")
    echo "Result: $CLEANUP_RESULT"
    
    echo -e "${GREEN}✅ Functions tested${NC}"
fi

echo ""
echo -e "${YELLOW}Step 4: Verifying cron jobs...${NC}"
echo "-----------------------------------"

if [ -n "$DATABASE_URL" ]; then
    echo "Checking pg_cron jobs..."
    psql "$DATABASE_URL" -c "SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE '%mobility%' OR jobname LIKE '%recurring%';" || true
    
    echo ""
    echo "Checking system_logs..."
    psql "$DATABASE_URL" -c "SELECT event_type, created_at FROM system_logs ORDER BY created_at DESC LIMIT 5;" || true
    
    echo -e "${GREEN}✅ Verification complete${NC}"
else
    echo -e "${YELLOW}⚠️  Skipping verification - DATABASE_URL not set${NC}"
fi

echo ""
echo "================================================"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "================================================"
echo ""
echo "Next steps:"
echo "  1. Test nearby search with recommendations"
echo "  2. Test recent searches feature"
echo "  3. Verify cron jobs run at 1 AM and 2 AM"
echo "  4. Monitor system_logs table"
echo ""
echo "Monitoring queries:"
echo "  psql \$DATABASE_URL -c \"SELECT * FROM system_logs WHERE event_type LIKE '%MOBILITY%' ORDER BY created_at DESC LIMIT 10;\""
echo "  psql \$DATABASE_URL -c \"SELECT COUNT(*), pg_size_pretty(pg_total_relation_size('mobility_intents')) FROM mobility_intents;\""
echo ""
echo "📚 Documentation: MOBILITY_IMPLEMENTATION_FINAL.md"
