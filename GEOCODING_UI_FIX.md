# Geocoding UI Fix - No More Raw Coordinates

## Issue
Users were seeing raw latitude/longitude coordinates throughout the interface:
- Recent searches: `"Moto taxi · -1.9536, 30.0606"`
- Saved locations: `"Home: -1.9441, 30.0619"`  
- Location displays showing coordinates instead of addresses

**This is terrible UX** - users think in terms of places/streets, not numbers.

## Solution
Use **reverse geocoding** to convert coordinates to human-readable addresses:

### Before
```
�� 2 hours ago
Moto taxi · -1.9536,30.0606
```

### After
```
📍 2 hours ago
Moto taxi · KN 3 Ave, Kigali
```

## Implementation

### 1. Recent Searches (Nearby Drivers/Passengers)
Added reverse geocoding using OpenStreetMap Nominatim API:

```typescript
const rows = await Promise.all(recentIntents.map(async (intent, i) => {
  // Try to get human-readable address
  let locationText = "";
  try {
    const geocoded = await reverseGeocode(intent.pickup_lat, intent.pickup_lng, { timeout: 2000 });
    if (geocoded) {
      locationText = geocoded.address || geocoded.city || "";
    }
  } catch (error) {
    console.warn("Failed to geocode recent search:", error);
  }
  
  // Never show raw coordinates to users
  const displayLocation = locationText || "Unknown location";
  
  return {
    id: `RECENT_SEARCH::${i}::${intent.pickup_lat},${intent.pickup_lng}`,
    title: `📍 ${when}`,
    description: `${intent.vehicle_type} · ${displayLocation}`,
  };
}));
```

### 2. Saved Locations (Favorites)
Changed fallback from coordinates to "Location saved":

```typescript
function favoriteToRow(ctx, favorite) {
  // Always use the address field if available (never show coordinates!)
  const description = favorite.address || "Location saved";
  return {
    id: `${SAVED_ROW_PREFIX}${favorite.id}`,
    title: `⭐ ${favorite.label}`,
    description,
  };
}
```

## Files Changed
1. `supabase/functions/wa-webhook-mobility/handlers/nearby.ts`
   - Added `reverseGeocode` import
   - Updated `showRecentSearches()` with async geocoding
   - Updated `favoriteToRow()` to remove coordinate fallback

2. `supabase/functions/wa-webhook/domains/mobility/nearby.ts`
   - Same changes as above for wa-webhook version

## How It Works
1. **Recent searches**: Async geocode each intent's coordinates in parallel
2. **Caching**: `reverseGeocode()` uses 7-day in-memory cache
3. **Fallback**: If geocoding fails → show "Unknown location" (not coordinates!)
4. **Saved locations**: Use existing `address` field, fallback to "Location saved"

## Benefits
✅ **User-friendly** - Shows actual street names/areas  
✅ **Fast** - Geocoding cached for 7 days  
✅ **Reliable** - Graceful fallback if API fails  
✅ **Free** - Uses OpenStreetMap (no API key needed)  
✅ **Professional** - No more technical coordinates visible  

## API Details
**Provider**: OpenStreetMap Nominatim  
**Endpoint**: `https://nominatim.openstreetmap.org/reverse`  
**Cache**: 7 days, ~1m precision (5 decimal places)  
**Timeout**: 2 seconds per request  
**Rate Limit**: 1 req/sec (handled by cache)  

## Testing
1. Search for nearby drivers → Save location
2. Search again → Check recent searches UI
3. Verify: Should show street name, NOT "-1.9536, 30.0606"
4. Check saved locations
5. Verify: Should show address or "Location saved"

## Future Improvements
Consider:
- Pre-geocoding when saving locations (async job)
- Storing geocoded addresses in `mobility_intents` table
- Using Google Places API for better address quality (requires API key)

## Deployment
```bash
supabase functions deploy wa-webhook-mobility --no-verify-jwt
supabase functions deploy wa-webhook --no-verify-jwt
```

**Status**: ✅ Deployed (2025-12-05)

## Principle
**NEVER show raw coordinates in user-facing UI** - always convert to human-readable addresses or use descriptive fallbacks like "Unknown location", "Location saved".
