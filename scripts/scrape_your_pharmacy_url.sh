#!/bin/bash
# Production Pharmacy Scraper for YOUR Kigali URL
# URL: https://www.google.com/maps/search/pharmacy+kigali/@-1.967805,30.0514708,13z

set -e

cd "$(dirname "$0")"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=== Kigali Pharmacy Scraper (YOUR URL) ===${NC}"
echo ""

# Check environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${YELLOW}Setting environment variables...${NC}"
    export SUPABASE_URL="https://lhbowpbcpwoiparwnwgt.supabase.co"
    export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcndud2d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDU1ODEyNywiZXhwIjoyMDc2MTM0MTI3fQ.mcL3A7LLsyo7Y45hnBXLAYCbp7FpEAfXVRrZoC4CWqc"
    echo -e "${GREEN}✓ Environment configured${NC}"
fi

# Check dependencies
echo -e "${BLUE}Checking dependencies...${NC}"
if ! pip3 show selenium >/dev/null 2>&1; then
    echo -e "${RED}Error: selenium not installed${NC}"
    echo "Installing dependencies..."
    pip3 install -r requirements-scraper.txt
fi
echo -e "${GREEN}✓ Dependencies ready${NC}"
echo ""

# Show configuration
echo -e "${YELLOW}Configuration:${NC}"
echo "  URL: https://www.google.com/maps/search/pharmacy+kigali/@-1.967805,30.0514708,13z"
echo "  Center: -1.967805, 30.0514708 (Central Kigali)"
echo "  Zoom: 13z (~10km radius)"
echo "  Category: pharmacy"
echo "  City: Kigali"
echo "  Country: Rwanda"
echo "  Max results: 100"
echo "  Mode: Headless"
echo "  Phone filter: +250 only"
echo ""
echo -e "${YELLOW}Expected results:${NC}"
echo "  Total scraped: 80-120 pharmacies"
echo "  With phones: 55-80 (65-70%)"
echo "  New inserts: 50-75"
echo "  Time: ~10-15 minutes"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# Create timestamp for output file
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="kigali_pharmacies_${TIMESTAMP}.json"

# Run scraper
echo ""
echo -e "${BLUE}Starting scrape...${NC}"
echo ""

python3 gmaps_scraper_v2.py \
  "https://www.google.com/maps/search/pharmacy+kigali/@-1.967805,30.0514708,13z" \
  --category "pharmacy" \
  --city "Kigali" \
  --country "Rwanda" \
  --max-results 100 \
  --headless \
  --output "$OUTPUT_FILE"

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}=== SCRAPING COMPLETE ===${NC}"
    echo ""
    echo "✓ Results saved to: $OUTPUT_FILE"
    echo ""
    echo -e "${BLUE}Verify in database:${NC}"
    echo "  psql \"\$DATABASE_URL\" -c \"SELECT COUNT(*) FROM businesses WHERE category='pharmacy';\""
    echo ""
    echo -e "${BLUE}View results:${NC}"
    echo "  cat $OUTPUT_FILE | jq '.[] | {name, phone, rating}'"
    echo ""
    echo -e "${BLUE}Test in WhatsApp:${NC}"
    echo "  Send: 'Find pharmacy near me'"
    echo ""
else
    echo -e "${RED}=== SCRAPING FAILED ===${NC}"
    echo "Exit code: $EXIT_CODE"
    echo "Check error messages above"
    exit $EXIT_CODE
fi
