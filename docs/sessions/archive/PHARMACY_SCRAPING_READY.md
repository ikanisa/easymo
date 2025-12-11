# ✅ PHARMACY SCRAPING - READY TO EXECUTE

**Date**: 2025-12-09 02:27 UTC  
**Status**: ✅ Scraper deployed, ready to run  
**Your URLs**: 2 pharmacy search URLs provided

---

## 🎯 Quick Summary

**What**: Scrape pharmacies from Google Maps  
**Where**: Kigali area + Nyamata  
**How**: Use existing deployed scraper (`gmaps_scraper_v2.py`)  
**Output**: Insert to `businesses` table  
**Rules Applied**:

- ✅ Phone numbers required (+250XXXXXXXXX format)
- ✅ Duplicates prevented (name + city + address matching)
- ✅ Rwanda phone numbers only
- ✅ Active status set automatically

---

## ⚡ FASTEST WAY TO RUN (Copy & Paste)

```bash
cd /Users/jeanbosco/workspace/easymo
chmod +x scripts/scrape_pharmacies_quick.sh
./scripts/scrape_pharmacies_quick.sh
```

This script will:

1. Set environment variables ✓
2. Check dependencies ✓
3. Scrape Kigali pharmacies (50 max) ✓
4. Scrape Nyamata pharmacies (30 max) ✓

**Time**: ~10-15 minutes total

---

## 📋 What the Scraper Does

### Phone Number Validation (Line 286)

```python
if business.get('phone') and business['phone'].startswith('+250') and len(business['phone']) == 13:
    businesses.append(business)  # ✅ Valid Rwanda phone
else:
    print(f"⊘ Skipped {business['name']} (no phone)")  # ❌ Rejected
```

### Duplicate Prevention (Lines 313-318, 360-363)

```python
# Generate unique key from name + city + address
key = hashlib.md5(f"{name}|{city}|{address}".lower().encode()).hexdigest()

if key in existing_keys:
    print(f"⊘ DUPLICATE: {business['name']}")
    stats['duplicates'] += 1
    continue  # Skip insertion
```

### Phone Number Formatting (Lines 90-110)

```python
# Auto-converts:
"0788 767 816"   → "+250788767816"
"788 767 816"    → "+250788767816"
"+250788767816"  → "+250788767816"
```

---

## 📊 Expected Results

### Kigali Area

- **URL**: `https://www.google.com/maps/search/pharmacy/@-2.1664214,30.1197577,12.64z`
- **Expected**: 35-50 pharmacies with phones
- **Limit**: 50 max
- **Category**: pharmacy
- **City**: Kigali

### Nyamata

- **URL**: `https://www.google.com/maps/search/pharmacy+nyamata/@-2.1974495,30.1536074,12z`
- **Expected**: 20-30 pharmacies with phones
- **Limit**: 30 max
- **Category**: pharmacy
- **City**: Nyamata

### Total Expected

- **Scraped**: 70-80 pharmacies
- **With phones**: 55-70 (some won't have phone numbers listed)
- **Inserted**: 50-65 (after duplicate filtering)
- **Duplicates**: 5-10 (if any pharmacies appear in both searches)

---

## 🔍 Verification After Running

```bash
# Count pharmacies
psql "postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" \
  -c "SELECT COUNT(*) FROM businesses WHERE category = 'pharmacy';"

# View latest 10
psql "postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" \
  -c "SELECT name, phone, city FROM businesses WHERE category = 'pharmacy' ORDER BY created_at DESC LIMIT 10;"

# Check for duplicates (should return 0)
psql "postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" \
  -c "SELECT name, COUNT(*) FROM businesses WHERE category = 'pharmacy' GROUP BY name HAVING COUNT(*) > 1;"
```

---

## 🎬 Alternative: Manual Step-by-Step

If you prefer to run manually:

### Step 1: Set Environment

```bash
export SUPABASE_URL="https://lhbowpbcpwoiparwnwgt.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcndud2d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDU1ODEyNywiZXhwIjoyMDc2MTM0MTI3fQ.mcL3A7LLsyo7Y45hnBXLAYCbp7FpEAfXVRrZoC4CWqc"
```

### Step 2: Navigate to Scripts

```bash
cd /Users/jeanbosco/workspace/easymo/scripts
```

### Step 3: Run Scraper

```bash
# Kigali
python3 gmaps_scraper_v2.py \
  "https://www.google.com/maps/search/pharmacy/@-2.1664214,30.1197577,12.64z" \
  --category "pharmacy" \
  --city "Kigali" \
  --max-results 50 \
  --headless

# Nyamata
python3 gmaps_scraper_v2.py \
  "https://www.google.com/maps/search/pharmacy+nyamata/@-2.1974495,30.1536074,12z" \
  --category "pharmacy" \
  --city "Nyamata" \
  --max-results 30 \
  --headless
```

---

## 📄 Files Available

| File         | Location                             | Purpose                |
| ------------ | ------------------------------------ | ---------------------- |
| Main scraper | `scripts/gmaps_scraper_v2.py`        | Core scraping logic    |
| Quick script | `scripts/scrape_pharmacies_quick.sh` | One-command execution  |
| Full guide   | `PHARMACY_SCRAPING_PLAN.md`          | Complete documentation |
| This summary | `PHARMACY_SCRAPING_READY.md`         | Quick reference        |

---

## ✅ Scraper Features Verified

- [x] Phone number validation (Rwanda format)
- [x] Duplicate prevention (hash-based)
- [x] Category assignment (pharmacy)
- [x] City assignment (Kigali/Nyamata)
- [x] Headless mode (no browser window)
- [x] Status set to "active"
- [x] Geolocation extracted (lat/lng)
- [x] Source tracking ("Google Maps")

---

## 🚀 EXECUTE NOW

```bash
cd /Users/jeanbosco/workspace/easymo
./scripts/scrape_pharmacies_quick.sh
```

Or if you prefer to see the browser:

```bash
cd /Users/jeanbosco/workspace/easymo/scripts
python3 gmaps_scraper_v2.py \
  "https://www.google.com/maps/search/pharmacy/@-2.1664214,30.1197577,12.64z" \
  --category "pharmacy" \
  --max-results 50
  # Remove --headless to see browser
```

---

**STATUS**: ✅ Ready  
**TIME**: ~15 minutes  
**RISK**: Low (dry-run tested, duplicates prevented)

**Next**: Run the script and verify in database!
