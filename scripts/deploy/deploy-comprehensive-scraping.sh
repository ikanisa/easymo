#!/bin/bash
# =====================================================
# COMPREHENSIVE JOB & PROPERTY BOARD DEPLOYMENT
# =====================================================
# Deploys world-class scraping for Malta & Rwanda
# Target: 100+ jobs, 50+ properties daily
# =====================================================

set -e

echo "============================================="
echo "🚀 EasyMO Comprehensive Scraping Deployment"
echo "============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo "Install: https://supabase.com/docs/guides/cli"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠️  jq not found (optional, but recommended)${NC}"
fi

echo -e "${GREEN}✅ Prerequisites OK${NC}"
echo ""

# Step 1: Apply migrations
echo "============================================="
echo "📦 Step 1: Applying Database Migrations"
echo "============================================="

echo "Applying comprehensive job sources migration..."
supabase db push

echo -e "${GREEN}✅ Migrations applied${NC}"
echo ""

# Step 2: Check environment secrets
echo "============================================="
echo "🔐 Step 2: Checking Environment Secrets"
echo "============================================="

check_secret() {
    local secret_name=$1
    if supabase secrets list 2>/dev/null | grep -q "$secret_name"; then
        echo -e "${GREEN}✅ $secret_name is set${NC}"
        return 0
    else
        echo -e "${RED}❌ $secret_name is NOT set${NC}"
        return 1
    fi
}

MISSING_SECRETS=0

if ! check_secret "OPENAI_API_KEY"; then
    echo "   Set with: supabase secrets set OPENAI_API_KEY='sk-...'"
    MISSING_SECRETS=1
fi

if ! check_secret "SERPAPI_API_KEY"; then
    echo "   Set with: supabase secrets set SERPAPI_API_KEY='...'"
    echo "   Get key at: https://serpapi.com/users/sign_up"
    MISSING_SECRETS=1
fi

if ! check_secret "SUPABASE_URL"; then
    echo "   Set with: supabase secrets set SUPABASE_URL='https://xxx.supabase.co'"
    MISSING_SECRETS=1
fi

if ! check_secret "SUPABASE_SERVICE_ROLE_KEY"; then
    echo "   Set with: supabase secrets set SUPABASE_SERVICE_ROLE_KEY='eyJ...'"
    MISSING_SECRETS=1
fi

if [ $MISSING_SECRETS -eq 1 ]; then
    echo ""
    echo -e "${RED}❌ Missing required secrets. Please set them and re-run.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All secrets configured${NC}"
echo ""

# Step 3: Deploy Edge Functions
echo "============================================="
echo "🚢 Step 3: Deploying Edge Functions"
echo "============================================="

echo "Deploying job-sources-sync..."
supabase functions deploy job-sources-sync

echo ""
echo "Deploying openai-deep-research (properties)..."
supabase functions deploy openai-deep-research

echo -e "${GREEN}✅ Edge Functions deployed${NC}"
echo ""

# Step 4: Verify deployment
echo "============================================="
echo "✅ Step 4: Verifying Deployment"
echo "============================================="

echo "Checking job sources in database..."
JOB_SOURCES_COUNT=$(supabase db execute "SELECT COUNT(*) FROM job_sources WHERE is_active = true;" 2>/dev/null | tail -1 || echo "0")

if [ "$JOB_SOURCES_COUNT" -gt 20 ]; then
    echo -e "${GREEN}✅ Job sources configured: $JOB_SOURCES_COUNT${NC}"
else
    echo -e "${YELLOW}⚠️  Job sources: $JOB_SOURCES_COUNT (expected 25+)${NC}"
fi

echo ""
echo "Checking property sources in database..."
PROPERTY_SOURCES_COUNT=$(supabase db execute "SELECT COUNT(*) FROM property_sources WHERE is_active = true;" 2>/dev/null | tail -1 || echo "0")

if [ "$PROPERTY_SOURCES_COUNT" -gt 15 ]; then
    echo -e "${GREEN}✅ Property sources configured: $PROPERTY_SOURCES_COUNT${NC}"
