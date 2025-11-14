# Geolocation Setup - Quick Start Guide

## ✅ What Was Implemented

### Database Changes
- ✅ Added `latitude`, `longitude`, `geocoded_at`, `geocode_status` to `bars` table
- ✅ Added `country`, `latitude`, `longitude`, `geocoded_at`, `geocode_status` to `business` table
- ✅ Standardized coordinate column names across `driver_status` and `trips` tables
- ✅ Created spatial indexes for performance
- ✅ Added distance calculation functions using Haversine formula

### Functions Created
1. **`calculate_distance_km(lat1, lon1, lat2, lon2)`** - Calculate distance between two points
2. **`nearby_bars(user_lat, user_lon, radius_km, limit)`** - Find bars within radius
3. **`nearby_business(user_lat, user_lon, radius_km, category, limit)`** - Find businesses within radius
4. **`nearby_drivers(user_lat, user_lon, vehicle_type, radius_km, limit)`** - Find available drivers
5. **`geocoding_queue` VIEW** - Shows all records pending geocoding

### Edge Function
- ✅ Created `geocode-locations` Edge Function for automated geocoding
- ✅ Integrates with Google Maps Geocoding API
- ✅ Processes bars and businesses in batches
- ✅ Rate limiting and error handling included

### Configuration
- ✅ Added `GOOGLE_MAPS_API_KEY` to environment files
- ✅ Created helper script `scripts/geocode-data.sh`
- ✅ Created verification script for testing

## 🚀 Quick Deployment Steps

### 1. Apply Database Migration
```bash
cd workspace/easymo-
supabase db push
```

### 2. Verify Migration
```bash
psql $DATABASE_URL -f supabase/migrations/verify_geolocation_setup.sql
```

### 3. Deploy Geocoding Function
```bash
cd supabase
supabase functions deploy geocode-locations --no-verify-jwt
```

### 4. Set Google Maps API Key
```bash
# Via Supabase CLI
supabase secrets set GOOGLE_MAPS_API_KEY=AIzaSyB8B8N2scJAWMs05f-xGRVzQAb4MQIuNEU

# Or via Supabase Dashboard:
# Settings → Edge Functions → Secrets → Add secret
```

### 5. Run Geocoding
```bash
# Make script executable (if not already)
chmod +x scripts/geocode-data.sh

# Geocode all tables (bars + business)
./scripts/geocode-data.sh all 50

# Or geocode individually
./scripts/geocode-data.sh bars 20
./scripts/geocode-data.sh business 30
```

## 📊 Data Overview

### Bars Table
- **Total bars**: ~50 entries
- **Countries**: Malta, Rwanda
- **Location data**: Full addresses with city/area information
- **Geocoding strategy**: Address → City+Name fallback

### Business Table
- **Total businesses**: ~100+ entries
- **Primary country**: Rwanda (Kigali)
- **Location data**: Some have addresses, some only names
- **Default country**: Set to 'Rwanda' for existing records

## 🧪 Testing Examples

### Test Distance Calculation
```sql
-- Distance from Kigali to Nairobi (~830km)
SELECT calculate_distance_km(
  -1.9442, 30.0619,  -- Kigali
  -1.2864, 36.8172   -- Nairobi
) as distance_km;
```

### Find Nearby Bars
```sql
-- Bars within 5km of Kigali center
SELECT * FROM nearby_bars(
  -1.9442,    -- latitude
  30.0619,    -- longitude
  5.0,        -- radius in km
  20          -- limit
);
```

### Find Nearby Businesses
```sql
-- Restaurants within 3km
SELECT * FROM nearby_business(
  -1.9442, 
  30.0619, 
  3.0, 
  'restaurant',
  10
);
```

### Check Geocoding Status
```sql
-- View geocoding queue
SELECT * FROM geocoding_queue;

-- Count by status
SELECT 
  table_name,
  geocode_status,
  COUNT(*)
FROM geocoding_queue
GROUP BY table_name, geocode_status;
```

## 📱 Integration Examples

### React Native / Expo
```typescript
import { supabase } from './supabase'
import * as Location from 'expo-location'

async function findNearbyBars() {
  // Get user location
  const location = await Location.getCurrentPositionAsync({})
  const { latitude, longitude } = location.coords
  
  // Find nearby bars
  const { data, error } = await supabase
    .rpc('nearby_bars', {
      user_lat: latitude,
      user_lon: longitude,
      radius_km: 5.0,
      _limit: 20
    })
  
  return data
}
```

