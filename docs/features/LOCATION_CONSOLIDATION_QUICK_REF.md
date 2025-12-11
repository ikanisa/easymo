# Location Consolidation - Quick Reference

**Status:** ✅ Complete | **Branch:** `feature/location-caching-and-mobility-deep-review`

---

## 📋 TL;DR

Unified location handling across EasyMO into **one canonical system**:

- **Favorites:** `public.saved_locations` (home/work/school/other)
- **Cache:** `public.recent_locations` (30min TTL)
- **API:** `location-service` module (type-safe, single import)

---

## 🚀 Quick Start

### 1. Apply Migration

```bash
cd /path/to/easymo
git checkout feature/location-caching-and-mobility-deep-review
git pull

# Apply to remote (requires DATABASE_URL)
supabase db push
```

### 2. Verify Deployment

```bash
export DATABASE_URL='postgresql://postgres.[PROJECT]:[PASSWORD]@...pooler.supabase.com:6543/postgres'
./scripts/verify-location-consolidation.sh
```

Expected:

```
✓ saved_locations table exists
✓ saved_locations.geog column exists
✓ RPC save_recent_location exists
...
Summary: 16 passed, 0 failed, 0 warnings
```

### 3. Use in Code

```typescript
import {
  cacheLocation,
  getCachedLocation,
  saveFavoriteLocation,
  getFavoriteLocation,
  resolveUserLocation,
} from "../_shared/location-service/index.ts";

// Cache recent location (30min TTL)
await cacheLocation(supabase, userId, { lat: -1.9536, lng: 30.0606 }, "mobility");

// Save favorite
await saveFavoriteLocation(supabase, userId, { lat, lng }, "home");

// Smart resolution (favorites > cache > null)
const resolved = await resolveUserLocation(supabase, userId);
if (resolved) {
  console.log("Found location:", resolved.location, "from", resolved.source);
}
```

---

## 📁 Files Changed

| File                                                                    | Purpose                        |
| ----------------------------------------------------------------------- | ------------------------------ |
| `supabase/migrations/20251209210000_location_schema_reconciliation.sql` | Idempotent schema verification |
| `supabase/functions/_shared/location-service/index.ts`                  | Canonical API (230 lines)      |
| `scripts/verify-location-consolidation.sh`                              | Automated checks               |
| `LOCATION_CONSOLIDATION_COMPLETE.md`                                    | Full documentation             |

---

## 🔍 Verification Commands

```bash
# Check migration applied
psql $DATABASE_URL -c "
  SELECT version, name
  FROM supabase_migrations.schema_migrations
  WHERE version = '20251209210000';
"

# Check RPC functions exist
psql $DATABASE_URL -c "
  SELECT proname
  FROM pg_proc
  WHERE proname IN (
    'save_recent_location',
    'get_recent_location',
    'save_favorite_location',
    'get_saved_location'
  );
"

# Check table row counts
psql $DATABASE_URL -c "
  SELECT 'saved_locations' AS table, COUNT(*) FROM public.saved_locations
  UNION ALL
  SELECT 'recent_locations', COUNT(*) FROM public.recent_locations;
"
```

---

## 🛠️ API Reference

### Types

```typescript
interface Location {
  lat: number;
  lng: number;
  address?: string;
}

type LocationKind = "home" | "work" | "school" | "other";
```

### Favorites (Persistent)

```typescript
// Save/update favorite
await saveFavoriteLocation(supabase, userId, location, "home", "My House");

// Get favorite by kind
const home = await getFavoriteLocation(supabase, userId, "home");

// List all favorites
const favorites = await listFavoriteLocations(supabase, userId);
```

### Cache (TTL)

```typescript
// Cache location (default 30min)
await cacheLocation(supabase, userId, location, "mobility", { trip_id: "123" }, 60);

// Get most recent cache
const cached = await getCachedLocation(supabase, userId);

// Check if cache exists
const hasCached = await hasCachedLocation(supabase, userId);
```

### Smart Resolution

```typescript
// Fallback logic: preferred favorite > home > cache > null
const resolved = await resolveUserLocation(supabase, userId, "work");

if (resolved) {
  switch (resolved.source) {
    case "favorite":
      console.log("Using saved favorite:", resolved.favoriteKind);
      break;
    case "cache":
      console.log("Using cached location");
      break;
  }
}
```

---

## 📊 Database Schema

### `public.saved_locations`

```sql
id           UUID PRIMARY KEY
user_id      UUID REFERENCES auth.users
lat          NUMERIC NOT NULL
lng          NUMERIC NOT NULL
geog         GEOGRAPHY(Point, 4326)  -- Auto-computed from lat/lng
kind         TEXT NOT NULL CHECK (kind IN ('home','work','school','other'))
label        TEXT
address      TEXT
created_at   TIMESTAMPTZ
updated_at   TIMESTAMPTZ
```

### `public.recent_locations`

```sql
id           UUID PRIMARY KEY
user_id      UUID REFERENCES auth.users
lat          NUMERIC NOT NULL
lng          NUMERIC NOT NULL
geog         GEOGRAPHY(Point, 4326)
source       TEXT  -- 'mobility', 'jobs', 'property', etc.
context      JSONB DEFAULT '{}'
captured_at  TIMESTAMPTZ
expires_at   TIMESTAMPTZ NOT NULL  -- Auto-cleanup trigger
```

---

## 🎯 Migration Guide for Consumers

### Before (Legacy Pattern)

```typescript
// ❌ Direct table access
const { data } = await supabase
  .from("whatsapp_users")
  .select("location_cache")
  .eq("user_id", userId)
  .single();
```

### After (Unified Service)

```typescript
// ✅ Use location-service
import { getCachedLocation } from "../_shared/location-service/index.ts";

const cached = await getCachedLocation(supabase, userId);
```

---

## 🐛 Troubleshooting

### Migration not applied?

```bash
# Check supabase is running
supabase status

# Check migration history
supabase db remote-log

# Manual apply
psql $DATABASE_URL < supabase/migrations/20251209210000_location_schema_reconciliation.sql
```

### RPC missing?

```sql
-- Ensure previous migration applied first
SELECT version FROM supabase_migrations.schema_migrations
WHERE version = '20251209180000';

-- If missing, apply it first
\i supabase/migrations/20251209180000_fix_location_caching_functions.sql
```

### Verification script fails?

```bash
# Ensure DATABASE_URL is set
echo $DATABASE_URL

# Check connectivity
psql $DATABASE_URL -c "SELECT 1"

# Run with verbose errors
bash -x scripts/verify-location-consolidation.sh
```

---

## 📚 Related Documentation

- **Full Implementation:** `LOCATION_CONSOLIDATION_COMPLETE.md`
- **Original Migration:** `supabase/migrations/20251209180000_fix_location_caching_functions.sql`
- **Service Module:** `supabase/functions/_shared/location-service/index.ts`

---

## ✅ Deployment Checklist

- [ ] Pull latest from `feature/location-caching-and-mobility-deep-review`
- [ ] Run `supabase db push` to apply migration
- [ ] Run `./scripts/verify-location-consolidation.sh` (all pass)
- [ ] Update consumer code to import from `location-service`
- [ ] Test end-to-end with real user
- [ ] Monitor logs for errors
- [ ] (Optional) Remove legacy `location_cache` column after migration

---

**Last Updated:** 2025-12-09  
**Author:** GitHub Copilot CLI
