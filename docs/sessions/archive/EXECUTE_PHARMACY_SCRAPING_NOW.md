# 🚀 READY TO EXECUTE - Pharmacy Scraping Summary

**Your URL**: `https://www.google.com/maps/search/pharmacy+kigali/@-1.967805,30.0514708,13z`  
**Status**: ✅ SCRIPT CREATED - READY TO RUN  
**Execution Time**: ~10-15 minutes  
**Expected Results**: 50-75 new pharmacies

---

## ⚡ QUICK START (3 Commands)

```bash
cd /Users/jeanbosco/workspace/easymo
chmod +x scripts/scrape_your_pharmacy_url.sh
./scripts/scrape_your_pharmacy_url.sh
```

**That's it!** The script will:

1. ✅ Set environment variables automatically
2. ✅ Check dependencies (install if missing)
3. ✅ Scrape your URL with optimal settings
4. ✅ Filter for Rwanda phone numbers only
5. ✅ Prevent duplicates automatically
6. ✅ Save results to JSON + insert to database

---

## 📊 What Will Happen

### Phase 1: Setup (30 seconds)

```
=== Kigali Pharmacy Scraper (YOUR URL) ===

Checking dependencies...
✓ Dependencies ready

Configuration:
  URL: https://www.google.com/maps/search/pharmacy+kigali/@-1.967805,30.0514708,13z
  Center: -1.967805, 30.0514708 (Central Kigali)
  Zoom: 13z (~10km radius)
  Category: pharmacy
  Max results: 100
  Mode: Headless

Continue? (y/n)
```

Press `y` and Enter

### Phase 2: Scraping (10-15 minutes)

```
Starting scrape...

============================================================
📍 Scraping: PHARMACY in Kigali, Rwanda
============================================================
URL: https://www.google.com/maps/search/pharmacy+kigali/@-1.967805,30.0514708,13z
Max results: 100

Loading Google Maps...
Loading more results...
  Scroll 1/5...
  Scroll 2/5...
  Scroll 3/5...
  Scroll 4/5...
  Scroll 5/5...

Finding businesses...
Found 92 businesses

  Processed 10/100 (with valid phone)...
  Processed 20/100 (with valid phone)...
  ⊘ Skipped Pharmacy XYZ (no phone)
  Processed 30/100 (with valid phone)...
  ...

✓ Scraped 68 businesses
```

### Phase 3: Database Update (1-2 minutes)

```
📤 Updating Supabase...
  Loaded 15 existing businesses

  ✓ INSERTED: Kigali Pharmacy (+250788123456)
  ⊘ DUPLICATE: Health Plus Pharmacy
  ✓ INSERTED: Nyarutarama Pharmacy (+250788234567)
  ✓ INSERTED: Kimihurura Pharmacy (+250788345678)
  ...

=== Update Complete ===
Inserted: 53
Duplicates: 15
Errors: 0
```

### Phase 4: Completion

```
=== SCRAPING COMPLETE ===

✓ Results saved to: kigali_pharmacies_20251209_024500.json

Verify in database:
  psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM businesses WHERE category='pharmacy';"

View results:
  cat kigali_pharmacies_20251209_024500.json | jq '.[] | {name, phone, rating}'
```

---

## 📋 Files Created

### 1. Execution Script

**Location**: `scripts/scrape_your_pharmacy_url.sh`  
**Purpose**: One-command scraping  
**Features**:

- Auto environment setup
- Dependency checking
- Progress display
- Error handling
- Result verification

### 2. Documentation

**Location**: `PHARMACY_SCRAPING_YOUR_URL.md`  
**Purpose**: Complete execution plan  
**Contents**:

- URL analysis
- Expected results
- Feature breakdown
- Verification steps
- Safety features

### 3. Output JSON (after running)

**Location**: `scripts/kigali_pharmacies_TIMESTAMP.json`  
**Purpose**: Scraped data backup  
**Format**:

```json
[
  {
    "name": "Kigali Pharmacy",
    "category": "pharmacy",
    "city": "Kigali",
    "country": "Rwanda",
    "address": "KN 4 Ave, Kigali",
    "phone": "+250788767816",
    "website": "https://example.com",
    "rating": 4.5,
    "review_count": 120,
    "lat": -1.9536,
    "lng": 30.0606,
    "external_id": "ChIJXYZ...",
    "source": "Google Maps",
    "scraped_at": "2025-12-09T02:45:00Z"
  }
]
```

---

## ✅ Safety Features

### 1. Phone Number Validation

```python
# Only Rwanda numbers: +250XXXXXXXXX (exactly 13 characters)
if phone.startswith('+250') and len(phone) == 13:
    ✅ VALID
else:
    ❌ REJECTED
```

**Auto-formatting:**

- `0788 767 816` → `+250788767816`
- `788 767 816` → `+250788767816`
- `+250788767816` → `+250788767816`

### 2. Duplicate Prevention

```python
# Hash of: name + city + address
key = "kigali pharmacy|kigali|kn 4 ave"
hash = "a1b2c3d4e5f6..."

if hash in existing_hashes:
    ⊘ SKIP (duplicate)
else:
    ✓ INSERT (new)
```

### 3. Error Handling

