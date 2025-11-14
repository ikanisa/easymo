#!/bin/bash
# Script to geocode bars and businesses using Google Maps API
# Usage: ./geocode-data.sh [bars|business|all] [batch_size] [force]

set -e

# Configuration
SUPABASE_PROJECT_REF=${SUPABASE_PROJECT_REF:-"your-project-ref"}
TABLE=${1:-"all"}
BATCH_SIZE=${2:-50}
FORCE=${3:-"false"}

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Geocoding Script for EasyMo Platform${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Table: ${YELLOW}$TABLE${NC}"
echo -e "Batch Size: ${YELLOW}$BATCH_SIZE${NC}"
echo -e "Force Re-geocode: ${YELLOW}$FORCE${NC}"
echo ""

# Check if Google Maps API key is set
if [ -z "$GOOGLE_MAPS_API_KEY" ]; then
    echo -e "${RED}ERROR: GOOGLE_MAPS_API_KEY environment variable not set${NC}"
    echo "Please set it in your .env file or export it:"
    echo "export GOOGLE_MAPS_API_KEY=your_api_key_here"
    exit 1
fi

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}ERROR: Supabase CLI not installed${NC}"
    echo "Install it with: npm install -g supabase"
    exit 1
fi

echo -e "${GREEN}✓${NC} Google Maps API key found"
echo -e "${GREEN}✓${NC} Supabase CLI installed"
echo ""

# Option 1: Deploy and invoke via Supabase CLI
echo -e "${YELLOW}Deploying geocode-locations function...${NC}"
cd supabase
supabase functions deploy geocode-locations --no-verify-jwt

echo ""
echo -e "${YELLOW}Invoking geocoding function...${NC}"
supabase functions invoke geocode-locations \
  --body "{\"table\":\"$TABLE\",\"batch_size\":$BATCH_SIZE,\"force\":$FORCE}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Geocoding Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Check the results above for success/failure counts."
echo ""
echo "To view geocoded data:"
echo "  - Bars: SELECT name, latitude, longitude, geocode_status FROM bars WHERE latitude IS NOT NULL;"
echo "  - Business: SELECT name, latitude, longitude, geocode_status FROM business WHERE latitude IS NOT NULL;"
echo ""
echo "To view geocoding queue (pending/failed):"
echo "  SELECT * FROM geocoding_queue;"
