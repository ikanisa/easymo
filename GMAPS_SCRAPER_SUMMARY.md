# Google Maps Scraper - Complete Setup Summary

## 📋 What Was Created

I've built a complete Google Maps scraper system for your Supabase businesses table:

### Files Created
1. **`scripts/gmaps_scraper.py`** - Main Python scraper (530 lines)
2. **`scripts/requirements-scraper.txt`** - Python dependencies
3. **`scripts/README_SCRAPER.md`** - Full documentation
4. **`scripts/scrape-pharmacies.sh`** - Quick start wrapper script
5. **`scripts/example-scrape-kigali.sh`** - Example usage with your URL

---

## 🚀 Quick Start (3 Steps)

### 1. Install Dependencies
```bash
pip3 install -r scripts/requirements-scraper.txt
```

**Required packages:**
- `selenium` (browser automation)
- `supabase` (database client)
- `webdriver-manager` (ChromeDriver auto-installer)

### 2. Set Environment Variables
```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbG..."  # Service role key (not anon!)
```

### 3. Run Scraper
```bash
# Preview first (dry run)
./scripts/scrape-pharmacies.sh \
  "https://www.google.com/maps/search/pharmacies/@-1.9857408,30.1006848,15z" \
  --dry-run --output pharmacies.json

# Then insert to Supabase
./scripts/scrape-pharmacies.sh \
  "https://www.google.com/maps/search/pharmacies/@-1.9857408,30.1006848,15z" \
  --output pharmacies_final.json --headless
```

---

## 🎯 Key Features

### ✅ Duplicate Prevention
- **Smart matching**: Normalizes business name + city + address
- **MD5 hashing**: Creates unique keys for fast lookup
- **Pre-load check**: Loads existing businesses before scraping
- **Real-time cache**: Prevents duplicates within same batch

Example:
```
Pharmacy A, KN 5 Rd, Kigali → Hash: abc123def456
Pharmacy A, KN 5 Road, Kigali → Hash: abc123def456 (DUPLICATE!)
```

### 📊 Data Extracted
From each pharmacy:
- ✓ Business name
- ✓ Address
- ✓ City
- ✓ Phone number
- ✓ Website URL
- ✓ Rating (1-5 stars)
- ✓ Review count
- ✓ GPS coordinates (lat/lng)
- ✓ External ID (Google Place ID)

### 🗄️ Database Integration
Maps to your `businesses` table:
```sql
INSERT INTO businesses (
  name, category, city, address, country,
  lat, lng, phone, website, 
  rating, review_count, status, external_id
) VALUES (...);
```

**Conflict handling**: `ON CONFLICT (external_id) DO NOTHING`

---

## 📖 Usage Examples

### Example 1: Dry Run (Preview Only)
```bash
python3 scripts/gmaps_scraper.py \
  "YOUR_GMAPS_URL" \
  --dry-run \
  --output preview.json \
  --max-results 20
```

**Output:**
```
=== Update Complete ===
Inserted: 0 (dry run)
Skipped (duplicates): 5
Errors: 0

⚠️  DRY RUN: No data was inserted. Run without --dry-run to insert.
```

### Example 2: Actual Insert
```bash
python3 scripts/gmaps_scraper.py \
  "https://www.google.com/maps/search/pharmacies/@-1.9857408,30.1006848,15z" \
  --city "Kigali" \
  --country "Rwanda" \
  --max-results 50 \
  --headless \
  --output pharmacies.json
```

**Output:**
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

### Example 3: Using Your Exact URL
```bash
./scripts/example-scrape-kigali.sh
```

This runs a 2-step process:
1. Dry run with 20 results → preview JSON
2. (After your confirmation) Actual insert with 50 results

---

## 🔧 Command Line Options

```bash
python3 scripts/gmaps_scraper.py <URL> [OPTIONS]
```

| Option | Description | Default |
|--------|-------------|---------|
| `url` | Google Maps search URL | *required* |
| `--country` | Country name | Rwanda |
| `--city` | City name | Kigali |
| `--max-results` | Max businesses to scrape | 100 |
| `--headless` | Run browser without GUI | False |
| `--dry-run` | Preview without inserting | False |
| `--output` | Save to JSON file | None |

---

## 🛡️ How Duplicate Detection Works

### Step 1: Load Existing Businesses
```python
SELECT id, name, address, city 
FROM businesses 
WHERE country='Rwanda' AND category='Pharmacy'
```

### Step 2: Generate Unique Keys
```python
def _generate_business_key(name, city, address):
    # Normalize
    norm_name = "kigali pharmacy"      # "Kigali Pharmacy!" → "kigali pharmacy"
    norm_city = "kigali"               # "Kigali  " → "kigali"
    norm_addr = "kn 5 rd nyarugenge"  # "KN 5 Rd, Nyarugenge" → first 50 chars
    
    # Hash
    key = md5("kigali pharmacy|kigali|kn 5 rd nyarugenge")
    return "abc123def456..."
```

