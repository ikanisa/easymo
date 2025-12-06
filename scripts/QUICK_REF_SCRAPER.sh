#!/bin/bash
# GOOGLE MAPS SCRAPER - QUICK REFERENCE
# ====================================

cat << 'EOF'

🏥 GOOGLE MAPS SCRAPER - QUICK REFERENCE
========================================

📦 INSTALLATION (One-time setup)
---------------------------------
pip3 install -r scripts/requirements-scraper.txt

export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbG..."


🚀 QUICK START
--------------
# 1. Preview (Dry Run)
./scripts/scrape-pharmacies.sh \
  "GOOGLE_MAPS_URL" \
  --dry-run --output preview.json

# 2. Review JSON
cat preview.json | jq '.[] | {name, address, phone}'

# 3. Insert to Supabase
./scripts/scrape-pharmacies.sh \
  "GOOGLE_MAPS_URL" \
  --output final.json --headless


📋 EXAMPLE WITH YOUR URL
------------------------
./scripts/example-scrape-kigali.sh

# Or manually:
URL="https://www.google.com/maps/search/pharmacies/@-1.9857408,30.1006848,15z"

python3 scripts/gmaps_scraper.py "$URL" \
  --city "Kigali" \
  --country "Rwanda" \
  --max-results 50 \
  --dry-run


🎯 COMMON COMMANDS
------------------
# Full options
python3 scripts/gmaps_scraper.py <URL> \
  --country "Rwanda" \
  --city "Kigali" \
  --max-results 100 \
  --headless \
  --dry-run \
  --output data.json

# Test with 10 results
python3 scripts/gmaps_scraper.py "URL" --max-results 10 --dry-run

# Production run (headless, 50 results)
python3 scripts/gmaps_scraper.py "URL" --headless --max-results 50


🗺️ FINDING URLS
----------------
1. Go to: https://www.google.com/maps
2. Search: "pharmacies near Kigali, Rwanda"
3. Copy URL from address bar

Examples:
- Pharmacies: /search/pharmacies/@-1.9857,30.1006,15z
- Restaurants: /search/restaurants/@-1.9857,30.1006,15z
- Hotels: /search/hotels/@-1.9857,30.1006,15z


✅ VERIFY IN SUPABASE
---------------------
-- Count pharmacies
SELECT COUNT(*) FROM businesses WHERE category='Pharmacy';

-- View recent
SELECT name, address, rating, created_at 
FROM businesses 
WHERE category='Pharmacy' 
ORDER BY created_at DESC 
LIMIT 10;

-- Check duplicates (should be 0)
SELECT name, COUNT(*) 
FROM businesses 
WHERE category='Pharmacy' 
GROUP BY name 
HAVING COUNT(*) > 1;


🚨 TROUBLESHOOTING
------------------
Problem: ChromeDriver not found
Fix: brew install chromedriver  (macOS)
     sudo apt install chromium-chromedriver  (Ubuntu)

Problem: Permission denied
Fix: Use SUPABASE_SERVICE_ROLE_KEY (not anon key)

Problem: No businesses found
Fix: Remove --headless to see browser
     Check URL format

Problem: All duplicates
Fix: This is correct! Businesses already exist.
     Try: DELETE FROM businesses WHERE category='Pharmacy'


📊 OUTPUT EXAMPLE
-----------------
=== Scraped 47 pharmacies ===
Loaded 12 existing pharmacies
  ✓ INSERTED: Kigali Pharmacy (ID: uuid-123...)
  ⊘ DUPLICATE: City Pharmacy (existing)
  ✓ INSERTED: Health Plus (ID: uuid-456...)
  
=== Update Complete ===
Inserted: 35
Skipped (duplicates): 12
Errors: 0


📁 FILES CREATED
----------------
scripts/gmaps_scraper.py          - Main scraper (530 lines)
scripts/requirements-scraper.txt  - Dependencies
scripts/README_SCRAPER.md         - Full docs
scripts/scrape-pharmacies.sh      - Quick start
scripts/example-scrape-kigali.sh  - Example usage
GMAPS_SCRAPER_SUMMARY.md          - Complete guide


🔐 SECURITY
-----------
⚠️  Never commit .env.scraper
⚠️  Never expose SERVICE_ROLE_KEY in client code
⚠️  Add to .gitignore:
    echo ".env.scraper" >> .gitignore
    echo "data/*.json" >> .gitignore


📚 DOCUMENTATION
----------------
Quick Start: ./scripts/scrape-pharmacies.sh --help
Full Guide:  cat GMAPS_SCRAPER_SUMMARY.md
README:      cat scripts/README_SCRAPER.md


🎯 NEXT STEPS
-------------
1. Test: ./scripts/example-scrape-kigali.sh
2. Verify: SELECT * FROM businesses WHERE category='Pharmacy';
3. Expand: Change URL to restaurants/hotels/etc
4. Schedule: Add cron job for daily updates


Need help? Read: GMAPS_SCRAPER_SUMMARY.md

EOF
