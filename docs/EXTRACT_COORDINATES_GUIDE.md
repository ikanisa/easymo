# Extract Coordinates from Google Maps URLs - Guide

**Date**: November 13, 2025  
**API Key**: AIzaSyB8B8N2scJAWMs05f-xGRVzQAb4MQIuNEU  
**Purpose**: Extract latitude/longitude from Google Maps URLs and addresses in the businesses table

---

## 🎯 Overview

This guide provides two methods to extract coordinates:
1. **SQL Method** - Extract directly from Google Maps URLs (free, fast)
2. **API Method** - Geocode addresses using Google Maps API (paid, accurate)

---

## 📋 Prerequisites

### 1. Ensure google_maps_url Column Exists

Run this migration first:
```bash
# Via Supabase Dashboard SQL Editor
# Or via CLI:
supabase db push --linked
```

Migration: `supabase/migrations/20251113192300_add_google_maps_url_column.sql`

### 2. Populate Google Maps URLs (if available)

If you have Google Maps URLs for businesses, update them:
```sql
UPDATE businesses 
SET google_maps_url = 'https://maps.google.com/?q=-1.9536,30.0606'
WHERE id = 'business-id';
```

---

## 🚀 Method 1: SQL Extraction (Recommended First)

Extract coordinates directly from Google Maps URLs using SQL.

### Supported URL Formats:
- `https://maps.google.com/?q=-1.9536,30.0606`
- `https://www.google.com/maps/place/Name/@-1.9536,30.0606,17z`
- `https://goo.gl/maps/xxx/@-1.9536,30.0606`

### Execute:

**Option A: Via Supabase Dashboard**
1. Open: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/sql
2. Paste contents of: `extract_coordinates_from_urls.sql`
3. Click RUN

**Option B: Via psql**
```bash
psql "YOUR_DB_URL" -f extract_coordinates_from_urls.sql
```

### What It Does:
1. Analyzes current state of businesses table
2. Creates helper functions for coordinate extraction
3. Extracts coordinates from URLs using regex
4. Updates businesses table with coordinates
5. Shows summary of results

### Expected Output:
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

## 🔍 Method 2: API Geocoding (For Remaining Addresses)

Use Google Maps Geocoding API for businesses without coordinates.

### Setup:

1. **Install dependencies** (if not already installed):
```bash
cd /Users/jeanbosco/workspace/easymo-
npm install axios @supabase/supabase-js
```

2. **Set environment variables**:
```bash
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export NEXT_PUBLIC_SUPABASE_URL="https://lhbowpbcpwoiparwnwgt.supabase.co"
```

3. **Run the script**:
```bash
node scripts/extract_coordinates_with_api.js
```

### What It Does:
1. Fetches all businesses without coordinates
2. For each business:
   - Tries to extract from google_maps_url first
   - If no URL, geocodes the address using Google API
3. Updates database with found coordinates
4. Provides detailed progress and summary

### Expected Output:
```
╔════════════════════════════════════════════════════════════════════╗
║        EXTRACT COORDINATES FROM GOOGLE MAPS URLS                   ║
╚════════════════════════════════════════════════════════════════════╝

📊 Fetching businesses without coordinates...
✓ Found 25 businesses needing coordinates

📍 Processing: Restaurant Le Panorama
  🔍 Geocoding address: KN 5 Rd, Kigali, Rwanda
  ✓ Geocoded: -1.9536, 30.0606
  ✅ Updated database

...

═══════════════════════════════════════════════════════════════════
                           SUMMARY                                  
═══════════════════════════════════════════════════════════════════
✅ Successfully updated: 23
⚠️  Failed to geocode: 2
📊 Total processed: 25

📈 Database Status:
   Total businesses: 250
   With coordinates: 248
   Completion: 99.20%
```

---

## 🔍 Verification Queries

### Check Coordinate Coverage:
```sql
SELECT 
    COUNT(*) as total_businesses,
    COUNT(latitude) as has_coordinates,
    COUNT(*) - COUNT(latitude) as missing_coordinates,
    ROUND(100.0 * COUNT(latitude) / COUNT(*), 2) as completion_percentage
FROM businesses;
```

### List Businesses Without Coordinates:
```sql
SELECT 
    id,
    name,
    address,
    google_maps_url,
    latitude,
    longitude
FROM businesses
WHERE latitude IS NULL OR longitude IS NULL
ORDER BY name;
```