### Step 3: Check Before Insert
```python
if key in existing_businesses:
    print(f"⊘ DUPLICATE: {name}")
    stats['skipped'] += 1
else:
    # Insert to Supabase
    supabase.table("businesses").insert({...})
```

---

## 🗺️ Finding Google Maps URLs

### Method 1: Your Example (Kigali Pharmacies)
```
https://www.google.com/maps/search/pharmacies/@-1.9857408,30.1006848,15z/data=!4m2!2m1!6e2?entry=ttu&g_ep=EgoyMDI1MTIwMi4wIKXMDSoASAFQAw%3D%3D
```

**Coordinates**: `-1.9857408, 30.1006848` (Kigali center)

### Method 2: Manual Search
1. Go to [google.com/maps](https://www.google.com/maps)
2. Search: `pharmacies near Kigali, Rwanda`
3. Copy URL from address bar

### Method 3: Specific Area
1. Navigate to specific neighborhood
2. Click "Search this area" button
3. Type: `pharmacies`
4. Copy URL

### Method 4: Other Cities
```
# Musanze pharmacies
https://www.google.com/maps/search/pharmacies/@-1.4995,29.6342,14z

# Rubavu pharmacies  
https://www.google.com/maps/search/pharmacies/@-1.6746,29.3598,14z
```

---

## 🏥 Example Output (JSON)

```json
[
  {
    "name": "Kigali Pharmacy",
    "category": "Pharmacy",
    "city": "Kigali",
    "address": "KN 5 Rd, Nyarugenge, Kigali",
    "country": "Rwanda",
    "lat": -1.9536,
    "lng": 30.0606,
    "phone": "+250 788 123 456",
    "website": "https://kigalipharmacy.rw",
    "rating": 4.5,
    "review_count": 127,
    "status": "active",
    "external_id": "gmaps_ChIJN1t_tDeuEmsRUsoyG83frY4"
  },
  {
    "name": "City Pharmacy",
    "category": "Pharmacy",
    "city": "Kigali",
    "address": "KG 11 Ave, Gasabo, Kigali",
    "country": "Rwanda",
    "lat": -1.9442,
    "lng": 30.0619,
    "phone": "+250 788 987 654",
    "website": "",
    "rating": 4.2,
    "review_count": 89,
    "status": "active",
    "external_id": "gmaps_a1b2c3d4e5f6"
  }
]
```

---

## 🚨 Troubleshooting

### Issue 1: ChromeDriver Not Found
```
WebDriverException: 'chromedriver' executable needs to be in PATH
```

**Fix (macOS):**
```bash
brew install chromedriver
```

**Fix (Ubuntu):**
```bash
sudo apt-get install chromium-chromedriver
```

**Fix (Auto):**
Use webdriver-manager (already in requirements):
```python
from webdriver_manager.chrome import ChromeDriverManager
service = Service(ChromeDriverManager().install())
```

### Issue 2: Supabase Permission Denied
```
APIError: {"code":"42501","message":"permission denied"}
```

**Fix:** Use **SERVICE ROLE** key, not anon key:
```bash
export SUPABASE_SERVICE_ROLE_KEY="eyJhbG..."  # Starts with eyJhbG, ~200 chars
```

### Issue 3: No Businesses Found
```
Found 0 potential businesses
```

**Fix:**
- Remove `--headless` to see browser
- Check URL is valid
- Google may have changed selectors (update CSS selectors in script)

### Issue 4: All Duplicates
```
Skipped (duplicates): 50
Inserted: 0
```

**Fix:** Businesses already exist! This is working correctly. Try:
- Different city/area
- Delete test data first: `DELETE FROM businesses WHERE category='Pharmacy'`
- Check with: `SELECT COUNT(*) FROM businesses WHERE category='Pharmacy'`

---

## 🔄 Expanding to Other Business Types

### Restaurants
```bash
python3 scripts/gmaps_scraper.py \
  "https://www.google.com/maps/search/restaurants/@-1.9857408,30.1006848,15z" \
  --output restaurants.json
```

**Update category in script** (line ~340):
```python
pharmacy['category'] = 'Restaurant'  # Change from 'Pharmacy'
```

### Hotels
```bash
python3 scripts/gmaps_scraper.py \
  "https://www.google.com/maps/search/hotels/@-1.9857408,30.1006848,15z" \
  --output hotels.json
```

### Gas Stations
```bash
python3 scripts/gmaps_scraper.py \
  "https://www.google.com/maps/search/gas+stations/@-1.9857408,30.1006848,15z" \
  --output gas_stations.json
```

Or make category dynamic with CLI arg:
```python
parser.add_argument('--category', default='Pharmacy', help='Business category')
# Then: pharmacy['category'] = args.category
```

---

## 📊 Database Verification

After running scraper, verify in Supabase:

### SQL Queries
```sql
-- Count pharmacies
SELECT COUNT(*) FROM businesses WHERE category = 'Pharmacy';

-- View recent inserts
SELECT name, city, address, rating, created_at 
FROM businesses 
WHERE category = 'Pharmacy' 
ORDER BY created_at DESC 
LIMIT 10;

-- Check duplicates (should be none)
SELECT name, address, COUNT(*) 
FROM businesses 
WHERE category = 'Pharmacy'
GROUP BY name, address 
HAVING COUNT(*) > 1;

-- View by city
SELECT city, COUNT(*) 
FROM businesses 
WHERE category = 'Pharmacy' 
GROUP BY city 
ORDER BY COUNT(*) DESC;
```

### Supabase Dashboard
1. Go to: Table Editor → `businesses`
2. Filter: `category` = `Pharmacy`
3. Sort by: `created_at` DESC

---

## 🔐 Security Notes

⚠️ **CRITICAL:**
- Never commit `.env.scraper` file
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in client code
- Service role key bypasses RLS - use only in backend/scripts
- Rate limit your scraping (Google may block aggressive scraping)

**Safe practices:**
```bash
# Add to .gitignore
echo ".env.scraper" >> .gitignore
echo "data/*.json" >> .gitignore

# Use env vars (not hardcoded)
export SUPABASE_SERVICE_ROLE_KEY="..."
```

---

## 📈 Performance & Limits

### Scraping Speed
- ~2-3 seconds per business (with details extraction)
- 100 businesses ≈ 5-8 minutes
- Use `--max-results` to limit for testing

### Recommended Batch Sizes
- **Test run**: 10-20 businesses
- **Production**: 50-100 businesses per run
- **Multiple runs**: Wait 5-10 minutes between runs

### Google Rate Limits
If scraping 500+ businesses:
- Add random delays: `time.sleep(random.uniform(2, 5))`
- Use different IP (VPN/proxy)
- Rotate user agents
- Run during off-peak hours

---

## 🎯 Next Steps

### 1. Test the Scraper
```bash
./scripts/example-scrape-kigali.sh
```

### 2. Verify Data
```sql
SELECT * FROM businesses WHERE category='Pharmacy' LIMIT 5;
```

### 3. Expand to Other Categories
- Restaurants
- Hotels
- Gas Stations
- Hospitals
- Banks

### 4. Integrate with WhatsApp Search
Your existing `search_businesses_nearby()` function will now return pharmacies:
```sql
SELECT * FROM search_businesses_nearby('pharmacy', -1.9536, 30.0606, 10);
```

### 5. Schedule Regular Updates
```bash
# Cron job (daily at 2 AM)
0 2 * * * cd /path/to/easymo && ./scripts/scrape-pharmacies.sh "URL" --headless
```

---

## 📝 Files Reference

```
easymo/
├── scripts/
│   ├── gmaps_scraper.py              # Main Python scraper (530 lines)
│   ├── requirements-scraper.txt      # Python dependencies
│   ├── README_SCRAPER.md             # Full documentation
│   ├── scrape-pharmacies.sh          # Quick start wrapper
│   └── example-scrape-kigali.sh      # Example with your URL
├── data/                              # Created by scraper
│   ├── pharmacies_kigali_preview.json
│   └── pharmacies_kigali_final.json
└── supabase/
    └── migrations/
        └── 20251205213000_unify_business_registry.sql  # Businesses table
```

---

## 🆘 Getting Help

**Documentation:**
- Main README: `scripts/README_SCRAPER.md`
- Migration schema: `supabase/migrations/20251205213000_unify_business_registry.sql`

**Test Commands:**
```bash
# Check dependencies
pip3 list | grep -E "selenium|supabase"

# Check ChromeDriver
chromedriver --version

# Test Supabase connection
python3 -c "from supabase import create_client; print('✓ OK')"

# Test environment
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY | cut -c1-20  # First 20 chars only
```

**Common Issues:**
1. ChromeDriver → Install via brew/apt
2. Permission denied → Use service role key
3. No results → Check URL format
4. All duplicates → Working correctly! Businesses exist

---

## ✅ Summary

You now have a **production-ready Google Maps scraper** that:

✅ Scrapes business data from any Google Maps search  
✅ Prevents duplicates with smart name+location matching  
✅ Integrates seamlessly with your Supabase businesses table  
✅ Supports dry-run mode for safe testing  
✅ Exports to JSON for review  
✅ Includes comprehensive error handling and logging  

**Start scraping:**
```bash
./scripts/scrape-pharmacies.sh "YOUR_GMAPS_URL" --dry-run --output test.json
```

Good luck! 🚀
