# FIX BUSINESSES DATABASE - COMPLETE GUIDE

## 🎯 What This Fixes

1. **Phone Numbers** - Format all to `+250XXXXXXXXX` (no spaces)
2. **owner_whatsapp** - Populate from formatted phone numbers
3. **Coordinates** - Geocode missing lat/lng using Google Maps API

---

## 🚀 OPTION 1: Quick SQL Fix (Recommended for phone numbers)

### Run in Supabase SQL Editor:

```sql
-- 1. Remove spaces/dashes from phone numbers
UPDATE businesses
SET phone = REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '.', '')
WHERE phone IS NOT NULL;

-- 2. Add +250 to numbers starting with 0
UPDATE businesses
SET phone = '+250' || SUBSTRING(phone FROM 2)
WHERE phone ~ '^0[0-9]{9}$' AND phone NOT LIKE '+250%';

-- 3. Add +250 to 9-digit numbers
UPDATE businesses
SET phone = '+250' || phone
WHERE phone ~ '^[782][0-9]{8}$' AND phone NOT LIKE '+250%';

-- 4. Populate owner_whatsapp
UPDATE businesses
SET owner_whatsapp = phone
WHERE phone LIKE '+250%' AND LENGTH(phone) = 13
  AND (owner_whatsapp IS NULL OR owner_whatsapp = '');

-- 5. Verify
SELECT COUNT(*) FROM businesses WHERE phone LIKE '+250%';
```

**Time:** 1-2 minutes  
**Fixes:** All phone formatting issues

---

## 🔧 OPTION 2: Python Script (For coordinates)

### Run this command:

```bash
cd /Users/jeanbosco/workspace/easymo/scripts
python3 fix_businesses_database.py
```

**What it does:**
- ✅ Fixes phone number formatting
- ✅ Populates owner_whatsapp column
- ✅ Geocodes missing lat/lng (up to 500 businesses)

**Time:** 5-15 minutes (depending on how many need geocoding)

---

## 📊 Check What Needs Fixing

### Run these queries in Supabase:

```sql
-- Businesses with bad phone formatting
SELECT COUNT(*) 
FROM businesses 
WHERE phone IS NOT NULL 
  AND (phone NOT LIKE '+250%' OR phone LIKE '% %');

-- Businesses missing owner_whatsapp
SELECT COUNT(*) 
FROM businesses 
WHERE phone IS NOT NULL 
  AND owner_whatsapp IS NULL;

-- Businesses missing coordinates
SELECT COUNT(*) 
FROM businesses 
WHERE (lat IS NULL OR lng IS NULL) 
  AND address IS NOT NULL;
```

---

## ✅ Verification After Fix

```sql
-- All should have +250 prefix and 13 characters
SELECT 
    COUNT(*) as total_valid,
    COUNT(CASE WHEN phone LIKE '+250%' AND LENGTH(phone) = 13 THEN 1 END) as formatted_correctly
FROM businesses
WHERE phone IS NOT NULL;

-- All with phone should have owner_whatsapp
SELECT 
    COUNT(*) as with_phone,
    COUNT(CASE WHEN owner_whatsapp IS NOT NULL THEN 1 END) as with_whatsapp
FROM businesses
WHERE phone IS NOT NULL;

-- Check coordinates coverage
SELECT 
    city,
    COUNT(*) as total,
    COUNT(CASE WHEN lat IS NOT NULL THEN 1 END) as with_coords,
    ROUND(100.0 * COUNT(CASE WHEN lat IS NOT NULL THEN 1 END) / COUNT(*), 1) as percent
FROM businesses
GROUP BY city;
```

---

## 🗺️ Geocoding Missing Coordinates

The Python script uses Google Geocoding API to find lat/lng for businesses missing coordinates.

**Limits:**
- Processes 500 businesses per run
- Has API rate limiting (0.2s delay between requests)
- Uses business address + city + "Rwanda"

**If you have many missing coordinates, run multiple times:**

```bash
# Run 1
python3 fix_businesses_database.py

# Wait a few minutes, then run again
python3 fix_businesses_database.py

# Repeat until all are geocoded
```

---

## 📝 Files Created

1. **`fix_businesses_database.py`** - Python script (phone + coords)
2. **`fix_businesses.sql`** - SQL script (phone only, faster)
3. **`FIX_BUSINESSES_GUIDE.md`** - This guide

---

## ⚡ Quick Start

### For phone numbers (FASTEST):

```sql
-- Copy the entire fix_businesses.sql file and run in Supabase SQL Editor
```

### For coordinates:

```bash
cd /Users/jeanbosco/workspace/easymo/scripts
python3 fix_businesses_database.py
```

---

## 🎯 Expected Results

After running the fixes:

✅ **Phone Numbers:**
- Format: `+250788767816`
- No spaces, dashes, or other characters
- All start with +250
- All exactly 13 characters

✅ **owner_whatsapp:**
- Populated with same value as phone
- Ready for WhatsApp integration

✅ **Coordinates:**
- lat/lng populated for all businesses with addresses
- Ready for "near me" searches

---

## 🔍 Sample Results

```sql
SELECT 
    name,
    phone,
    owner_whatsapp,
    lat,
    lng,
    city
FROM businesses
WHERE phone IS NOT NULL
LIMIT 5;
```

Expected output:
```
name                    | phone           | owner_whatsapp  | lat       | lng
------------------------|-----------------|-----------------|-----------|----------
ABC Electronics         | +250788767816   | +250788767816   | -1.9536   | 30.0606
XYZ Pharmacy           | +250788123456   | +250788123456   | -1.9445   | 30.0588
Best Salon             | +250788999888   | +250788999888   | -1.9501   | 30.0612
```

---

## 🚀 RUN NOW

**Option 1 (SQL - Fastest):**
1. Open Supabase SQL Editor
2. Copy contents of `fix_businesses.sql`
3. Click "Run"
4. Wait 1-2 minutes
5. Check results

**Option 2 (Python - Complete):**
```bash
cd /Users/jeanbosco/workspace/easymo/scripts && python3 fix_businesses_database.py
```

---

**All fixes will run automatically and show progress!** ✅
