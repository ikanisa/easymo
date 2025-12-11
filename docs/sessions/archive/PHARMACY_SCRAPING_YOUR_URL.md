# 🏥 PHARMACY SCRAPING - EXECUTION PLAN FOR YOUR URL

**Date**: 2025-12-09  
**Your URL**: `https://www.google.com/maps/search/pharmacy+kigali/@-1.967805,30.0514708,13z`  
**Status**: ✅ SCRAPER READY - FULL EXECUTION PLAN BELOW

---

## 📊 URL ANALYSIS

### Your Provided URL:

```
https://www.google.com/maps/search/pharmacy+kigali/@-1.967805,30.0514708,13z/data=!4m2!2m1!6e2?entry=ttu&g_ep=EgoyMDI1MTIwMi4wIKXMDSoASAFQAw%3D%3D
```

**Parsed Details:**

- **Search Term**: `pharmacy kigali`
- **Center Coordinates**: `-1.967805, 30.0514708` (Kigali, Rwanda)
- **Zoom Level**: `13z` (City-level view - ~10km radius)
- **Expected Coverage**: Central Kigali + surrounding neighborhoods
- **Estimated Results**: 60-100 pharmacies in visible area

### Comparison with Existing Scripts:

The existing quick script uses:

```
https://www.google.com/maps/search/pharmacy/@-2.1664214,30.1197577,12.64z
```

- Different center point (south of your location)
- Lower zoom (12.64z vs 13z)
- Broader area coverage

**Your URL is BETTER** - more focused on central Kigali!

---

## 🚀 EXECUTION OPTIONS

### Option 1: FASTEST - Use Quick Script (Modified)

Create custom script for your URL:

```bash
#!/bin/bash
# Scrape YOUR pharmacy URL
cd /Users/jeanbosco/workspace/easymo/scripts

export SUPABASE_URL="https://lhbowpbcpwoiparwnwgt.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcndud2d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDU1ODEyNywiZXhwIjoyMDc2MTM0MTI3fQ.mcL3A7LLsyo7Y45hnBXLAYCbp7FpEAfXVRrZoC4CWqc"

python3 gmaps_scraper_v2.py \
  "https://www.google.com/maps/search/pharmacy+kigali/@-1.967805,30.0514708,13z" \
  --category "pharmacy" \
  --city "Kigali" \
  --country "Rwanda" \
  --max-results 100 \
  --headless \
  --output kigali_pharmacies_$(date +%Y%m%d).json
```

Save as: `scripts/scrape_my_pharmacy_url.sh`

**Run it:**

```bash
chmod +x scripts/scrape_my_pharmacy_url.sh
./scripts/scrape_my_pharmacy_url.sh
```

---

### Option 2: RECOMMENDED - Dry Run First

Test without inserting to database:

```bash
cd /Users/jeanbosco/workspace/easymo/scripts

export SUPABASE_URL="https://lhbowpbcpwoiparwnwgt.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcndud2d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDU1ODEyNywiZXhwIjoyMDc2MTM0MTI3fQ.mcL3A7LLsyo7Y45hnBXLAYCbp7FpEAfXVRrZoC4CWqc"

# Step 1: DRY RUN (preview only)
python3 gmaps_scraper_v2.py \
  "https://www.google.com/maps/search/pharmacy+kigali/@-1.967805,30.0514708,13z" \
  --category "pharmacy" \
  --city "Kigali" \
  --country "Rwanda" \
  --max-results 50 \
  --dry-run \
  --output dry_run_preview.json

# Step 2: Review results
cat dry_run_preview.json | jq '.[] | {name, address, phone, rating}'

# Step 3: If satisfied, run LIVE insert
python3 gmaps_scraper_v2.py \
  "https://www.google.com/maps/search/pharmacy+kigali/@-1.967805,30.0514708,13z" \
  --category "pharmacy" \
  --city "Kigali" \
  --country "Rwanda" \
  --max-results 100 \
  --headless \
  --output kigali_pharmacies_final.json
```

