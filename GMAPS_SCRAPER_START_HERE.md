# 🏥 Google Maps Scraper - START HERE

## ✅ Implementation Complete!

I've created a complete Google Maps scraper system to extract pharmacy (and other business) data from Google Maps and update your Supabase `businesses` table.

---

## 📦 What Was Created (8 Files)

| File | Size | Description |
|------|------|-------------|
| `scripts/gmaps_scraper.py` | 22 KB | Main Python scraper (530 lines) |
| `scripts/requirements-scraper.txt` | 58 B | Python dependencies |
| `scripts/README_SCRAPER.md` | 7.4 KB | Full documentation |
| `scripts/scrape-pharmacies.sh` | 2.4 KB | Quick start wrapper script |
| `scripts/example-scrape-kigali.sh` | 1.7 KB | Example with your Kigali URL |
| `scripts/test_scraper_setup.py` | 6.3 KB | Setup verification script |
| `scripts/QUICK_REF_SCRAPER.sh` | 3.9 KB | Quick reference card |
| `GMAPS_SCRAPER_SUMMARY.md` | 13 KB | Complete implementation guide |

---

## 🚀 Quick Start (3 Steps)

### 1. Install Dependencies
```bash
pip3 install -r scripts/requirements-scraper.txt
```

This installs:
- `selenium` - Browser automation
- `supabase` - Database client
- `webdriver-manager` - ChromeDriver installer

### 2. Set Environment Variables
```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbG..."  # Service role key (NOT anon key!)
```

### 3. Test Your Setup
```bash
python3 scripts/test_scraper_setup.py
```

This verifies:
- ✓ Python dependencies installed
- ✓ ChromeDriver available
- ✓ Environment variables set
- ✓ Supabase connection working
- ✓ Businesses table accessible

---

## 🎯 Run Your First Scrape

### Option 1: Use the Example Script (Recommended)
```bash
./scripts/example-scrape-kigali.sh
```

This will:
1. Run a dry-run preview (20 pharmacies)
2. Ask for confirmation
3. Insert to Supabase (50 pharmacies)

### Option 2: Manual Command
```bash
# Dry run (preview without inserting)
./scripts/scrape-pharmacies.sh \
  "https://www.google.com/maps/search/pharmacies/@-1.9857408,30.1006848,15z" \
  --dry-run --output preview.json

# Review the JSON
cat preview.json | jq '.[] | {name, address, phone}'

# Actual insert to Supabase
./scripts/scrape-pharmacies.sh \
  "https://www.google.com/maps/search/pharmacies/@-1.9857408,30.1006848,15z" \
  --headless --output final.json
```

---

## 📊 Expected Output

```
=== Scraped 47 pharmacies ===

=== Updating Supabase ===
Loaded 12 existing pharmacies
  ✓ INSERTED: Kigali Pharmacy (ID: uuid-123...)
  ⊘ DUPLICATE: City Pharmacy (existing ID: uuid-456...)
  ✓ INSERTED: Health Plus Pharmacy (ID: uuid-789...)
  ...

=== Update Complete ===
Inserted: 35
Skipped (duplicates): 12
Errors: 0
```

---

## 🔐 Key Features

### ✅ Duplicate Prevention
- Normalizes business name, city, and address
- Creates MD5 hash: `"pharmacy name|city|address"`
- Checks against existing businesses in Supabase
- Skips if duplicate found

### ✅ Comprehensive Data Extraction
From each business:
- Name, address, city, country
- Phone number, website
- GPS coordinates (lat/lng)
- Rating (1-5 stars)
- Review count
- Google Place ID

### ✅ Safe Testing
- Dry-run mode: Preview without inserting
- JSON export: Review before committing
- Detailed logging: See exactly what happens

---

## 🗺️ Your Kigali Pharmacies URL

```
https://www.google.com/maps/search/pharmacies/@-1.9857408,30.1006848,15z/data=!4m2!2m1!6e2?entry=ttu&g_ep=EgoyMDI1MTIwMi4wIKXMDSoASAFQAw%3D%3D
```

**Coordinates**: `-1.9857408, 30.1006848` (Kigali center)  
**Zoom level**: `15z` (neighborhood view)

---

## 🌍 Expanding to Other Business Types

Same scraper works for any business type:

```bash
# Restaurants
python3 scripts/gmaps_scraper.py \
  "https://www.google.com/maps/search/restaurants/@-1.9857,30.1006,15z"

# Hotels
python3 scripts/gmaps_scraper.py \
  "https://www.google.com/maps/search/hotels/@-1.9857,30.1006,15z"

# Gas Stations
python3 scripts/gmaps_scraper.py \
  "https://www.google.com/maps/search/gas+stations/@-1.9857,30.1006,15z"
```

