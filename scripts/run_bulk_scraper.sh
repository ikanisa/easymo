#!/bin/bash
# Google Maps Bulk Scraper - Quick Launch Script

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Google Maps Bulk Business Scraper - Rwanda         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check environment
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${YELLOW}⚠️  Environment variables not set${NC}"
    echo ""
    echo "Setting from admin-app/.env.local..."
    
    export SUPABASE_URL="https://lhbowpbcpwoiparwnwgt.supabase.co"
    export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcndud2d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDU1ODEyNywiZXhwIjoyMDc2MTM0MTI3fQ.mcL3A7LLsyo7Y45hnBXLAYCbp7FpEAfXVRrZoC4CWqc"
    
    echo -e "${GREEN}✓ Environment configured${NC}"
fi

cd "$(dirname "$0")"

# Menu
echo -e "${GREEN}Choose an option:${NC}"
echo ""
echo "1) Dry run test (5 pharmacies, no DB insert)"
echo "2) Single category (50 results)"
echo "3) Multiple categories (3 categories × 30 results)"
echo "4) Full scrape (48 categories × 50 results = ~2,400 businesses)"
echo "5) Custom options (manual)"
echo "6) Exit"
echo ""
read -p "Enter choice [1-6]: " choice

case $choice in
    1)
        echo -e "${BLUE}Running dry run test...${NC}"
        python3 google_maps_bulk_scraper.py \
            --categories "pharmacy" \
            --per-category-limit 5 \
            --dry-run
        ;;
    2)
        echo ""
        read -p "Category (e.g., pharmacy, restaurant, hotel): " category
        echo -e "${BLUE}Scraping ${category}...${NC}"
        python3 google_maps_bulk_scraper.py \
            --categories "$category" \
            --per-category-limit 50
        ;;
    3)
        echo ""
        echo "Default: pharmacy, restaurant, hotel"
        read -p "Or enter 3 categories (space-separated): " categories
        if [ -z "$categories" ]; then
            categories="pharmacy restaurant hotel"
        fi
        echo -e "${BLUE}Scraping: ${categories}${NC}"
        python3 google_maps_bulk_scraper.py \
            --categories $categories \
            --per-category-limit 30
        ;;
    4)
        echo ""
        echo -e "${YELLOW}⚠️  WARNING: This will scrape ~2,400 businesses!${NC}"
        echo "   Estimated time: 2-3 hours"
        echo ""
        read -p "Continue? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            echo -e "${BLUE}Starting full scrape...${NC}"
            python3 google_maps_bulk_scraper.py \
                --per-category-limit 50 \
                --delay 5
        else
            echo "Cancelled."
        fi
        ;;
    5)
        echo ""
        read -p "Categories (space-separated): " categories
        read -p "Per-category limit: " limit
        read -p "Dry run? (yes/no): " dryrun
        
        extra_args=""
        if [ "$dryrun" = "yes" ]; then
            extra_args="--dry-run"
        fi
        
        echo -e "${BLUE}Running custom scrape...${NC}"
        python3 google_maps_bulk_scraper.py \
            --categories $categories \
            --per-category-limit $limit \
            $extra_args
        ;;
    6)
        echo "Goodbye!"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

# Show results
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Scraping Complete!                                  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Results saved to: scraper_results/"
echo ""
echo "View data:"
echo "  cat scraper_results/*.json | jq '.[] | {name, phone, rating}'"
echo ""
echo "View summary:"
echo "  cat scraper_results/bulk_summary_*.json | jq '.'"
echo ""
echo "Check Supabase:"
echo "  SELECT category, COUNT(*) FROM businesses GROUP BY category;"
echo ""
