# 🚀 Google Maps Bulk Scraper - Quick Start Guide

## ✅ What's Ready

You now have a **working Google Maps bulk scraper** with updated 2025 selectors!

### Files Created
- `scripts/gmaps_scraper_v2.py` - Modern scraper with updated selectors
- `scripts/google_maps_bulk_scraper.py` - Bulk scraper for multiple categories
- `scripts/scraper_results/` - Output directory with JSON files

---

## 📦 Installation (Already Done ✓)

```bash
# 1. Install dependencies
pip3 install -r scripts/requirements-scraper.txt

# 2. ChromeDriver auto-installs via webdriver-manager
# Nothing needed - handles version matching automatically!
```

---

## 🔐 Environment Variables

```bash
export SUPABASE_URL="https://lhbowpbcpwoiparwnwgt.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcndud2d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDU1ODEyNywiZXhwIjoyMDc2MTM0MTI3fQ.mcL3A7LLsyo7Y45hnBXLAYCbp7FpEAfXVRrZoC4CWqc"
```

**Or create `.env.scraper` file:**
```bash
cat > scripts/.env.scraper << 'EOF'
SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcndud2d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDU1ODEyNywiZXhwIjoyMDc2MTM0MTI3fQ.mcL3A7LLsyo7Y45hnBXLAYCbp7FpEAfXVRrZoC4CWqc
EOF

# Then source it:
source scripts/.env.scraper
```

---

## 🎯 Usage Examples

### 1. Test with Dry Run (5 pharmacies - NO DB insert)

```bash
cd scripts
python3 google_maps_bulk_scraper.py \
  --categories "pharmacy" \
  --per-category-limit 5 \
  --dry-run
```

**Output:** `scraper_results/pharmacy_Kigali_TIMESTAMP.json`

### 2. Single Category with DB Insert (50 pharmacies)

```bash
cd scripts
python3 google_maps_bulk_scraper.py \
  --categories "pharmacy" \
  --per-category-limit 50
```

**Confirms before inserting to database!**

### 3. Multiple Categories (e.g., 3 categories, 20 each)

```bash
cd scripts
python3 google_maps_bulk_scraper.py \
  --categories "pharmacy" "restaurant" "hotel" \
  --per-category-limit 20 \
  --delay 5
```

### 4. Full Scrape - All 48 Categories (~2,400 businesses)

```bash
cd scripts
python3 google_maps_bulk_scraper.py \
  --per-category-limit 50
```

**Note:** Uses default 48 categories. This will take ~2-3 hours!

### 5. Multiple Cities

```bash
cd scripts
python3 google_maps_bulk_scraper.py \
  --categories "pharmacy" "restaurant" \
  --cities "Kigali" "Butare" "Gisenyi" \
  --per-category-limit 30
```

---

## 📊 Sample Output

```json
{
  "name": "BIPA PHARMACY",
  "address": "KK 15 Rd, Kigali",
  "phone": "0788 932 610",
  "rating": 4.3,
  "review_count": 7,
  "category": "pharmacy",
  "city": "Kigali",
  "country": "Rwanda",
  "lat": -1.9536,
  "lng": 30.0606
}
```

---

## 🔄 Workflow

1. **Dry run test** - Preview data without DB insert
2. **Review JSON** - Check `scraper_results/*.json`
3. **Run live** - Insert to Supabase (automatic duplicate detection)
4. **Verify** - Check Supabase dashboard

---

## 🛡️ Safety Features

✅ **Duplicate Detection** - Checks existing businesses before inserting  
✅ **Dry Run Mode** - Preview without DB changes  
✅ **JSON Export** - All data saved to files  
✅ **Confirmation Prompt** - Asks before live scraping  
✅ **Rate Limiting** - Delays between categories  
✅ **Auto ChromeDriver** - No version conflicts  

---

## 📋 Default Categories (48 total)

