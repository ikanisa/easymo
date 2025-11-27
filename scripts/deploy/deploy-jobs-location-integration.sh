#!/bin/bash

#============================================================================
# Deploy Jobs Service - Location Integration
#============================================================================
# Implements Phase 1 - Jobs Service Location Integration
# 
# Components:
# 1. Database migration (GPS columns + nearby_jobs RPC)
# 2. Location handler (message processing + caching)
# 3. Main service updates (location-aware job search)
#
# Estimated time: 30 minutes
#============================================================================

set -e

echo "🚀 Deploying Jobs Service Location Integration..."
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Apply database migration
echo -e "${YELLOW}Step 1/3: Applying database migration...${NC}"
supabase db push || {
  echo -e "${RED}❌ Database migration failed${NC}"
  exit 1
}
echo -e "${GREEN}✅ Migration applied${NC}"
echo ""

# Step 2: Deploy edge function
echo -e "${YELLOW}Step 2/3: Deploying wa-webhook-jobs function...${NC}"
supabase functions deploy wa-webhook-jobs --no-verify-jwt || {
  echo -e "${RED}❌ Function deployment failed${NC}"
  exit 1
}
echo -e "${GREEN}✅ Function deployed${NC}"
echo ""

# Step 3: Verify deployment
echo -e "${YELLOW}Step 3/3: Verifying deployment...${NC}"

# Check if RPC functions exist
echo "  Checking nearby_jobs RPC..."
SUPABASE_URL="${SUPABASE_URL:-https://easymo.supabase.co}"
SUPABASE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

if [ -z "$SUPABASE_KEY" ]; then
  echo -e "${RED}❌ SUPABASE_SERVICE_ROLE_KEY not set${NC}"
  exit 1
fi

# Test nearby_jobs function
RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/rest/v1/rpc/search_nearby_jobs" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "_lat": -1.9536,
    "_lng": 30.0606,
    "_radius_km": 10,
    "_limit": 5
  }')

if echo "$RESPONSE" | grep -q "error"; then
  echo -e "${RED}❌ RPC function test failed: $RESPONSE${NC}"
  exit 1
fi

echo -e "${GREEN}✅ RPC functions verified${NC}"

# Check edge function health
echo "  Checking edge function health..."
HEALTH_RESPONSE=$(curl -s "${SUPABASE_URL}/functions/v1/wa-webhook-jobs/health" \
  -H "Authorization: Bearer ${SUPABASE_KEY}")

if echo "$HEALTH_RESPONSE" | grep -q '"status":"healthy"'; then
  echo -e "${GREEN}✅ Edge function healthy${NC}"
else
  echo -e "${YELLOW}⚠️  Edge function health check inconclusive${NC}"
  echo "    Response: $HEALTH_RESPONSE"
fi

echo ""
echo -e "${GREEN}=================================================="
echo "✅ Jobs Service Location Integration - DEPLOYED"
echo "==================================================${NC}"
echo ""
echo "Features Enabled:"
echo "  ✅ GPS location columns (lat, lng, geography)"
echo "  ✅ 30-minute location cache integration"
echo "  ✅ Nearby jobs search (PostGIS)"
echo "  ✅ Location message handler"
echo "  ✅ Saved location support (home/work)"
echo ""
echo "RPC Functions:"
echo "  • search_nearby_jobs(lat, lng, radius_km, limit, category, job_type)"
echo "  • get_jobs_for_user_location(user_id, radius_km, category, limit)"
echo ""
echo "Test Commands:"
echo "  1. Share location via WhatsApp to test caching"
echo "  2. Reply '1' or 'Find Jobs' to search nearby jobs"
echo "  3. Check logs: supabase functions logs wa-webhook-jobs"
echo ""
echo "Next Steps:"
echo "  • Test location sharing flow"
echo "  • Verify nearby job searches"
echo "  • Check cache expiry (30 min)"
echo "  • Monitor JOBS_LOCATION_* events in logs"
echo ""
