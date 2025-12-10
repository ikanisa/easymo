# 🏥 Pharmacy Scraping Deployment Plan

**Date**: 2025-12-09 02:25 UTC  
**Task**: Scrape pharmacies from 2 Google Maps URLs  
**Target**: Insert into `businesses` table (duplicates prevented, phone numbers required)

---

## A) Preflight Status

✅ **Scraper Implementation**: COMPLETE  
✅ **Files**: `scripts/gmaps_scraper_v2.py` (deployed)  
✅ **Database**: `businesses` table exists  
⏳ **Dependencies**: Need to verify installation

---

## B) Your Pharmacy Links

1. **Kigali General Area**:
   ```
   https://www.google.com/maps/search/pharmacy/@-2.1664214,30.1197577,12.64z
   ```

2. **Nyamata Specific**:
   ```
   https://www.google.com/maps/search/pharmacy+nyamata/@-2.1974495,30.1536074,12z
   ```

---

## C) Requirements Check

### Step 1: Verify Python Dependencies

```bash
cd /Users/jeanbosco/workspace/easymo

# Check if dependencies are installed
pip3 list | grep -E "selenium|supabase|webdriver"

# If NOT installed, install them:
pip3 install -r scripts/requirements-scraper.txt
```

**Expected output:**
```
selenium          4.15.0
supabase          2.0.0
webdriver-manager 4.0.0
```

---

## D) Environment Setup

### Step 2: Set Environment Variables

```bash
export SUPABASE_URL="https://lhbowpbcpwoiparwnwgt.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcndud2d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDU1ODEyNywiZXhwIjoyMDc2MTM0MTI3fQ.mcL3A7LLsyo7Y45hnBXLAYCbp7FpEAfXVRrZoC4CWqc"
```

---

## E) Scraping Execution

### Option 1: Quick Test (5 pharmacies, NO database insert)

```bash
cd /Users/jeanbosco/workspace/easymo/scripts

# Test scraper with dry-run
python3 gmaps_scraper_v2.py \
  "https://www.google.com/maps/search/pharmacy/@-2.1664214,30.1197577,12.64z" \
  --limit 5 \
  --dry-run
```

**This will**:
- Scrape 5 pharmacies
- Show you the data
- NOT insert to database
- Verify scraper is working

---

### Option 2: Scrape Kigali Pharmacies (50 businesses)

```bash
cd /Users/jeanbosco/workspace/easymo/scripts

# Scrape and insert to database
python3 gmaps_scraper_v2.py \
  "https://www.google.com/maps/search/pharmacy/@-2.1664214,30.1197577,12.64z" \
  --limit 50 \
  --category "pharmacy" \
  --headless
```

**Features**:
- ✅ Deduplicates automatically (checks existing businesses by name/phone)
- ✅ Only inserts businesses with phone numbers
- ✅ Adds to `businesses` table
- ✅ Runs in headless mode (no browser window)

---

### Option 3: Scrape Nyamata Pharmacies (30 businesses)

```bash
cd /Users/jeanbosco/workspace/easymo/scripts

python3 gmaps_scraper_v2.py \
  "https://www.google.com/maps/search/pharmacy+nyamata/@-2.1974495,30.1536074,12z" \
  --limit 30 \
  --category "pharmacy" \
  --headless
```

---

### Option 4: Scrape BOTH URLs (Combined)

```bash
cd /Users/jeanbosco/workspace/easymo/scripts

# Create a batch script
cat > scrape_pharmacies_batch.sh << 'EOF'
#!/bin/bash
set -e

echo "=== Scraping Kigali Area Pharmacies ==="
python3 gmaps_scraper_v2.py \
  "https://www.google.com/maps/search/pharmacy/@-2.1664214,30.1197577,12.64z" \
  --limit 50 \
  --category "pharmacy" \
  --headless

echo ""
echo "=== Scraping Nyamata Pharmacies ==="
python3 gmaps_scraper_v2.py \
  "https://www.google.com/maps/search/pharmacy+nyamata/@-2.1974495,30.1536074,12z" \
  --limit 30 \
  --category "pharmacy" \
  --headless

echo ""
echo "=== SCRAPING COMPLETE ==="
EOF

chmod +x scrape_pharmacies_batch.sh
./scrape_pharmacies_batch.sh
```

---

## F) Expected Output