---

### Option 3: MAXIMUM RESULTS - Progressive Scraping

Scrape in batches to get ALL pharmacies:

```bash
cd /Users/jeanbosco/workspace/easymo/scripts

export SUPABASE_URL="https://lhbowpbcpwoiparwnwgt.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="..."

# Batch 1: First 100
python3 gmaps_scraper_v2.py \
  "https://www.google.com/maps/search/pharmacy+kigali/@-1.967805,30.0514708,13z" \
  --max-results 100 \
  --category "pharmacy" \
  --city "Kigali" \
  --headless

# Wait 2 minutes (avoid rate limiting)
sleep 120

# Batch 2: Wider area (zoom out)
python3 gmaps_scraper_v2.py \
  "https://www.google.com/maps/search/pharmacy+kigali/@-1.967805,30.0514708,12z" \
  --max-results 100 \
  --category "pharmacy" \
  --city "Kigali" \
  --headless

# Duplicates will be automatically filtered!
```

---

## 🔧 SCRAPER FEATURES FOR YOUR USE CASE

### ✅ What the Scraper Will Extract

For each pharmacy:

```json
{
  "name": "Kigali Pharmacy",
  "category": "pharmacy",
  "city": "Kigali",
  "address": "KN 4 Ave, Kigali, Rwanda",
  "country": "Rwanda",
  "phone": "+250788767816",
  "website": "https://example.com",
  "rating": 4.5,
  "review_count": 120,
  "lat": -1.9536,
  "lng": 30.0606,
  "external_id": "ChIJXYZ123...",
  "status": "active",
  "created_at": "2025-12-09T02:43:00Z"
}
```

### ✅ Phone Number Validation

**CRITICAL**: Scraper only inserts businesses with valid Rwanda phone numbers:

```python
# Line 286 in gmaps_scraper_v2.py
if business.get('phone') and business['phone'].startswith('+250') and len(business['phone']) == 13:
    businesses.append(business)  # ✅ Valid
else:
    print(f"⊘ Skipped {business['name']} (no phone)")  # ❌ Rejected
```

**Format Handling:**

- `0788 767 816` → `+250788767816` ✅
- `788 767 816` → `+250788767816` ✅
- `+250 788 767 816` → `+250788767816` ✅
- `No phone listed` → SKIPPED ❌

**Expected**: ~65-70% of scraped pharmacies will have phone numbers.

### ✅ Duplicate Prevention

**Algorithm** (Lines 313-318, 360-363):

```python
# Generate unique key from name + city + address
normalized_name = "kigali pharmacy".lower().replace(" ", "")
normalized_city = "kigali".lower()
normalized_address = "kn 4 ave kigali".lower()[:50]

key = hashlib.md5(f"{normalized_name}|{normalized_city}|{normalized_address}".encode()).hexdigest()
# key = "a1b2c3d4e5f6..."

if key in existing_keys:
    print(f"⊘ DUPLICATE: {business['name']}")
    continue  # Skip insertion
```

**This means:**

- Safe to run multiple times
- No manual cleanup needed
- Database stays clean

### ✅ Geolocation Extraction

**From URL coordinates:**

- Your URL center: `-1.967805, 30.0514708`
- Each business gets its own precise lat/lng from Google Maps
- Stored in `businesses.lat` and `businesses.lng` columns
- Used for `search_businesses_nearby()` RPC function

---

## 📊 EXPECTED RESULTS

### Scraping Metrics:

| Metric                     | Estimated Value                          |
| -------------------------- | ---------------------------------------- |
| **Total businesses found** | 80-120 pharmacies                        |
| **With phone numbers**     | 55-80 (65-70%)                           |
| **Duplicates filtered**    | 5-15 (if running after existing scrapes) |
| **Final inserts**          | 50-75 NEW pharmacies                     |
| **Scraping time**          | 10-15 minutes                            |

