# Unified Location Service

**Canonical location management for EasyMO - FULLY DYNAMIC**

## Purpose

Single source of truth for all location operations across the platform. 
**NO hardcoded source enums** - any service can use any string identifier.

## Key Features

✅ **Fully Dynamic** - Any service identifier works (no code changes needed)
✅ **Smart Caching** - Automatic with configurable TTL (default: 30 minutes)
✅ **Priority Resolution** - Cache → Preferred Saved → Any Saved → Prompt User
✅ **Multi-language Support** - English, French, Kinyarwanda
✅ **Context-Aware Prompts** - Dynamic messages based on service pattern
✅ **Single API** - One interface for all location needs

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  LocationService (Dynamic)                   │
│              No Hardcoded Enums - Any Source!                │
└─────────────────────────────────────────────────────────────┘
                     │                    │
          ┌──────────┴────────┐  ┌───────┴──────────┐
          ▼                   ▼  ▼                  ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐
│ saved_locations  │  │ recent_locations │  │  Resolution  │
│   (Favorites)    │  │     (Cache)      │  │   Strategy   │
│                  │  │                  │  │              │
│ • home           │  │ • TTL: 30min     │  │ 1. Cache     │
│ • work           │  │ • Auto-expire    │  │ 2. Preferred │
│ • school         │  │ • Source-aware   │  │ 3. Any Saved │
│ • ANY label      │  │ • ANY source     │  │ 4. Prompt    │
└──────────────────┘  └──────────────────┘  └──────────────┘
```

## Usage Examples

### WhatsApp Mobility Service

```typescript
import { LocationService } from "../_shared/location/index.ts";

const result = await LocationService.resolve(ctx.supabase, ctx.profileId, {
  source: 'mobility',
  preferredSavedLabel: 'home',
  cacheTTLMinutes: 30,
}, ctx.locale);

if (result.location) {
  // Use location for matching
  const drivers = await findNearbyDrivers(result.location.lat, result.location.lng);
} else if (result.needsPrompt) {
  // Prompt user with smart message
  await sendText(ctx.from, result.prompt.message);
}
```

### AI Agent (Jobs)

```typescript
import { LocationService } from "../_shared/location/index.ts";

const result = await LocationService.resolve(ctx.supabase, ctx.userId, {
  source: 'jobs_agent',
  preferredSavedLabel: 'home',  // Jobs typically search near home
  customPrompt: '📍 Share your location to find jobs near you.',
});
```

### NEW Service in 2025 - NO CODE CHANGES!

```typescript
import { LocationService } from "../_shared/location/index.ts";

// Pet adoption service that doesn't exist yet!
// NO changes to LocationService needed!
const result = await LocationService.resolve(ctx.supabase, ctx.profileId, {
  source: 'pet_adoption_service_2025',  // Any string works!
  cacheTTLMinutes: 60,
  searchRadiusMeters: 20000,
  customPrompt: '🐕 Share your location to find pets nearby!',
});
```

### Saving Locations

```typescript
// Save to cache (30-min TTL)
await LocationService.save(
  supabase,
  userId,
  { lat: -1.9536, lng: 30.0606 },
  'mobility',
  { action: 'pickup_request' },
  30  // TTL in minutes
);

// Save favorite location
await LocationService.saveFavorite(
  supabase,
  userId,
  'home',
  { lat: -1.9441, lng: 30.0619 },
  'Kigali Convention Centre',
  'My office building'
);
```

### Generic Nearby Search

```typescript
const result = await LocationService.findNearby<JobListing>(
  supabase,
  { lat: -1.9536, lng: 30.0606 },
  {
    tableName: 'jobs',
    radiusMeters: 15000,
    limit: 10,
    filters: { status: 'active' },
  }
);

console.log(`Found ${result.totalFound} jobs within ${result.radiusMeters/1000}km`);
```

## Migration from Legacy Systems

### From request-location.ts (WhatsApp workflows)

```typescript
// OLD - Hardcoded enum
import { requestLocationWithCache, type LocationSource } from "../_shared/wa-webhook-shared/locations/request-location.ts";
const result = await requestLocationWithCache(ctx, "mobility" as LocationSource);

// NEW - Dynamic string
import { LocationService } from "../_shared/location/index.ts";
const result = await LocationService.resolve(ctx.supabase, ctx.userId, {
  source: 'mobility',  // Any string works!
});
```

### From location-resolver.ts (AI agents)

```typescript
// OLD - Hardcoded LOCATION_PREFERENCES map
import { resolveUserLocation } from "../utils/location-resolver.ts";
const result = await resolveUserLocation(supabase, userId, {
  agentType: 'jobs_agent',
  intent: 'job_search'
});