- Individual business failures don't stop scraper
- Continues to next business
- Logs all errors
- Final stats show success/failure counts

### 4. Dry-Run Available

```bash
# Test without inserting to database
python3 scripts/gmaps_scraper_v2.py \
  "YOUR_URL" \
  --dry-run \
  --output test.json

# Review
cat test.json | jq
```

---

## 🔍 Verification After Running

### Quick Checks:

```bash
# 1. Count pharmacies
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM businesses WHERE category='pharmacy';"

# 2. View latest 10
psql "$DATABASE_URL" -c "SELECT name, phone, rating FROM businesses WHERE category='pharmacy' ORDER BY created_at DESC LIMIT 10;"

# 3. Check duplicates (should be 0)
psql "$DATABASE_URL" -c "SELECT name, COUNT(*) FROM businesses WHERE category='pharmacy' GROUP BY name HAVING COUNT(*) > 1;"

# 4. Verify phone format
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM businesses WHERE category='pharmacy' AND phone LIKE '+250%' AND LENGTH(phone) = 13;"
```

### Test in WhatsApp:

1. Open WhatsApp
2. Message the bot: "Find pharmacy near me"
3. Share your location (Kigali)
4. Should see list of nearby pharmacies
5. Tap a phone number to call

---

## 📊 Expected Metrics

| Metric                       | Value                            |
| ---------------------------- | -------------------------------- |
| **URL Coverage**             | ~10km radius from central Kigali |
| **Total businesses found**   | 80-120 pharmacies                |
| **With valid phone numbers** | 55-80 (65-70%)                   |
| **Already in database**      | 5-15 (if ran before)             |
| **New inserts**              | 50-75                            |
| **Scraping time**            | 10-15 minutes                    |
| **Database update time**     | 1-2 minutes                      |

---

## 🎯 Alternative Options

### Option 1: See the Browser (Debug Mode)

Remove `--headless` to watch scraping:

```bash
cd /Users/jeanbosco/workspace/easymo/scripts
python3 gmaps_scraper_v2.py \
  "https://www.google.com/maps/search/pharmacy+kigali/@-1.967805,30.0514708,13z" \
  --category "pharmacy" \
  --city "Kigali" \
  --max-results 100
  # No --headless flag = browser visible
```

### Option 2: Dry Run First

Test without database insert:

```bash
cd /Users/jeanbosco/workspace/easymo/scripts
python3 gmaps_scraper_v2.py \
  "https://www.google.com/maps/search/pharmacy+kigali/@-1.967805,30.0514708,13z" \
  --category "pharmacy" \
  --city "Kigali" \
  --max-results 50 \
  --dry-run \
  --output preview.json

# Review
cat preview.json | jq '.[] | {name, phone, rating}'
```

### Option 3: Smaller Batch

Start with fewer results:

```bash
python3 gmaps_scraper_v2.py \
  "https://www.google.com/maps/search/pharmacy+kigali/@-1.967805,30.0514708,13z" \
  --category "pharmacy" \
  --max-results 25 \
  --headless
```

---

## 🛠️ Troubleshooting

### Issue: Dependencies not installed

```
Error: selenium not installed
```

**Fix:**

```bash
pip3 install -r scripts/requirements-scraper.txt
```

### Issue: ChromeDriver not found

```
Error: 'chromedriver' executable needs to be in PATH
```

**Fix:** Script auto-installs via webdriver-manager. Just ensure Python packages installed.

### Issue: No businesses found

```
Found 0 businesses
```

**Fix:**

- Check URL is correct
- Remove `--headless` to see browser
- Google may have changed HTML (contact for scraper update)

### Issue: All duplicates

```
Inserted: 0
Duplicates: 68
```

**This is normal!** Means pharmacies already in database. Script working correctly.

---

## 📚 Documentation

| Document                        | Purpose                         |
| ------------------------------- | ------------------------------- |
| `PHARMACY_SCRAPING_YOUR_URL.md` | Full execution plan (this URL)  |
| `GMAPS_SCRAPER_START_HERE.md`   | General scraper guide           |
| `scripts/README_SCRAPER.md`     | Technical documentation         |
| `PHARMACY_SCRAPING_READY.md`    | Previous pharmacy scraping plan |

---

## ✅ Pre-Flight Checklist

Before running:

- [ ] Python 3 installed (`python3 --version`)
- [ ] Git repo at `/Users/jeanbosco/workspace/easymo`
- [ ] Internet connection stable
- [ ] ~15 minutes available
- [ ] Database accessible

After running:

- [ ] Check console for errors
- [ ] Verify JSON file created
- [ ] Query database for count
- [ ] Test one pharmacy phone number
- [ ] Try WhatsApp "Find pharmacy near me"

---

## 🚀 EXECUTE NOW

```bash
cd /Users/jeanbosco/workspace/easymo
chmod +x scripts/scrape_your_pharmacy_url.sh
./scripts/scrape_your_pharmacy_url.sh
```

**Press `y` when prompted, then wait ~15 minutes.**

---

**Status**: ✅ READY  
**Risk**: LOW (duplicates prevented, phone validation active)  
**Reversible**: YES (can delete by timestamp)  
**Tested**: YES (scraper used successfully before)

**GO!** 🚀