pharmacy, restaurant, hotel, hospital, clinic, supermarket, gas station, bank, atm, cafe, bar, bakery, butchery, salon, barbershop, spa, gym, school, university, church, mosque, temple, police station, fire station, post office, library, museum, theater, cinema, parking, car wash, auto repair, mechanic, electronics store, phone shop, bookstore, clothing store, shoe store, jewelry store, furniture store, hardware store, paint store, laundry, dry cleaner, dentist, veterinary clinic, pet store

---

## 🗺️ Supported Cities

- **Kigali** (default)
- **Butare** (Huye)
- **Gisenyi** (Rubavu)
- **Rwamagana**
- **Muhanga**

Add more in `scripts/google_maps_bulk_scraper.py` → `RWANDA_CITIES` dict

---

## 🔍 Check Results in Supabase

```sql
-- Count businesses by category
SELECT category, COUNT(*) as total
FROM businesses
GROUP BY category
ORDER BY total DESC;

-- Recent pharmacies
SELECT name, address, phone, rating, created_at
FROM businesses
WHERE category = 'pharmacy'
ORDER BY created_at DESC
LIMIT 20;

-- Businesses with coordinates
SELECT name, city, lat, lng
FROM businesses
WHERE lat IS NOT NULL AND lng IS NOT NULL;
```

Or use Supabase Dashboard:
1. Go to **Table Editor** → `businesses`
2. Filter by `category`
3. Sort by `created_at DESC`

---

## ⚡ Quick Commands Cheat Sheet

```bash
# Set env (add to ~/.zshrc or ~/.bashrc to persist)
export SUPABASE_URL="https://lhbowpbcpwoiparwnwgt.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-key-here"

# 1. DRY RUN TEST (5 pharmacies, no DB)
cd scripts && python3 google_maps_bulk_scraper.py --categories "pharmacy" --per-category-limit 5 --dry-run

# 2. SINGLE CATEGORY LIVE (50 pharmacies to DB)
cd scripts && python3 google_maps_bulk_scraper.py --categories "pharmacy" --per-category-limit 50

# 3. MULTIPLE CATEGORIES (pharmacy, restaurant, hotel - 30 each)
cd scripts && python3 google_maps_bulk_scraper.py --categories "pharmacy" "restaurant" "hotel" --per-category-limit 30

# 4. ALL 48 CATEGORIES (default, ~2,400 businesses, 2-3 hours)
cd scripts && python3 google_maps_bulk_scraper.py --per-category-limit 50

# 5. HEADLESS MODE (faster, no browser window)
cd scripts && python3 google_maps_bulk_scraper.py --categories "pharmacy" --headless

# 6. CUSTOM DELAY (10 seconds between categories)
cd scripts && python3 google_maps_bulk_scraper.py --categories "pharmacy" "restaurant" --delay 10

# View latest results
cat scripts/scraper_results/*.json | jq '.[] | {name, address, phone, rating}'

# Check summary
cat scripts/scraper_results/bulk_summary_*.json | jq '.'
```

---

## 🐛 Troubleshooting

### ChromeDriver version mismatch
**Fixed!** The scraper uses `webdriver-manager` which auto-downloads the correct ChromeDriver version.

### No results scraped
- Try without `--headless` to see browser
- Check if Google Maps blocked your IP (use VPN or delay)
- Increase wait times in script

### Duplicate detection not working
- Check if `name`, `city`, `address` fields are populated
- Existing businesses must have these fields set

### Permission denied on Supabase
- Make sure you're using **SERVICE_ROLE_KEY** (JWT format), not anon key
- Key should start with `eyJhbGci...`

---

## 🎉 You're Ready!

The scraper is **production-ready** and tested. Start with:

```bash
cd scripts
python3 google_maps_bulk_scraper.py --categories "pharmacy" --per-category-limit 5 --dry-run
```

Then scale up to full scraping! 🚀

---

## 📞 Support Files

- `scripts/gmaps_scraper_v2.py` - Core scraper
- `scripts/google_maps_bulk_scraper.py` - Bulk wrapper
- `scripts/scraper_results/` - Output directory
- `GMAPS_SCRAPER_START_HERE.md` - Original docs

---

**Happy Scraping!** 🎊
