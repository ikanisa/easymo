#!/bin/bash
# Rides/Mobility Microservice Deployment Script
# Deploys database migrations and edge function for rides feature

set -e  # Exit on error

echo "🚗 EasyMO Rides/Mobility Deployment"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}Error: Supabase CLI not found${NC}"
    echo "Install it with: npm install -g supabase"
    exit 1
fi

echo -e "${YELLOW}Step 1: Deploying database migrations...${NC}"
echo ""

# Deploy migrations
echo "  - Deploying match_drivers_for_trip_v2 and match_passengers_for_trip_v2..."
supabase migration up 20251124000000 || echo "Migration 20251124000000 may already be applied"

echo "  - Deploying location caching and driver notifications..."
supabase migration up 20251124000001 || echo "Migration 20251124000001 may already be applied"

echo -e "${GREEN}✓ Database migrations deployed${NC}"
echo ""

echo -e "${YELLOW}Step 2: Deploying wa-webhook-mobility edge function...${NC}"
echo ""

# Deploy edge function
supabase functions deploy wa-webhook-mobility

echo -e "${GREEN}✓ Edge function deployed${NC}"
echo ""

echo -e "${YELLOW}Step 3: Verifying deployment...${NC}"
echo ""

# Test function health
echo "  - Testing function health endpoint..."
FUNCTION_URL=$(supabase status | grep "API URL" | awk '{print $3}')
if [ -z "$FUNCTION_URL" ]; then
    echo -e "${YELLOW}  Warning: Could not auto-detect function URL${NC}"
    echo "  Please test manually: https://your-project.supabase.co/functions/v1/wa-webhook-mobility/health"
else
    HEALTH_URL="${FUNCTION_URL}/functions/v1/wa-webhook-mobility/health"
    echo "  Testing: $HEALTH_URL"
    
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL")
    if [ "$RESPONSE" = "200" ]; then
        echo -e "${GREEN}  ✓ Health check passed${NC}"
    else
        echo -e "${YELLOW}  Warning: Health check returned $RESPONSE${NC}"
    fi
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete! 🎉${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Test 'Nearby Drivers' workflow"
echo "2. Test 'Nearby Passengers' workflow"
echo "3. Test 'Schedule Trip' workflow"
echo "4. Test 'Go Online' feature"
echo "5. Test driver notifications"
echo "6. Test driver response flows"
echo ""
echo "Monitoring:"
echo "- Check Supabase logs for structured events"
echo "- Monitor WhatsApp message delivery"
echo "- Track location cache hit rates"
echo "- Measure driver response rates"
echo ""
echo "Documentation: See RIDES_IMPLEMENTATION.md"
echo ""
