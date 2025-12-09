# Location Service

**Canonical location management for EasyMO**

## Purpose

Unified interface for all location operations across the platform. Consolidates:
- **Favorites** (`saved_locations`) - Persistent user favorites (home, work, etc.)
- **Cache** (`recent_locations`) - TTL-based recent locations

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Location Service                          │
│                  (Single Source of Truth)                    │
└─────────────────────────────────────────────────────────────┘
                    │                    │
         ┌──────────┴────────┐  ┌───────┴──────────┐
         ▼                   ▼  ▼                  ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐
│ saved_locations  │  │ recent_locations │  │  Resolution  │
│   (Favorites)    │  │     (Cache)      │  │   Strategy   │
│                  │  │                  │  │              │
│ • home           │  │ • TTL: 24h       │  │ 1. Favorite  │
│ • work           │  │ • Auto-expire    │  │ 2. Cache     │
│ • school         │  │ • Context-aware  │  │ 3. Prompt    │
│ • other          │  │                  │  │              │
└──────────────────┘  └──────────────────┘  └──────────────┘
```

## Usage

### Save a favorite location

```typescript
import { saveFavoriteLocation } from "../_shared/location-service/index.ts";

await saveFavoriteLocation(
  supabase,
  userId,
  { lat: -1.9441, lng: 30.0619, address: "Kigali Convention Centre" },
  "work",
  "My Office"
);
```

### Get a favorite location

```typescript
import { getFavoriteLocation } from "../_shared/location-service/index.ts";

const home = await getFavoriteLocation(supabase, userId, "home");
if (home) {
  console.log(`Home: ${home.address} (${home.lat}, ${home.lng})`);
}
```

### Cache a recent location

```typescript
import { cacheLocation } from "../_shared/location-service/index.ts";

await cacheLocation(
  supabase,
  userId,
  { lat: -1.9535, lng: 30.0905 },
  "mobility",
  "pickup_location",
  24 // TTL hours
);
```

### Smart resolution (favorites → cache → prompt)

```typescript
import { resolveUserLocation } from "../_shared/location-service/index.ts";

const resolved = await resolveUserLocation(supabase, userId, "home");
if (resolved) {
  console.log(`Using ${resolved.source}: ${resolved.location.address}`);
} else {
  // Prompt user for location
}
```

## Migration from Legacy Systems

If you're currently using:

| Old Pattern | New Pattern |
|-------------|-------------|
| `whatsapp_users.location_cache` | `cacheLocation()` |
| Direct `saved_locations` insert | `saveFavoriteLocation()` |
| Direct `recent_locations` query | `getCachedLocation()` |
| Custom fallback logic | `resolveUserLocation()` |

## Ground Rules Compliance

✅ **Observability**: All functions log structured events  
✅ **Security**: Uses RLS-protected RPCs only  
✅ **Consolidation**: Single service, no duplication  
✅ **Feature Flags**: N/A (core infrastructure)

## Database Schema

Tables managed by this service:

- `app.saved_locations` - Persistent favorites
- `app.recent_locations` - TTL-based cache

RPCs provided:

- `save_favorite_location()`
- `get_saved_location()`
- `list_saved_locations()`
- `save_recent_location()`
- `get_recent_location()`
- `has_recent_location()`

See migration `20251210000000_location_schema_reconciliation.sql` for schema definition.