### Show Recently Updated:
```sql
SELECT 
    name,
    address,
    latitude,
    longitude,
    updated_at
FROM businesses
WHERE latitude IS NOT NULL
ORDER BY updated_at DESC
LIMIT 20;
```

### Validate Coordinate Ranges:
```sql
-- Check for invalid coordinates
SELECT 
    name,
    latitude,
    longitude
FROM businesses
WHERE latitude IS NOT NULL
  AND (
    latitude < -90 OR latitude > 90 OR
    longitude < -180 OR longitude > 180
  );
```

---

## 📊 Google Maps URL Formats

### Format 1: Direct Coordinates
```
https://maps.google.com/?q=-1.9536,30.0606
```
**Extraction**: Direct from `q=` parameter

### Format 2: Place URL with Coordinates
```
https://www.google.com/maps/place/Restaurant+Name/@-1.9536,30.0606,17z
```
**Extraction**: From `@lat,lng,zoom` format

### Format 3: Shortened URL
```
https://goo.gl/maps/abc123/@-1.9536,30.0606
```
**Extraction**: From `@lat,lng` after redirect

### Format 4: Address Only
```
https://www.google.com/maps/place/KN+5+Rd,+Kigali,+Rwanda
```
**Extraction**: Requires geocoding API

---

## ⚠️ API Rate Limits & Costs

### Google Maps Geocoding API:
- **Free tier**: $200 credit per month
- **Cost**: $5 per 1000 requests
- **Rate limit**: 50 requests per second
- **Script rate limit**: 5 requests per second (built-in delay)

### Estimations:
- 100 addresses: $0.50 (within free tier)
- 500 addresses: $2.50
- 1000 addresses: $5.00

**Recommendation**: Run SQL extraction first to minimize API costs!

---

## 🛠️ Troubleshooting

### Issue: "API Key Invalid"
**Solution**: Verify API key has Geocoding API enabled
```bash
# Check in Google Cloud Console:
# APIs & Services > Enabled APIs > Geocoding API
```

### Issue: "No coordinates found for address"
**Possible causes**:
- Address is too vague (e.g., just "Kigali")
- Address has typos
- Address doesn't exist in Google Maps

**Solution**: Manually update with correct address or coordinates

### Issue: "Rate limit exceeded"
**Solution**: Script has built-in rate limiting (200ms delay).
If still hitting limits, increase delay in script:
```javascript
await new Promise(resolve => setTimeout(resolve, 500)); // 500ms
```

### Issue: "Connection timeout"
**Solution**: Check internet connection and firewall settings

---

## 📁 Files Created

1. `extract_coordinates_from_urls.sql` - SQL extraction script
2. `scripts/extract_coordinates_with_api.js` - Node.js API geocoding script
3. `supabase/migrations/20251113192300_add_google_maps_url_column.sql` - Migration

---

## ✅ Execution Checklist

### Phase 1: SQL Extraction
- [ ] Run migration to add google_maps_url column
- [ ] Populate google_maps_url for businesses (if available)
- [ ] Run SQL extraction script
- [ ] Verify results with queries
- [ ] Note how many still need coordinates

### Phase 2: API Geocoding (if needed)
- [ ] Install Node.js dependencies
- [ ] Set environment variables
- [ ] Run API geocoding script
- [ ] Verify final results
- [ ] Check completion percentage

### Phase 3: Manual Cleanup (if needed)
- [ ] Review businesses that failed geocoding
- [ ] Manually update addresses or coordinates
- [ ] Re-run geocoding for fixed addresses

---

## 🎯 Quick Start

```bash
# 1. Add google_maps_url column
supabase db push --linked

# 2. Run SQL extraction
psql "YOUR_DB_URL" -f extract_coordinates_from_urls.sql

# 3. If needed, run API geocoding
export SUPABASE_SERVICE_ROLE_KEY="your-key"
node scripts/extract_coordinates_with_api.js

# 4. Verify
psql "YOUR_DB_URL" -c "
SELECT 
  COUNT(*) as total,
  COUNT(latitude) as with_coords,
  ROUND(100.0 * COUNT(latitude) / COUNT(*), 2) as percentage
FROM businesses;
"
```

---

## 📚 Additional Resources

- [Google Geocoding API Docs](https://developers.google.com/maps/documentation/geocoding)
- [API Key Management](https://console.cloud.google.com/apis/credentials)
- [Pricing Calculator](https://mapsplatform.google.com/pricing/)

---

**Ready to extract coordinates!** 🚀

Start with SQL extraction for free coordinate extraction from URLs, then use API geocoding for remaining addresses.
