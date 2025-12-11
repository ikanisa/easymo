# @easymo/location

**SINGLE SOURCE OF TRUTH** for all location-related operations across the EasyMO platform.

## ⚠️ IMPORTANT

**DO NOT hardcode location logic anywhere else!**

All services, edge functions, frontend apps, and AI agents MUST use this package for:
- Location validation
- Distance calculations
- Radius configuration
- Cache TTL management
- Coordinate normalization

## Installation

```bash
# In a pnpm workspace
pnpm add @easymo/location

# For edge functions (Deno)
import { LOCATION_CONFIG, validateCoordinates } from '@easymo/location';
```

## Usage

### Get Domain-Specific Configuration

```typescript
import { getSearchRadius, getCacheTTL, LOCATION_CONFIG } from '@easymo/location';

// Get search radius for a domain (automatically configured)
const radiusMeters = getSearchRadius('mobility');  // 10,000m (10km)
const radiusMeters = getSearchRadius('jobs');      // 50,000m (50km)
const radiusMeters = getSearchRadius('marketplace'); // 5,000m (5km)

// Get cache TTL for a domain
const ttlHours = getCacheTTL('mobility');        // 2 hours
const ttlHours = getCacheTTL('jobs');            // 168 hours (7 days)
const ttlHours = getCacheTTL('marketplace');     // 24 hours
```

### Validate Coordinates

```typescript
import { validateCoordinates, LocationValidationError } from '@easymo/location';

try {
  const coords = validateCoordinates({ lat: -1.9536, lng: 30.0606 });
  // coords = { lat: -1.9536, lng: 30.0606 }
} catch (error) {
  if (error instanceof LocationValidationError) {
    console.error(`Invalid ${error.field}: ${error.value}`);
  }
}
```

### Calculate Distance

```typescript
import { calculateDistance, formatDistance } from '@easymo/location';

const distance = calculateDistance(
  { lat: -1.9536, lng: 30.0606 },  // Kigali
  { lat: -1.9703, lng: 30.1044 }   // Nearby location
);
// distance = 4.2 (km)

const formatted = formatDistance(distance);
// formatted = "4.2km"
```

### Create PostGIS Points

```typescript
import { makePostGISPoint } from '@easymo/location';

const point = makePostGISPoint({ lat: -1.9536, lng: 30.0606 });
// point = "ST_SetSRID(ST_MakePoint(30.0606, -1.9536), 4326)::geography"

// Use in SQL queries
const query = `
  SELECT * FROM businesses
  WHERE ST_DWithin(
    location_geog,
    ${point},
    ${LOCATION_CONFIG.MARKETPLACE_RADIUS_METERS}
  )
`;
```

### Normalize Location Formats

```typescript
import { normalizeLocation } from '@easymo/location';

// Handles various formats
const coords1 = normalizeLocation({ lat: -1.9536, lng: 30.0606 });
const coords2 = normalizeLocation({ latitude: -1.9536, longitude: 30.0606 });
const coords3 = normalizeLocation({ x: 30.0606, y: -1.9536 });

// All return: { lat: -1.9536, lng: 30.0606 }
```

## Configuration

All configuration is in `LOCATION_CONFIG`:

```typescript
export const LOCATION_CONFIG = {
  // Domain-specific radius (meters)
  MOBILITY_RADIUS_METERS: 10000,      // 10km
  JOBS_RADIUS_METERS: 50000,          // 50km
  REAL_ESTATE_RADIUS_METERS: 10000,   // 10km
  MARKETPLACE_RADIUS_METERS: 5000,    // 5km
  DEFAULT_SEARCH_RADIUS_METERS: 15000, // 15km
  
  // Domain-specific cache TTL (hours)
  MOBILITY_CACHE_TTL_HOURS: 2,
  JOBS_CACHE_TTL_HOURS: 168,          // 7 days
  REAL_ESTATE_CACHE_TTL_HOURS: 168,   // 7 days
  MARKETPLACE_CACHE_TTL_HOURS: 24,
  
  // ... more configuration
};
```

## API Reference

### Functions

