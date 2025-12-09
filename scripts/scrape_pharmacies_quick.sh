#!/bin/bash
# Quick Pharmacy Scraping Script
# Generated: 2025-12-09 02:27 UTC

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Pharmacy Scraping - Quick Start ===${NC}"
echo ""

# Step 1: Set environment variables
echo -e "${BLUE}[1/4] Setting environment variables...${NC}"
export SUPABASE_URL="https://lhbowpbcpwoiparwnwgt.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcndud2d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDU1ODEyNywiZXhwIjoyMDc2MTM0MTI3fQ.mcL3A7LLsyo7Y45hnBXLAYCbp7FpEAfXVRrZoC4CWqc"
echo -e "${GREEN}✓ Environment configured${NC}"
echo ""

# Step 2: Check dependencies
echo -e "${BLUE}[2/4] Checking dependencies...${NC}"
if ! pip3 show selenium >/dev/null 2>&1; then
    echo -e "${RED}✗ selenium not installed${NC}"
    echo "Installing dependencies..."
    pip3 install -r scripts/requirements-scraper.txt
else
    echo -e "${GREEN}✓ Dependencies installed${NC}"
fi
echo ""

# Step 3: Navigate to scripts directory
cd scripts

# Step 4: Run scraping
echo -e "${BLUE}[3/4] Scraping Kigali pharmacies (limit: 50)...${NC}"
python3 gmaps_scraper_v2.py \
  "https://www.google.com/maps/search/pharmacy/@-2.1664214,30.1197577,12.64z" \
  --category "pharmacy" \
  --city "Kigali" \
  --max-results 50 \
  --headless

echo ""
echo -e "${BLUE}[4/4] Scraping Nyamata pharmacies (limit: 30)...${NC}"
python3 gmaps_scraper_v2.py \
  "https://www.google.com/maps/search/pharmacy+nyamata/@-2.1974495,30.1536074,12z" \
  --category "pharmacy" \
  --city "Nyamata" \
  --max-results 30 \
  --headless

echo ""
echo -e "${GREEN}=== SCRAPING COMPLETE ===${NC}"
echo ""
echo "Verify results:"
echo "  psql \"postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres\" \\"
echo "    -c \"SELECT COUNT(*) FROM businesses WHERE category = 'pharmacy';\""