**Note**: Update `category` field in script (line ~340) or add `--category` CLI argument.

---

## ✅ Verify in Supabase

After scraping, verify data was inserted:

```sql
-- Count pharmacies
SELECT COUNT(*) FROM businesses WHERE category='Pharmacy';

-- View recent inserts
SELECT name, address, rating, created_at 
FROM businesses 
WHERE category='Pharmacy' 
ORDER BY created_at DESC 
LIMIT 10;

-- Check for duplicates (should be 0)
SELECT name, COUNT(*) 
FROM businesses 
WHERE category='Pharmacy' 
GROUP BY name 
HAVING COUNT(*) > 1;
```

Or in Supabase Dashboard:
1. Go to **Table Editor** → `businesses`
2. Filter: `category = 'Pharmacy'`
3. Sort by: `created_at DESC`

---

## 💡 Integration with Your Platform

The scraper populates the `businesses` table, which is **already integrated** with:

✅ **`search_businesses_nearby()` RPC function** (from your migration)  
✅ **WhatsApp business search** - "Find pharmacy near me"  
✅ **My Business feature** - Business owners can claim listings  
✅ **Admin dashboard** - View/edit business directory  

**No additional integration needed!** Scraped businesses are immediately searchable via WhatsApp and visible in your admin dashboard.

---

## 🚨 Troubleshooting

### ChromeDriver not found
```
selenium.common.exceptions.WebDriverException: 'chromedriver' executable needs to be in PATH
```

**Fix:**
```bash
# macOS
brew install chromedriver

# Ubuntu/Debian
sudo apt-get install chromium-chromedriver
```

### Permission denied
```
supabase.exceptions.APIError: {"code":"42501","message":"permission denied"}
```

**Fix:** Use **SERVICE ROLE** key, not anon key:
```bash
export SUPABASE_SERVICE_ROLE_KEY="eyJhbG..."  # Starts with eyJhbG, ~200 chars
```

### No businesses found
```
Found 0 potential businesses
```

**Fix:**
- Remove `--headless` to see browser
- Check URL is valid
- Google may have changed HTML (update CSS selectors)

### All duplicates
```
Skipped (duplicates): 50
Inserted: 0
```

**This is correct behavior!** Businesses already exist in database.

---

## 📚 Full Documentation

| Document | Description |
|----------|-------------|
| `GMAPS_SCRAPER_SUMMARY.md` | **Complete guide** with all details |
| `scripts/README_SCRAPER.md` | Full technical documentation |
| `scripts/QUICK_REF_SCRAPER.sh` | Quick reference card (run to display) |
| `scripts/test_scraper_setup.py` | Setup verification script |

---

## 🎯 Next Steps

1. **Test setup**: `python3 scripts/test_scraper_setup.py`
2. **Run example**: `./scripts/example-scrape-kigali.sh`
3. **Verify in Supabase**: Check `businesses` table
4. **Test WhatsApp**: "Find pharmacy near me"
5. **Expand**: Scrape restaurants, hotels, gas stations, etc.

---

## 📞 Quick Reference

```bash
# Display quick reference
./scripts/QUICK_REF_SCRAPER.sh

# Test setup
python3 scripts/test_scraper_setup.py

# Example scrape (your URL)
./scripts/example-scrape-kigali.sh

# Manual scrape with all options
python3 scripts/gmaps_scraper.py "GOOGLE_MAPS_URL" \
  --country "Rwanda" \
  --city "Kigali" \
  --max-results 100 \
  --headless \
  --dry-run \
  --output data.json
```

---

## 🔒 Security

⚠️ **Important:**
- Never commit `.env.scraper` (already in `.gitignore`)
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in client code
- Service role key bypasses RLS - use only in backend/scripts
- Rate limit your scraping to avoid IP bans from Google

---

## ✅ Summary

You now have a **production-ready Google Maps scraper** that:

✅ Scrapes business data from any Google Maps search  
✅ Prevents duplicates with smart name+location matching  
✅ Integrates seamlessly with your Supabase businesses table  
✅ Supports dry-run mode for safe testing  
✅ Exports to JSON for review  
✅ Includes comprehensive error handling and logging  

**Ready to scrape!** 🚀

Start here: `./scripts/example-scrape-kigali.sh`

---

**Questions?** Read: `GMAPS_SCRAPER_SUMMARY.md`
