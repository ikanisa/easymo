# Phase 1: SQL Coordinate Extraction - Execution Guide

**Date**: November 13, 2025  
**Cost**: $0.00 (FREE)  
**Time**: ~30 seconds  
**Risk**: ZERO (read-only extraction)

---

## 🎯 What This Does

Extracts latitude/longitude coordinates directly from Google Maps URLs in the businesses table.

### Supported URL Formats:

- `https://maps.google.com/?q=-1.9536,30.0606`
- `https://www.google.com/maps/place/Name/@-1.9536,30.0606,17z`
- `https://goo.gl/maps/xxx/@-1.9536,30.0606`

---

## 🚀 Execution Steps

### Step 1: Open Supabase Dashboard

Navigate to:

```
https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/sql
```

### Step 2: Create New Query

- Click "New query" button

### Step 3: Copy SQL Script

Copy the contents of **ONE** of these files:

**Option A (Recommended)**: Combined script

```
/tmp/phase1_complete_extraction.sql
```

This includes migration + extraction in one file.

**Option B**: Separate files

1. First run: `supabase/migrations/20251113192300_add_google_maps_url_column.sql`
2. Then run: `extract_coordinates_from_urls.sql`

### Step 4: Paste & Execute

- Paste the SQL into the editor
- Click "RUN" button
- Wait ~30 seconds

### Step 5: Review Results

Look for output sections:

```
=== ANALYZING BUSINESS TABLE ===
total_businesses: 250
has_latitude: 180
missing_latitude: 70

=== EXTRACTING COORDINATES FROM URLS ===
UPDATE 45

=== EXTRACTION RESULTS ===
has_latitude: 225
still_missing: 25
completion_percentage: 90.00
```

---

## 📊 Expected Output

### If Successful:

```
✓ Helper functions created
✓ Extracted coordinates from URLs
UPDATE 45 (or similar number)

PHASE 1 COMPLETE
total_businesses: 250
businesses_with_coordinates: 225
businesses_missing_coordinates: 25
completion_percentage: 90.00%
```

### What Each Number Means:

- **total_businesses**: Total records in businesses table
- **businesses_with_coordinates**: Now have latitude & longitude
- **businesses_missing_coordinates**: Still need coordinates (for Phase 2)
- **completion_percentage**: Coverage after extraction

---

## 🔍 Verification Queries

After execution, run these to verify:

### Check Coverage:

```sql
SELECT
    COUNT(*) as total,
    COUNT(latitude) as with_coords,
    COUNT(*) - COUNT(latitude) as missing,
    ROUND(100.0 * COUNT(latitude) / COUNT(*), 2) as percentage
FROM businesses;
```

### List Businesses Updated:

```sql
SELECT
    name,
    address,
    latitude,
    longitude,
    updated_at
FROM businesses
WHERE latitude IS NOT NULL
  AND updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC
LIMIT 20;
```

### List Still Missing:

```sql
SELECT
    id,
    name,
    address,
    google_maps_url
FROM businesses
WHERE latitude IS NULL OR longitude IS NULL
ORDER BY name;
```

---

## ⚠️ Troubleshooting

### Issue: "Column already exists"

**Cause**: google_maps_url column already added **Solution**: This is fine! Script uses IF NOT
EXISTS. Continue.

### Issue: "Function already exists"

**Cause**: Helper functions already created **Solution**: This is fine! Script uses OR REPLACE.
Continue.

### Issue: "UPDATE 0"

**Cause**: No businesses have google_maps_url with coordinates **Options**:

1. Add google_maps_url data to businesses table first
2. Skip to Phase 2 (API Geocoding) for address-based extraction

### Issue: "Permission denied"

**Cause**: Insufficient database permissions **Solution**: Ensure you're logged in with
admin/service role access

---

## 📈 What Happens Next

### If Completion ≥ 90%:

✅ Great! Most businesses have coordinates.

- Manually update remaining ones, or
- Use Phase 2 for the rest (minimal API cost)

### If Completion < 90%:

⚠️ Many businesses still need coordinates.

- Check if google_maps_url data exists
- If not, proceed to Phase 2 (API Geocoding)
- Or manually add google_maps_url data

---

## 💡 Tips for Better Results

### Before Running:

1. **Populate google_maps_url** if you have the data:

```sql
UPDATE businesses
SET google_maps_url = 'https://maps.google.com/?q=-1.9536,30.0606'
WHERE id = 'your-business-id';
```

2. **Check existing data**:

```sql
SELECT
    COUNT(*) as total,
    COUNT(google_maps_url) as has_url,
    COUNT(CASE WHEN google_maps_url ~ '@(-?\d+\.?\d*),(-?\d+\.?\d*)' THEN 1 END) as url_has_coords
FROM businesses;
```

### After Running:

1. Review businesses that still need coordinates
2. Decide: Manual update vs Phase 2 API geocoding
3. Estimate API costs if needed (see main guide)

---

## 📋 Execution Checklist

- [ ] Opened Supabase Dashboard SQL Editor
- [ ] Copied Phase 1 SQL script
- [ ] Pasted into editor
- [ ] Clicked RUN
- [ ] Reviewed output
- [ ] Noted completion percentage
- [ ] Ran verification queries
- [ ] Decided next steps

---

## 🎯 Next Steps

### After Phase 1 Completes:

**If 100% complete**: ✅ Done! All businesses have coordinates.

**If 90-99% complete**:

- Review missing businesses
- Manually update a few, or
- Run Phase 2 for low cost

**If < 90% complete**:

- Proceed to Phase 2: API Geocoding
- See: `docs/EXTRACT_COORDINATES_GUIDE.md`
- Run: `node scripts/extract_coordinates_with_api.js`

---

## 📁 File Locations

All files in: `/Users/jeanbosco/workspace/easymo-/`

- **Combined Script**: `/tmp/phase1_complete_extraction.sql`
- **Migration Only**: `supabase/migrations/20251113192300_add_google_maps_url_column.sql`
- **Extraction Only**: `extract_coordinates_from_urls.sql`
- **Complete Guide**: `docs/EXTRACT_COORDINATES_GUIDE.md`

---

**Ready to execute Phase 1!** 🚀

Open Supabase Dashboard and run the SQL script now.