### Output Example:

```
=== Starting Google Maps Scraper ===
URL: https://www.google.com/maps/search/pharmacy+kigali/@-1.967805...
Category: pharmacy
City: Kigali
Max results: 100

Loading Google Maps...
  Scroll 1/5...
  Scroll 2/5...
  Scroll 3/5...
  Scroll 4/5...
  Scroll 5/5...

Found 92 potential businesses

Extracting details (1/92): Kigali Pharmacy...
  ✓ Name: Kigali Pharmacy
  ✓ Address: KN 4 Ave, Kigali
  ✓ Phone: +250788767816
  ✓ Rating: 4.5 (120 reviews)
  ✓ Coords: -1.9536, 30.0606

Extracting details (2/92): City Pharmacy...
  ✓ Name: City Pharmacy
  ⊘ Phone: None (SKIPPED - no phone number)

... (continues for all 92)

=== Scraped 68 pharmacies (with phones) ===

=== Updating Supabase ===
Loaded 15 existing pharmacies

  ✓ INSERTED: Kigali Pharmacy (ID: abc-123...)
  ⊘ DUPLICATE: Health Pharmacy (existing)
  ✓ INSERTED: Nyarutarama Pharmacy (ID: def-456...)
  ✓ INSERTED: Kimihurura Pharmacy (ID: ghi-789...)
  ...

=== Update Complete ===
Inserted: 53
Updated: 0
Skipped (duplicates): 15
Errors: 0

Results saved to: kigali_pharmacies_20251209.json
```

---

## ✅ VERIFICATION AFTER SCRAPING

### Check Database:

```sql
-- Total pharmacies
SELECT COUNT(*) FROM businesses WHERE category = 'pharmacy';

-- Recently added (last 24 hours)
SELECT name, phone, city, rating, created_at
FROM businesses
WHERE category = 'pharmacy'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Top rated pharmacies
SELECT name, rating, review_count, phone
FROM businesses
WHERE category = 'pharmacy'
  AND rating >= 4.0
ORDER BY rating DESC, review_count DESC
LIMIT 20;

-- Check for duplicates (should return 0)
SELECT name, COUNT(*) as count
FROM businesses
WHERE category = 'pharmacy'
GROUP BY name
HAVING COUNT(*) > 1;

-- Verify all have phones
SELECT COUNT(*) as with_phone
FROM businesses
WHERE category = 'pharmacy'
  AND phone IS NOT NULL
  AND phone LIKE '+250%';
```

### Test in WhatsApp:

1. Send message: "Find pharmacy near me"
2. Share your location (Kigali)
3. Should see list of nearby pharmacies
4. Verify phone numbers work (tap to call)

---

## 🎯 PRODUCTION-READY SCRIPT

Save this as `scripts/scrape_kigali_pharmacies.sh`:

```bash
#!/bin/bash
# Production Pharmacy Scraper for Kigali
# URL: https://www.google.com/maps/search/pharmacy+kigali/@-1.967805,30.0514708,13z

set -e

cd "$(dirname "$0")"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=== Kigali Pharmacy Scraper ===${NC}"
echo ""

# Check environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${YELLOW}Setting environment variables...${NC}"
    export SUPABASE_URL="https://lhbowpbcpwoiparwnwgt.supabase.co"
    export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcndud2d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDU1ODEyNywiZXhwIjoyMDc2MTM0MTI3fQ.mcL3A7LLsyo7Y45hnBXLAYCbp7FpEAfXVRrZoC4CWqc"
fi

# Check dependencies
if ! pip3 show selenium >/dev/null 2>&1; then
    echo -e "${RED}Error: selenium not installed${NC}"
    echo "Run: pip3 install -r requirements-scraper.txt"
    exit 1
fi

# Confirmation
echo -e "${YELLOW}This will scrape pharmacies from:${NC}"
echo "  https://www.google.com/maps/search/pharmacy+kigali/@-1.967805,30.0514708,13z"
echo ""
echo -e "${YELLOW}Settings:${NC}"
echo "  Category: pharmacy"
echo "  City: Kigali"
echo "  Country: Rwanda"
echo "  Max results: 100"
echo "  Mode: Headless (no browser window)"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# Run scraper
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="kigali_pharmacies_${TIMESTAMP}.json"

echo -e "${BLUE}Starting scrape...${NC}"
python3 gmaps_scraper_v2.py \
  "https://www.google.com/maps/search/pharmacy+kigali/@-1.967805,30.0514708,13z" \
  --category "pharmacy" \
  --city "Kigali" \
  --country "Rwanda" \
  --max-results 100 \
  --headless \
  --output "$OUTPUT_FILE"

echo ""
echo -e "${GREEN}=== SCRAPING COMPLETE ===${NC}"
echo ""
echo "Results saved to: $OUTPUT_FILE"
echo ""
echo "Verify in database:"
echo "  SELECT COUNT(*) FROM businesses WHERE category = 'pharmacy';"
echo ""
```

**Make it executable:**

```bash
chmod +x scripts/scrape_kigali_pharmacies.sh
```

**Run it:**

```bash
./scripts/scrape_kigali_pharmacies.sh
```

---

## 🔒 SAFETY FEATURES

### Built-in Safeguards:

1. **Dry-run mode** - Preview before inserting
2. **Duplicate prevention** - Hash-based checking
3. **Phone validation** - Only Rwanda numbers (+250)
4. **Error handling** - Continues on individual failures
5. **JSON export** - Always saves scraped data
6. **Logging** - Detailed progress output

### Rollback Plan:

If you need to remove scraped data:

```sql
-- Delete pharmacies added in last hour
DELETE FROM businesses
WHERE category = 'pharmacy'
  AND created_at > NOW() - INTERVAL '1 hour';

-- Or delete by specific timestamp
DELETE FROM businesses
WHERE category = 'pharmacy'
  AND created_at > '2025-12-09 02:00:00';
```

---

## 📞 QUICK REFERENCE

```bash
# Quick start (one command)
cd /Users/jeanbosco/workspace/easymo
./scripts/scrape_kigali_pharmacies.sh

# Or manual (with all options visible)
cd /Users/jeanbosco/workspace/easymo/scripts
export SUPABASE_URL="https://lhbowpbcpwoiparwnwgt.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbG..."
python3 gmaps_scraper_v2.py \
  "https://www.google.com/maps/search/pharmacy+kigali/@-1.967805,30.0514708,13z" \
  --category "pharmacy" \
  --city "Kigali" \
  --max-results 100 \
  --headless

# View results
cat kigali_pharmacies_*.json | jq '.[] | {name, phone, rating}'

# Verify in database
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM businesses WHERE category='pharmacy';"
```

---

## ✅ FINAL CHECKLIST

Before running:

- [ ] Python 3 installed (`python3 --version`)
- [ ] Dependencies installed (`pip3 install -r scripts/requirements-scraper.txt`)
- [ ] ChromeDriver available (auto-installed by webdriver-manager)
- [ ] Environment variables set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- [ ] Database `businesses` table exists
- [ ] Internet connection stable

After running:

- [ ] Check console output for errors
- [ ] Verify JSON file created
- [ ] Query database for count
- [ ] Test one pharmacy phone number
- [ ] Try WhatsApp search feature

---

**STATUS**: ✅ READY TO EXECUTE  
**ESTIMATED TIME**: 10-15 minutes  
**EXPECTED RESULTS**: 50-75 new pharmacies  
**RISK LEVEL**: LOW (duplicates prevented, dry-run available)

**EXECUTE NOW**: `./scripts/scrape_kigali_pharmacies.sh`
