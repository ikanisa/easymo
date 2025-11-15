# Geolocation Implementation Summary

## Overview

This implementation adds comprehensive geolocation capabilities to the EasyMo platform, enabling
distance calculations for bars, businesses, drivers, passengers, and trips.

## Changes Made

### 1. Database Migration (20260114000000_add_geolocation_columns.sql)

#### Tables Updated:

- **`bars` table**: Added `latitude`, `longitude`, `geocoded_at`, `geocode_status` columns
- **`business` table**: Standardized coordinate columns, added `country`, `geocoded_at`,
  `geocode_status`
- **`driver_status` table**: Renamed `lat`/`lng` to `latitude`/`longitude` for consistency
- **`trips` table**: Renamed pickup/dropoff coordinates to use `latitude`/`longitude` naming

#### Functions Created:

- **`calculate_distance_km(lat1, lon1, lat2, lon2)`**: Haversine distance calculation
- **`nearby_bars(user_lat, user_lon, radius_km, limit)`**: Find bars within radius
- **`nearby_business(user_lat, user_lon, radius_km, category, limit)`**: Find businesses within
  radius
- **`nearby_drivers(user_lat, user_lon, vehicle_type, radius_km, limit)`**: Find available drivers

#### Views Created:

- **`geocoding_queue`**: Shows all records needing geocoding (bars + business)

### 2. Google Maps Geocoding Edge Function

**Location**: `supabase/functions/geocode-locations/index.ts`

**Features**:

- Geocodes addresses using Google Maps Geocoding API
- Processes bars and businesses in batches
- Fallback strategies for failed geocoding
- Rate limiting (100ms between requests)
- Status tracking (pending, success, failed)

**API Endpoint**:

```bash
POST /geocode-locations
{
  "table": "bars" | "business" | "all",
  "batch_size": 50,
  "force": false
}
```

### 3. Environment Configuration

**Added to .env files**:

```bash
GOOGLE_MAPS_API_KEY=AIzaSyB8B8N2scJAWMs05f-xGRVzQAb4MQIuNEU
```

**Files updated**:

- `workspace/easymo-/.env`
- `workspace/easymo-/supabase/.env`
- `workspace/easymo-/.env.example` (documentation)

### 4. Helper Scripts

**`scripts/geocode-data.sh`**: Automated geocoding script

- Deploys the Edge Function
- Invokes geocoding for specified tables
- Validates environment setup
- Provides status feedback

## Data Preparation

### Bars Table

- **Countries**: Malta, Rwanda
- **Locations**: Already have `location_text` and `city_area` fields
- **Strategy**: Use full address → fallback to city+name if needed

### Business Table

- **Countries**: Primarily Rwanda (Kigali)
- **Default country**: Set to 'Rwanda' for existing records
- **Strategy**: Use `location_text` or fallback to `name + country`

## Usage Instructions

### Step 1: Run Database Migration

```bash
cd workspace/easymo-
supabase db push
```

### Step 2: Deploy Geocoding Function

```bash
cd supabase
supabase functions deploy geocode-locations
```

### Step 3: Set Environment Variables

Ensure `GOOGLE_MAPS_API_KEY` is set in Supabase dashboard:

```bash
supabase secrets set GOOGLE_MAPS_API_KEY=AIzaSyB8B8N2scJAWMs05f-xGRVzQAb4MQIuNEU
```

### Step 4: Run Geocoding

**Option A: Using the script** (recommended):

```bash
./scripts/geocode-data.sh all 50        # Geocode all tables, 50 records per batch
./scripts/geocode-data.sh bars 20       # Geocode only bars, 20 per batch
./scripts/geocode-data.sh business 30   # Geocode only businesses
```

**Option B: Direct API call**:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/geocode-locations \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"table":"all","batch_size":50}'
```

**Option C: Supabase CLI**:

```bash
supabase functions invoke geocode-locations \
  --body '{"table":"all","batch_size":50}'
```

### Step 5: Verify Results

**Check geocoding queue**:

```sql
SELECT * FROM geocoding_queue;
```

**View geocoded bars**:

```sql
SELECT name, latitude, longitude, geocode_status, country, city_area
FROM bars
WHERE geocode_status = 'success'
ORDER BY name;
```

**View geocoded businesses**:

```sql
SELECT name, latitude, longitude, geocode_status, country, location_text
FROM business
WHERE geocode_status = 'success'
ORDER BY name;
```

**Check for failures**:

```sql
SELECT table_name, name, location_text, geocode_status
FROM geocoding_queue
WHERE geocode_status = 'failed';
```

## Distance Calculation Examples

### Find Nearby Bars

```sql
-- Find bars within 5km of a location in Kigali
SELECT * FROM nearby_bars(
  -1.9442,    -- Kigali latitude
  30.0619,    -- Kigali longitude
  5.0,        -- 5km radius
  20          -- limit to 20 results
);
```

### Find Nearby Businesses

```sql
-- Find restaurants within 3km
SELECT * FROM nearby_business(
  -1.9442,
  30.0619,
  3.0,
  'restaurant',  -- category filter
  10
);
```

### Find Available Drivers

```sql
-- Find moto drivers within 2km
SELECT * FROM nearby_drivers(
  -1.9442,
  30.0619,
  'moto',    -- vehicle type
  2.0,       -- 2km radius
  5          -- top 5 closest
);
```

### Calculate Distance Between Two Points

```sql
-- Distance between two bars
SELECT
  b1.name as bar1,
  b2.name as bar2,
  calculate_distance_km(
    b1.latitude, b1.longitude,
    b2.latitude, b2.longitude
  ) as distance_km