// NEW - Dynamic config
import { LocationService } from "../../location/index.ts";
const result = await LocationService.resolve(supabase, userId, {
  source: 'jobs_agent',
  preferredSavedLabel: 'home',
});
```

## API Reference

### LocationService.resolve()

Main entry point for getting user location.

**Parameters:**
- `supabase: SupabaseClient` - Supabase client
- `userId: string` - User's profile ID
- `config: LocationConfig` - Configuration object
  - `source: string` - **Any string identifier** (NOT an enum!)
  - `cacheTTLMinutes?: number` - Cache TTL (default: 30)
  - `preferredSavedLabel?: string` - Preferred saved location
  - `autoUseCache?: boolean` - Auto-use valid cache (default: true)
  - `customPrompt?: string` - Custom prompt message
  - `context?: Record<string, unknown>` - Additional context
  - `searchRadiusMeters?: number` - Search radius
  - `required?: boolean` - Whether location is required
- `locale?: Locale` - User's locale (default: 'en')

**Returns:** `LocationResult`
- `location: { lat, lng } | null` - Resolved coordinates
- `needsPrompt: boolean` - Whether to prompt user
- `source: 'cache' | 'saved' | 'shared' | null` - Location source
- `ageMinutes?: number` - Cache age if from cache
- `label?: string` - Label if from saved location
- `prompt?: { message, buttons, hasRecentLocation }` - Prompt details

### LocationService.save()

Save location to cache with TTL.

**Parameters:**
- `supabase: SupabaseClient`
- `userId: string`
- `coords: { lat, lng }`
- `source: string` - **Any string identifier**
- `context?: Record<string, unknown>` - Additional context
- `ttlMinutes?: number` - Cache TTL (default: 30)

### LocationService.saveFavorite()

Save a favorite location (home, work, etc.).

**Parameters:**
- `supabase: SupabaseClient`
- `userId: string`
- `label: string` - **Any label** (home, work, school, custom)
- `coords: { lat, lng }`
- `address?: string`
- `notes?: string`

### LocationService.getFavorites()

Get all favorite locations for a user.

**Parameters:**
- `supabase: SupabaseClient`
- `userId: string`

**Returns:** `SavedLocation[]`

### LocationService.getLastLocation()

Get most recent location regardless of TTL (for "Use Last" button).

**Parameters:**
- `supabase: SupabaseClient`
- `userId: string`
- `source?: string` - Optional source filter

## Ground Rules Compliance

✅ **Observability** - All functions log with structured events  
✅ **Security** - Uses RLS-protected RPCs only  
✅ **No Hardcoding** - Fully dynamic, any service identifier works  
✅ **Consolidation** - Single service, no duplication  
✅ **Scalability** - Adding new services requires ZERO code changes

## Database Schema

**Tables:**
- `app.saved_locations` - Persistent favorites
- `app.recent_locations` - TTL-based cache

**RPCs:**
- `save_favorite_location()`
- `get_saved_location()`
- `list_saved_locations()`
- `save_recent_location()`
- `get_recent_location()`
- `has_recent_location()`

## Comparison: Old vs New

| Feature | Old (Fragmented) | New (Unified) |
|---------|------------------|---------------|
| Source Identifiers | Hardcoded enum (9 services) | Any string (unlimited) |
| Adding New Service | Code change required | Zero changes needed |
| Cache TTL | Inconsistent (5min, 30min, 24h) | Consistent (30min default) |
| Location Systems | 2 competing systems | Single service |
| AI Agent Integration | Separate resolver | Same service |
| Pattern Matching | Hardcoded LOCATION_PREFERENCES | Dynamic pattern matching |
| Scalability | NOT scalable | Fully scalable |

## Future Service Examples

These would work TODAY with ZERO code changes to LocationService:

```typescript
// Pet adoption service (2025)
LocationService.resolve(supabase, userId, { source: 'pet_adoption' });

// Food delivery (2026)
LocationService.resolve(supabase, userId, { source: 'food_delivery' });

// Event discovery (2027)
LocationService.resolve(supabase, userId, { source: 'events_nearby' });

// Healthcare finder (2028)
LocationService.resolve(supabase, userId, { source: 'healthcare_finder' });
```

## Testing

```bash
# Type checking
npx tsc --noEmit --project tsconfig.json

# Deno check (if available)
deno check supabase/functions/_shared/location/*.ts
```

## Support

For questions or issues:
1. Check this README
2. See examples in `location-service.ts`
3. Review deprecated files for migration patterns