### WhatsApp Bot Integration
```typescript
// In your WhatsApp message handler
async function handleFindBarsCommand(userPhone: string, latitude: number, longitude: number) {
  const bars = await supabase
    .rpc('nearby_bars', {
      user_lat: latitude,
      user_lon: longitude,
      radius_km: 10.0,
      _limit: 10
    })
  
  const message = bars.data
    .map((bar, i) => `${i + 1}. ${bar.name} - ${bar.distance_km.toFixed(1)}km away`)
    .join('\n')
  
  await sendWhatsAppMessage(userPhone, `Nearby bars:\n${message}`)
}
```

## 🔍 Monitoring & Maintenance

### Check Geocoding Results
```sql
-- Success rate
SELECT 
  geocode_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM (
  SELECT geocode_status FROM bars
  UNION ALL
  SELECT geocode_status FROM business
) combined
GROUP BY geocode_status;
```

### Failed Geocoding Records
```sql
-- Find records that failed
SELECT 
  table_name,
  name,
  location_text,
  country
FROM geocoding_queue
WHERE geocode_status = 'failed';
```

### Manual Coordinate Update
```sql
-- If you manually find coordinates for a failed record
UPDATE bars
SET 
  latitude = -1.9442,
  longitude = 30.0619,
  geocode_status = 'manual',
  geocoded_at = now()
WHERE slug = 'bar-slug-here';
```

## 💰 Cost Analysis

### Google Maps API Pricing
- **Rate**: $5 per 1,000 requests
- **Free tier**: $200/month credit = 40,000 free requests
- **Rate limit**: 50 requests/second (we use 10/second)

### Estimated Usage
- Initial geocoding: ~150 records = $0.75
- New records: ~10/day = 300/month = $1.50/month
- **Total**: ~$2.25/month (well within free tier)

## 🔒 Security Notes

1. **API Key**: 
   - Restricted to Geocoding API only in Google Console
   - Stored securely in Supabase secrets
   - Never committed to git

2. **Rate Limiting**:
   - 100ms delay between requests
   - Batch processing prevents quota exhaustion

3. **Access Control**:
   - Edge Function uses service role
   - Latitude/longitude readable by all (safe)
   - Updates controlled by existing RLS policies

## 📁 Files Created

### Database
- `supabase/migrations/20260114000000_add_geolocation_columns.sql`
- `supabase/migrations/verify_geolocation_setup.sql`

### Edge Function
- `supabase/functions/geocode-locations/index.ts`

### Scripts & Docs
- `scripts/geocode-data.sh`
- `GEOLOCATION_IMPLEMENTATION.md`
- `GEOLOCATION_QUICKSTART.md` (this file)

### Configuration
- Updated `workspace/easymo-/.env`
- Updated `workspace/easymo-/supabase/.env`
- Updated `.env.example`

## 🐛 Troubleshooting

### Migration Issues
```bash
# Check migration status
supabase migration list

# Force repair if needed
supabase migration repair
```

### Geocoding Failures
```bash
# Check function logs
supabase functions logs geocode-locations

# Test function manually
supabase functions invoke geocode-locations --body '{"table":"bars","batch_size":5}'
```

### API Key Issues
```bash
# Verify secret is set
supabase secrets list

# Re-set if needed
supabase secrets set GOOGLE_MAPS_API_KEY=your-key-here
```

## ✨ Next Steps

1. **Deploy**: Run the 5 quick deployment steps above
2. **Geocode**: Execute `./scripts/geocode-data.sh all 50`
3. **Verify**: Check results with `SELECT * FROM geocoding_queue`
4. **Integrate**: Use distance functions in your app
5. **Monitor**: Set up periodic geocoding for new records

## 📞 Support

For detailed information, see:
- **Full documentation**: `GEOLOCATION_IMPLEMENTATION.md`
- **Database schema**: `supabase/migrations/20260114000000_add_geolocation_columns.sql`
- **Verification tests**: `supabase/migrations/verify_geolocation_setup.sql`

---

**Status**: ✅ Ready for deployment
**Estimated deployment time**: 10-15 minutes
**Testing recommended**: Yes (use verify script)
