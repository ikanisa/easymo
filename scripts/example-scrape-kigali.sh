#!/bin/bash
# Example: Scrape Kigali Pharmacies
# This shows how to use the scraper with your specific URL

# Set your Supabase credentials (if not already in environment)
# export SUPABASE_URL="https://your-project.supabase.co"
# export SUPABASE_SERVICE_ROLE_KEY="eyJhbG..."

# Your Google Maps URL for Kigali pharmacies
KIGALI_PHARMACIES_URL="https://www.google.com/maps/search/pharmacies/@-1.9857408,30.1006848,15z/data=!4m2!2m1!6e2?entry=ttu&g_ep=EgoyMDI1MTIwMi4wIKXMDSoASAFQAw%3D%3D"

echo "🏥 Scraping Kigali Pharmacies Example"
echo "====================================="
echo ""

# Step 1: DRY RUN - See what will be scraped without inserting
echo "Step 1: Running DRY RUN to preview..."
./scripts/scrape-pharmacies.sh "$KIGALI_PHARMACIES_URL" \
  --dry-run \
  --output data/pharmacies_kigali_preview.json \
  --max-results 20 \
  --city "Kigali" \
  --country "Rwanda"

echo ""
echo "✓ Preview saved to data/pharmacies_kigali_preview.json"
echo ""
read -p "Review the JSON file. Continue with actual insert? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled. Run again when ready."
    exit 0
fi

# Step 2: ACTUAL RUN - Insert to Supabase
echo ""
echo "Step 2: Running ACTUAL insert to Supabase..."
./scripts/scrape-pharmacies.sh "$KIGALI_PHARMACIES_URL" \
  --output data/pharmacies_kigali_final.json \
  --max-results 50 \
  --city "Kigali" \
  --country "Rwanda" \
  --headless

echo ""
echo "✅ Complete! Final data saved to data/pharmacies_kigali_final.json"
echo ""
echo "Next steps:"
echo "  1. Check Supabase dashboard for new businesses"
echo "  2. Run search: SELECT * FROM businesses WHERE category='Pharmacy'"
echo "  3. Test WhatsApp search: 'Find pharmacy near me'"
