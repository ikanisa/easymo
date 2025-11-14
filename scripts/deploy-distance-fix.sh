#!/usr/bin/env bash
# Deploy distance calculation fix to production
# This script applies the accurate PostGIS-based distance calculation

set -euo pipefail

echo "========================================"
echo "Distance Calculation Fix Deployment"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}Error: supabase CLI not found${NC}"
    echo "Install with: npm install -g supabase"
    exit 1
fi

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo -e "${RED}Error: Not logged in to Supabase${NC}"
    echo "Run: supabase login"
    exit 1
fi

echo -e "${YELLOW}This will deploy the distance calculation fix to production.${NC}"
echo ""
echo "Changes:"
echo "  - Updates nearby_businesses() to use PostGIS ST_Distance"
echo "  - Updates nearby_businesses_v2() to use PostGIS ST_Distance"
echo "  - Provides accurate distance calculations using WGS84 ellipsoid"
echo ""
echo "Impact:"
echo "  ✓ More accurate distance measurements"
echo "  ✓ Better sorting of nearby businesses"
echo "  ✓ Improved user experience"
echo ""

read -p "Continue with deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

echo ""
echo -e "${YELLOW}Deploying migration...${NC}"

# Push database migrations
if supabase db push; then
    echo ""
    echo -e "${GREEN}✓ Migration deployed successfully!${NC}"
    echo ""
    echo "Verification commands:"
    echo "  1. Check functions: supabase db remote exec --sql '\df nearby_businesses*'"
    echo "  2. Test query: supabase db remote exec --sql 'SELECT nearby_businesses(-1.9500, 30.0588, \"\", 5)'"
    echo ""
else
    echo ""
    echo -e "${RED}✗ Migration deployment failed${NC}"
    echo "Please check the error messages above."
    exit 1
fi

echo "========================================"
echo "Deployment Complete"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Monitor application logs for any distance-related issues"
echo "  2. Verify distance calculations in WhatsApp bot responses"
echo "  3. Check that 'nearby' searches return accurate results"
echo ""
echo "Documentation: See DISTANCE_CALCULATION_FIX.md for details"