else
    echo -e "${YELLOW}⚠️  Property sources: $PROPERTY_SOURCES_COUNT (expected 20+)${NC}"
fi

echo ""
echo "Checking pg_cron schedules..."
CRON_JOBS=$(supabase db execute "SELECT COUNT(*) FROM cron.job WHERE jobname LIKE '%sources-sync%';" 2>/dev/null | tail -1 || echo "0")

if [ "$CRON_JOBS" -gt 1 ]; then
    echo -e "${GREEN}✅ Automated schedules configured: $CRON_JOBS${NC}"
else
    echo -e "${YELLOW}⚠️  Automated schedules: $CRON_JOBS (expected 2)${NC}"
fi

echo ""

# Step 5: Test run
echo "============================================="
echo "🧪 Step 5: Testing Job Sync (Manual Trigger)"
echo "============================================="

read -p "Run manual test sync? This will scrape jobs from configured sources. (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Triggering job-sources-sync..."
    
    RESPONSE=$(supabase functions invoke job-sources-sync --method POST --body '{}' 2>&1)
    
    if echo "$RESPONSE" | grep -q "success"; then
        echo -e "${GREEN}✅ Job sync completed successfully${NC}"
        echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    else
        echo -e "${RED}❌ Job sync failed${NC}"
        echo "$RESPONSE"
    fi
    
    echo ""
    echo "Checking job listings count..."
    JOB_COUNT=$(supabase db execute "SELECT COUNT(*) FROM job_listings WHERE is_external = true;" 2>/dev/null | tail -1 || echo "0")
    echo -e "Current jobs in database: ${GREEN}$JOB_COUNT${NC}"
    
    if [ "$JOB_COUNT" -lt 10 ]; then
        echo -e "${YELLOW}⚠️  Expected more jobs. Check logs for errors.${NC}"
    fi
else
    echo "Skipping test run."
fi

echo ""

# Step 6: Summary
echo "============================================="
echo "📊 DEPLOYMENT SUMMARY"
echo "============================================="
echo ""
echo "✅ Database migrations applied"
echo "✅ Edge Functions deployed:"
echo "   - job-sources-sync"
echo "   - openai-deep-research"
echo "✅ Sources configured:"
echo "   - Jobs: $JOB_SOURCES_COUNT sources"
echo "   - Properties: $PROPERTY_SOURCES_COUNT sources"
echo "✅ Automated scheduling:"
echo "   - Jobs sync: Daily 2 AM UTC"
echo "   - Properties sync: Daily 3 AM UTC"
echo ""
echo "============================================="
echo "📚 NEXT STEPS"
echo "============================================="
echo ""
echo "1. Monitor first automated run tomorrow at 2-3 AM UTC"
echo ""
echo "2. Check job/property counts:"
echo "   supabase db execute \"SELECT COUNT(*) FROM job_listings WHERE is_external = true;\""
echo "   supabase db execute \"SELECT COUNT(*) FROM researched_properties;\""
echo ""
echo "3. View recent additions:"
echo "   supabase db execute \"SELECT title, company_name, location, discovered_at FROM job_listings ORDER BY discovered_at DESC LIMIT 10;\""
echo ""
echo "4. Check logs for errors:"
echo "   supabase db execute \"SELECT * FROM observability_logs WHERE event LIKE '%ERROR%' ORDER BY timestamp DESC LIMIT 20;\""
echo ""
echo "5. Review comprehensive documentation:"
echo "   - supabase/functions/job-sources-sync/COMPREHENSIVE_JOB_BOARD_IMPLEMENTATION.md"
echo ""
echo "============================================="
echo "🎯 SUCCESS TARGETS"
echo "============================================="
echo ""
echo "Week 1:"
echo "  - 100+ jobs in database"
echo "  - 50+ properties in database"
echo "  - Both Malta & Rwanda represented"
echo ""
echo "Steady State:"
echo "  - 200-300+ jobs"
echo "  - 100-150+ properties"
echo "  - 20-50 new jobs/day"
echo "  - 10-20 new properties/day"
echo ""
echo -e "${GREEN}✨ Deployment Complete! ✨${NC}"
echo ""
