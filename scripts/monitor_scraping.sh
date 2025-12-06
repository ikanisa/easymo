#!/bin/bash
# Monitor scraping progress

echo "🔍 Scraping Progress Monitor"
echo "=============================="
echo ""

# Check if scraping is running
ps aux | grep -v grep | grep "google_maps_bulk_scraper" | head -2

echo ""
echo "📊 Results so far:"
echo ""

# Count JSON files
json_count=$(ls -1 scraper_results/*.json 2>/dev/null | grep -v summary | wc -l | tr -d ' ')
echo "  JSON files: $json_count"

# Get latest summary
if ls scraper_results/bulk_summary_*.json 1> /dev/null 2>&1; then
    latest_summary=$(ls -t scraper_results/bulk_summary_*.json | head -1)
    echo "  Latest summary: $(basename $latest_summary)"
    echo ""
    cat "$latest_summary" | jq '{
        categories: .categories_processed,
        total_scraped: .total_businesses_scraped,
        inserted: .total_inserted_to_db,
        elapsed_minutes: (.elapsed_seconds / 60 | floor)
    }' 2>/dev/null || echo "  (Unable to parse summary)"
fi

echo ""
echo "📁 Recent files (last 5):"
ls -lt scraper_results/*.json 2>/dev/null | head -6 | tail -5 | awk '{print "  " $9, "(" $5 "bytes)"}'
