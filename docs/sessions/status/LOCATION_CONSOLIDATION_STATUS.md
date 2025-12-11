# Location Consolidation - Implementation Complete

## ✅ Phase 1: Schema Reconciliation (COMPLETE)

### Migration Applied

- **File**: `supabase/migrations/20251209100000_location_schema_reconciliation.sql`
- **Status**: ✅ Ready to deploy
- **Changes**:
  - Enhanced `saved_locations` with `geog` column and `kind` field
  - Created `recent_locations` table with TTL-based caching
  - Implemented RLS policies for both tables
  - Added helper RPCs aligned with existing code patterns

### Canonical Tables

| Table                  | Purpose                                 | TTL            | Primary Use Case                |
| ---------------------- | --------------------------------------- | -------------- | ------------------------------- |
| `app.saved_locations`  | Persistent favorites (home, work, etc.) | None           | Long-term user preferences      |
| `app.recent_locations` | Temporary cache                         | 30 min default | Recent pickup/dropoff locations |

### RPCs Available

**Favorites (Persistent)**:

- `save_favorite_location(_user_id, _kind, _lat, _lng, _address, _label)`
- `get_saved_location(_user_id, _kind)`
- `list_saved_locations(_user_id)`

**Cache (TTL-based)**:

- `save_recent_location(_user_id, _lat, _lng, _source, _context, _ttl_minutes)`
- `get_recent_location(_user_id, _source, _max_age_minutes)`
- `has_recent_location(_user_id, _max_age_minutes)`

## 📦 Unified Location Service

### Module Path

```typescript
import {
  cacheLocation,
  getCachedLocation,
  hasCachedLocation,
  saveFavoriteLocation,
  getFavoriteLocation,
  listFavoriteLocations,
  resolveUserLocation,
  type Location,
  type SavedLocation,
  type RecentLocation,
  type LocationKind,
} from "../_shared/location-service/index.ts";
```

### Usage Examples

**Save a favorite (home)**:

```typescript
await saveFavoriteLocation(
  supabase,
  userId,
  { lat: -1.9403, lng: 30.0619, address: "KG 5 Ave, Kigali" },
  "home",
  "My Home"
);
```

**Cache recent pickup**:

```typescript
await cacheLocation(
  supabase,
  userId,
  { lat: -1.9536, lng: 30.0906, address: "Kigali Convention Centre" },
  "mobility",
  { ride_type: "pickup" },
  30 // TTL in minutes
);
```

**Smart resolution** (favorites → cache → null):

```typescript
const resolved = await resolveUserLocation(supabase, userId, "home");
if (resolved) {
  console.log(`Using ${resolved.source}: ${resolved.location.address}`);
} else {
  // Prompt user for location
}
```

## 🔧 Migration Status

### ✅ Completed

1. Schema reconciliation migration created
2. Unified location service (already exists, aligned with migration)
3. Bug fix in `resolveUserLocation` (line 203 typo)

### 🚧 Next Steps (Phase 2 - Data Migration)

1. Create data migration from `whatsapp_users.location_cache` to `recent_locations`
2. Audit edge functions using legacy location patterns
3. Update high-traffic consumers to use unified service

### 📋 Deprecated Patterns (Do NOT Use)

❌ **Direct table access**:

```typescript
// BAD
const { data } = await supabase.from("recent_locations").select("*").eq("user_id", userId);
```

✅ **Use RPCs instead**:

```typescript
// GOOD
const location = await getCachedLocation(supabase, userId);
```

❌ **Legacy `whatsapp_users.location_cache`**:

```typescript
// BAD - will be deprecated
await supabase.from("whatsapp_users").update({ location_cache: { lat, lng } }).eq("id", userId);
```

✅ **Use cache service**:

```typescript
// GOOD
await cacheLocation(supabase, userId, { lat, lng }, "whatsapp");
```

## 🎯 Deployment Checklist

- [x] Migration file created and aligned with existing code
- [x] Location service module verified and bug-fixed
- [ ] Run migration on remote database
- [ ] Verify RPCs exist via Supabase dashboard
- [ ] Test with real user data
- [ ] Update consuming edge functions (gradual rollout)

## 📊 Impact Assessment

### Tables Modified

- `app.saved_locations` - Enhanced (geog column, kind field)
- `app.recent_locations` - Created (new TTL cache)

### Breaking Changes

**None** - This is purely additive. Existing code continues to work.

### Performance Impact

- **Positive**: GIST indexes on geography columns enable fast proximity queries
- **Positive**: TTL-based expiration prevents unbounded growth
- **Minimal**: Additional table is lightweight (~50 bytes per cached location)

## 🔍 Verification Commands

```bash
# After deployment, verify tables exist
supabase db query "SELECT tablename FROM pg_tables WHERE schemaname = 'app' AND tablename LIKE '%location%'"

# Check RPCs
supabase db query "SELECT proname FROM pg_proc WHERE proname LIKE '%location%'"

# Verify RLS
supabase db query "SELECT tablename, policyname FROM pg_policies WHERE tablename IN ('saved_locations', 'recent_locations')"
```

## 📝 Notes

- Migration uses `IF NOT EXISTS` patterns - safe to re-run
- RPC parameters use `_` prefix to match existing codebase conventions
- Context field in `recent_locations` is JSONB for flexibility
- Default TTL is 30 minutes (configurable per call)
- Cleanup function `cleanup_expired_locations()` available for cron jobs

---

**Status**: ✅ Phase 1 Complete - Ready for Deployment **Next**: Deploy migration → Verify → Begin
Phase 2 (data migration)