FROM bars b1, bars b2
WHERE b1.id != b2.id
  AND b1.latitude IS NOT NULL
  AND b2.latitude IS NOT NULL
LIMIT 10;
```

## Integration Points

### Mobile Apps

```typescript
// Example React Native / Expo integration
import { supabase } from "./supabase";

async function findNearbyBars(latitude: number, longitude: number) {
  const { data, error } = await supabase.rpc("nearby_bars", {
    user_lat: latitude,
    user_lon: longitude,
    radius_km: 5.0,
    _limit: 20,
  });

  return data;
}
```

### WhatsApp Bot Integration

The geocoding functions can be integrated into WhatsApp flows to:

- Show nearby bars when user requests them
- Find closest drivers for ride requests
- Suggest businesses based on user location

### Admin Dashboard

Display geocoded locations on maps:

- Bar locations map view
- Business directory with map
- Driver tracking and availability
- Trip routes visualization

## Monitoring & Maintenance

### Regular Geocoding

Set up a cron job or periodic task to geocode new entries:

```bash
# Run daily at 2 AM
0 2 * * * /path/to/scripts/geocode-data.sh all 100
```

### Handle Failed Geocoding

Manually review and update failed records:

```sql
-- Find failed records
SELECT * FROM geocoding_queue WHERE geocode_status = 'failed';

-- Manual update if you know coordinates
UPDATE bars
SET
  latitude = -1.9442,
  longitude = 30.0619,
  geocode_status = 'manual',
  geocoded_at = now()
WHERE id = 'bar-uuid-here';
```

### Google Maps API Quota

- Free tier: 40,000 requests/month
- Monitor usage in Google Cloud Console
- Current implementation: ~100 bars + ~50 businesses = 150 requests initial run
- Rate limit: 50 requests/second (we use 10/second with 100ms delay)

## Cost Estimation

**Google Maps Geocoding API Pricing**:

- $5.00 per 1,000 requests
- Free tier: $200 credit/month = 40,000 requests

**Estimated Usage**:

- Initial geocoding: ~150 records = $0.75
- New records: ~10/day = 300/month = $1.50/month
- Re-geocoding failures: ~50/month = $0.25/month

**Total**: ~$2.50/month (well within free tier)

## Security Considerations

1. **API Key Protection**:
   - Never commit API keys to git
   - Use Supabase secrets for Edge Functions
   - Restrict API key to geocoding only in Google Console

2. **Rate Limiting**:
   - Implemented 100ms delay between requests
   - Batch processing prevents quota exhaustion

3. **RLS Policies**:
   - Geocoding functions use service role
   - Public read access to latitude/longitude is safe
   - Write access controlled via existing RLS policies

## Troubleshooting

### Geocoding Fails

- Check Google Maps API key is valid
- Verify API key has Geocoding API enabled
- Check billing is enabled in Google Cloud Console
- Review address format (should be complete)

### Missing Coordinates

- Run geocoding again: `./scripts/geocode-data.sh all 50 true` (force=true)
- Check `geocoding_queue` view for pending items
- Manually verify address format in database

### Distance Calculations Inaccurate

- Verify coordinates are in WGS84 format (standard GPS)
- Check latitude/longitude aren't swapped
- Haversine formula assumes spherical earth (±0.5% error is normal)

## Next Steps

1. **Deploy Migration**: `supabase db push`
2. **Deploy Function**: `supabase functions deploy geocode-locations`
3. **Set API Key**: `supabase secrets set GOOGLE_MAPS_API_KEY=...`
4. **Run Geocoding**: `./scripts/geocode-data.sh all 50`
5. **Verify Results**: Check `geocoding_queue` view
6. **Integrate**: Use `nearby_*` functions in your app

## Files Created/Modified

### New Files:

- `supabase/migrations/20260114000000_add_geolocation_columns.sql`
- `supabase/functions/geocode-locations/index.ts`
- `scripts/geocode-data.sh`
- `GEOLOCATION_IMPLEMENTATION.md` (this file)

### Modified Files:

- `workspace/easymo-/.env` (added GOOGLE_MAPS_API_KEY)
- `workspace/easymo-/supabase/.env` (added GOOGLE_MAPS_API_KEY)
- `workspace/easymo-/.env.example` (documented API key)

## Support

For issues or questions:

1. Check migration was applied: `supabase migration list`
2. Verify function deployed: `supabase functions list`
3. Test geocoding: `supabase functions invoke geocode-locations --body '{}'`
4. Review logs: `supabase functions logs geocode-locations`