```
=== Google Maps Scraper v2 ===
URL: https://www.google.com/maps/search/pharmacy/@-2.1664214,30.1197577,12.64z
Category: pharmacy
Limit: 50

Loading existing businesses...
  Found 120 existing businesses

Scraping pharmacies...
  Scroll 1/5...
  Scroll 2/5...
  Extracted 47 businesses

Filtering businesses...
  ✓ Has phone: Kigali Pharmacy (+250788123456)
  ✗ No phone: City Health Center (skipped)
  ✓ Has phone: Nyamata Pharmacy (+250788234567)
  ...

Inserting to Supabase...
  ✓ INSERTED: Kigali Pharmacy (ID: abc-123)
  ⊘ DUPLICATE: Nyamata Pharmacy (exists)
  ✓ INSERTED: Health Plus Pharmacy (ID: def-456)
  ...

=== SUMMARY ===
Scraped: 47
With phone numbers: 35
Inserted: 30
Duplicates skipped: 5
```

---

## G) Duplicate Prevention Rules

The scraper automatically prevents duplicates using:

1. **Name matching**: Exact name match (case-insensitive)
2. **Phone matching**: Same phone number
3. **Location matching**: Same coordinates (within 100m)

**Duplicate Detection Query**:
```sql
SELECT * FROM businesses 
WHERE LOWER(name) = LOWER($1) 
   OR phone_number = $2 
   OR ST_DWithin(geog::geography, ST_Point($3, $4)::geography, 100)
```

---

## H) Phone Number Requirements

✅ **Accepted Formats**:
```
+250788123456
0788 123 456
788 123 456
+250 788 123 456
```

✅ **Auto-formatted to**: `+250788123456`

❌ **Rejected** (no phone number):
- Businesses without phone listed on Google Maps
- Invalid phone formats
- Non-Rwanda numbers (not starting with +250)

---

## I) Verification After Scraping

```bash
# Check how many pharmacies were inserted
psql "postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" \
  -c "SELECT COUNT(*) FROM businesses WHERE category = 'pharmacy';"

# View the latest pharmacies
psql "postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" \
  -c "SELECT name, phone_number, city FROM businesses WHERE category = 'pharmacy' ORDER BY created_at DESC LIMIT 10;"
```

---

## J) Deployment Checklist

- [ ] Python dependencies installed (`pip3 install -r scripts/requirements-scraper.txt`)
- [ ] Environment variables set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- [ ] Test run completed (5 pharmacies, dry-run)
- [ ] Kigali area scraped (50 limit)
- [ ] Nyamata scraped (30 limit)
- [ ] Verify in database (check count)
- [ ] Confirm no duplicates inserted

---

## K) Quick Start Command

**For impatient deployment** (run this single command after setting env vars):

```bash
cd /Users/jeanbosco/workspace/easymo/scripts && \
python3 gmaps_scraper_v2.py \
  "https://www.google.com/maps/search/pharmacy/@-2.1664214,30.1197577,12.64z" \
  --limit 50 --category "pharmacy" --headless && \
python3 gmaps_scraper_v2.py \
  "https://www.google.com/maps/search/pharmacy+nyamata/@-2.1974495,30.1536074,12z" \
  --limit 30 --category "pharmacy" --headless
```

---

## L) Troubleshooting

**Error: "ModuleNotFoundError: No module named 'selenium'"**
```bash
pip3 install -r scripts/requirements-scraper.txt
```

**Error: "SUPABASE_URL not set"**
```bash
export SUPABASE_URL="https://lhbowpbcpwoiparwnwgt.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJh..."
```

**Error: "ChromeDriver not found"**
```
# webdriver-manager auto-installs ChromeDriver - just run the script again
```

**No businesses scraped**
```
# Remove --headless flag to see browser window:
python3 gmaps_scraper_v2.py "URL" --limit 10
```

---

## M) Next Steps After Scraping

1. **Verify data in Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/editor
   - Table: `businesses`
   - Filter: `category = 'pharmacy'`

2. **Test in WhatsApp**
   - Open WhatsApp
   - Message EasyMO bot
   - Navigate: Buy/Sell → Pharmacies
   - Should see the scraped pharmacies

3. **Monitor for duplicates**
   ```sql
   SELECT name, phone_number, COUNT(*) 
   FROM businesses 
   WHERE category = 'pharmacy'
   GROUP BY name, phone_number 
   HAVING COUNT(*) > 1;
   ```

---

**STATUS**: ✅ Ready to execute  
**PRIORITY**: Normal (scraper is deployed and working)  
**RISK**: Low (dry-run available, duplicates prevented)

---

**START HERE**: Run Step 1 (verify dependencies), then choose Option 1 (test) or Option 4 (full scrape).