- `validateCoordinates(coords)` - Validate and normalize coordinates
- `normalizeLocation(location)` - Handle various coordinate formats
- `getSearchRadius(context)` - Get domain-specific search radius
- `getCacheTTL(context)` - Get domain-specific cache TTL
- `calculateDistance(from, to)` - Calculate distance between two points (km)
- `formatDistance(distanceKm)` - Format distance for display
- `isWithinRadius(center, point, radiusKm)` - Check if point is within radius
- `makePostGISPoint(coords)` - Create PostGIS geography point SQL
- `getLocationCacheKey(userId, context)` - Get standardized cache key
- `isLocationFresh(timestamp, threshold?)` - Check if location is fresh
- `normalizeRadius(params)` - Convert radiusKm/radiusMeters to meters

### Types

- `LocationContext` - 'mobility' | 'jobs' | 'real_estate' | 'marketplace' | 'general'
- `LocationSource` - 'user_input' | 'gps' | 'map_pin' | 'whatsapp' | 'imported' | 'geocoded'
- `Coordinates` - { lat: number; lng: number }
- `Location` - Coordinates & { address?: string }
- `CachedLocation` - Location with cache metadata
- `ProximitySearchParams` - Search parameters
- `ProximityResult<T>` - Search result with distance

## Examples

### Microservice (NestJS)

```typescript
import { LOCATION_CONFIG, validateCoordinates, getSearchRadius } from '@easymo/location';

@Injectable()
export class LocationService {
  async findNearbyDrivers(userLat: number, userLng: number) {
    const coords = validateCoordinates({ lat: userLat, lng: userLng });
    const radiusMeters = getSearchRadius('mobility');
    
    return this.databaseService.query(`
      SELECT * FROM drivers
      WHERE ST_DWithin(
        location_geog,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3
      )
    `, [coords.lng, coords.lat, radiusMeters]);
  }
}
```

### Edge Function (Deno)

```typescript
import { LOCATION_CONFIG, validateCoordinates, getCacheTTL } from '@easymo/location';

export async function cacheUserLocation(userId: string, lat: number, lng: number) {
  const coords = validateCoordinates({ lat, lng });
  const ttlHours = getCacheTTL('mobility');
  
  await supabase.rpc('cache_user_location', {
    p_user_id: userId,
    p_lat: coords.lat,
    p_lng: coords.lng,
    p_context: 'mobility',
    p_ttl_hours: ttlHours,
  });
}
```

### Frontend (React)

```typescript
import { validateCoordinates, formatDistance, calculateDistance } from '@easymo/location';

function DistanceDisplay({ from, to }) {
  try {
    const distance = calculateDistance(from, to);
    return <span>{formatDistance(distance)}</span>;
  } catch (error) {
    return <span>Invalid location</span>;
  }
}
```

## Migration Guide

### Before (❌ Don't do this)

```typescript
// Hardcoded values scattered everywhere
const RADIUS = 10000;
const CACHE_TTL = 2;

// Manual validation
if (lat < -90 || lat > 90) throw new Error('Invalid');

// Manual distance calculation
const distance = 6371 * acos(...); // Haversine formula copied everywhere
```

### After (✅ Do this)

```typescript
import { 
  getSearchRadius, 
  getCacheTTL, 
  validateCoordinates, 
  calculateDistance 
} from '@easymo/location';

const radiusMeters = getSearchRadius('mobility');
const ttlHours = getCacheTTL('mobility');
const coords = validateCoordinates({ lat, lng });
const distance = calculateDistance(from, to);
```

## Why This Package?

### Problems Solved

1. **Inconsistent Configuration** - Hardcoded values (10000, 15000, 5000) scattered across codebase
2. **Duplicate Logic** - Haversine formula copied 12+ times
3. **No Validation** - Coordinates accepted without validation
4. **Hard to Scale** - Changing radius requires updating multiple files
5. **Type Safety** - No shared types for location data

### Benefits

- ✅ **Single Source of Truth** - One place to configure all location logic
- ✅ **Type Safe** - TypeScript interfaces for all location data
- ✅ **Validated** - Automatic coordinate validation
- ✅ **Consistent** - Same logic across all services
- ✅ **Maintainable** - Change configuration in one place
- ✅ **Scalable** - Easy to add new domains or adjust values

## Support

For questions or issues:
- See [Location Implementation Guide](../../docs/LOCATION_IMPLEMENTATION_GUIDE.md)
- See [Location Audit Report](../../docs/LOCATION_AUDIT_REPORT.md)
- Contact: EasyMO Platform Team

## License

UNLICENSED - Internal use only
