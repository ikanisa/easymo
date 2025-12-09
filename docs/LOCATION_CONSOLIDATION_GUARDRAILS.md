# Location Consolidation Guardrails (CRITICAL)

**Status**: 🔒 ENFORCED  
**Applies to**: All location-related code in EasyMO  
**Last Updated**: 2025-12-09

---

## 🚨 Critical Rules (Non-Negotiable)

### 1. NEVER Access Location Tables Directly

❌ **FORBIDDEN**:
```typescript
// DO NOT DO THIS
const { data } = await supabase
  .from("recent_locations")
  .select("*")
  .eq("user_id", userId);
```

✅ **REQUIRED**:
```typescript
// DO THIS INSTEAD
import { getCachedLocation } from "../_shared/location-service/index.ts";
const location = await getCachedLocation(supabase, userId);
```

**Why**: Direct table access bypasses:
- Type safety
- Observability logging
- Business logic (TTL checks, favorites cascade)
- Future schema changes

---

### 2. Use Correct Table for Purpose

| Purpose | Table | Service Function | TTL |
|---------|-------|------------------|-----|
| User's home address | `saved_locations` | `saveFavoriteLocation(..., "home")` | ∞ (persistent) |
| User's work address | `saved_locations` | `saveFavoriteLocation(..., "work")` | ∞ (persistent) |
| Last searched location | `recent_locations` | `cacheLocation(...)` | 24h default |
| Temporary ride pickup | `recent_locations` | `cacheLocation(...)` | 24h default |

**Rule**: If it's a **named favorite**, use `saved_locations`. If it's **temporary**, use `recent_locations`.

---

### 3. Always Use RPCs (Never Raw SQL in Edge Functions)

❌ **FORBIDDEN**:
```typescript
// DO NOT DO THIS
await supabase.rpc("execute_sql", {
  query: `INSERT INTO app.recent_locations (user_id, lat, lng) VALUES ($1, $2, $3)`,
  params: [userId, lat, lng]
});
```

✅ **REQUIRED**:
```typescript
// DO THIS INSTEAD
await supabase.rpc("save_recent_location", {
  p_user_id: userId,
  p_lat: lat,
  p_lng: lng,
  p_address: address,
  p_source: "mobility",
  p_context: "ride_request",
  p_ttl_hours: 24
});
```

**Why**: RPCs provide:
- Parameter validation
- Proper error handling
- Atomic operations
- Future-proof interface

---

### 4. Structured Logging Required

❌ **FORBIDDEN**:
```typescript
console.log("Saved location for user", userId);
```

✅ **REQUIRED**:
```typescript
import { logStructuredEvent } from "../_shared/observability.ts";

logStructuredEvent("location_cache_save", {
  user_id: userId,
  source: "mobility",
  success: true,
  correlation_id: crypto.randomUUID(),
});
```

**Required fields**:
- `user_id` (masked in production logs)
- `source` (e.g., "mobility", "insurance", "waiter")
- `success` (boolean)
- `correlation_id` (for request tracing)

---

### 5. Migration Period: No Breaking Changes

**Timeline**: Dec 9, 2025 → Jan 6, 2026 (4 weeks)

During this period:
- ✅ `whatsapp_users.location_cache` column still exists (read-only)
- ✅ Bridge function `updateLegacyLocationCache()` available
- ⚠️ **All new code** must use `location-service`
- ❌ **Do not drop** legacy columns yet

**After Jan 6, 2026**:
- 🗑️ Drop `whatsapp_users.location_cache` column
- 🗑️ Remove bridge function
- 🗑️ Archive `rides_saved_locations`, `user_favorites` tables

---

## 📖 Developer Guide

### Scenario 1: User Sets Home Address

```typescript
import { saveFavoriteLocation } from "../_shared/location-service/index.ts";
import { logStructuredEvent } from "../_shared/observability.ts";

const correlationId = crypto.randomUUID();

const saved = await saveFavoriteLocation(
  supabase,
  userId,
  { lat: -1.9441, lng: 30.0619, address: "KN 5 Ave, Kigali" },
  "home",
  "My House"
);

if (saved) {
  logStructuredEvent("location_favorite_saved", {
    user_id: userId,
    kind: "home",
    correlation_id: correlationId,
  });
}
```

### Scenario 2: Cache User's Last Ride Location

```typescript
import { cacheLocation } from "../_shared/location-service/index.ts";
import { logStructuredEvent } from "../_shared/observability.ts";

const correlationId = crypto.randomUUID();

const cached = await cacheLocation(
  supabase,
  userId,
  { lat: -1.9500, lng: 30.0900, address: "Kimironko Market" },
  "mobility",
  "ride_pickup",
  24 // hours
);

if (cached) {
  logStructuredEvent("location_cache_save", {
    user_id: userId,
    source: "mobility",
    context: "ride_pickup",
    ttl_hours: 24,
    correlation_id: correlationId,
  });
}
```

### Scenario 3: Get User's Location (Smart Fallback)

```typescript
import { resolveUserLocation } from "../_shared/location-service/index.ts";
import { logStructuredEvent } from "../_shared/observability.ts";

const correlationId = crypto.randomUUID();

// Try home → cache → none
const resolved = await resolveUserLocation(supabase, userId, "home");

if (resolved) {
  logStructuredEvent("location_resolved", {
    user_id: userId,
    source: resolved.source, // "favorite" | "cache"
    favorite_kind: resolved.favoriteKind, // "home" (if favorite)
    correlation_id: correlationId,
  });
  
  return resolved.location; // { lat, lng, address }
} else {
  logStructuredEvent("location_prompt_required", {
    user_id: userId,
    correlation_id: correlationId,
  });
  
  // Prompt user for location
}
```

---

## 🧪 Testing Checklist

Before committing location-related code:

- [ ] Used `location-service` module (not direct table access)
- [ ] Used correct table (`saved_locations` for favorites, `recent_locations` for cache)
- [ ] Used RPCs (not raw SQL)
- [ ] Added structured logging with correlation ID
- [ ] Handled null returns gracefully
- [ ] Tested TTL expiration (for cache)
- [ ] Verified RLS policies (user can only access own locations)
- [ ] Ran `./scripts/verify-location-consolidation.sh`

---

## 🚫 Common Mistakes

### Mistake 1: Using `from()` instead of RPCs
```typescript
// ❌ WRONG
const { data } = await supabase
  .from("recent_locations")
  .select("*")
  .eq("user_id", userId)
  .single();

// ✅ CORRECT
const cached = await getCachedLocation(supabase, userId);
```

### Mistake 2: Storing favorites in cache table
```typescript
// ❌ WRONG (home is persistent, not temporary)
await cacheLocation(supabase, userId, homeLocation, "mobility", "home");

// ✅ CORRECT
await saveFavoriteLocation(supabase, userId, homeLocation, "home");
```

### Mistake 3: No error handling
```typescript
// ❌ WRONG (what if RPC fails?)
const location = await getCachedLocation(supabase, userId);
console.log(location.address); // Crash if null

// ✅ CORRECT
const location = await getCachedLocation(supabase, userId);
if (!location) {
  logStructuredEvent("location_cache_miss", { user_id: userId });
  // Prompt user or use fallback
  return;
}
console.log(location.address);
```

### Mistake 4: Hardcoded TTL
```typescript
// ❌ WRONG (magic number)
await cacheLocation(supabase, userId, location, "mobility", "ride", 24);

// ✅ CORRECT (use constant)
const LOCATION_CACHE_TTL_HOURS = 24;
await cacheLocation(supabase, userId, location, "mobility", "ride", LOCATION_CACHE_TTL_HOURS);
```

---

## 📊 Monitoring

### Key Metrics to Track

1. **Cache Hit Rate**: `location_cache_hit / (location_cache_hit + location_cache_miss)`
2. **Favorite Usage**: Count of `location_favorite_saved` events by kind
3. **Expiration Rate**: Count of expired records purged daily
4. **Error Rate**: `location_*_error` events / total location events

### Alerts

- ❌ Cache hit rate < 40% → Users not caching locations properly
- ❌ Error rate > 5% → Schema drift or RPC issues
- ⚠️ Favorites > 10 per user → Possible abuse or UX issue

---

## 🔄 Rollback Plan

If critical issues arise:

1. **Immediate**: Comment out `location-service` imports, revert to direct table access
2. **Within 1 hour**: Identify root cause (schema drift? RPC bug? RLS policy?)
3. **Within 4 hours**: Apply hotfix or revert migration
4. **Within 24 hours**: Post-mortem and prevention plan

**Rollback commands**:
```bash
# Revert last migration
supabase db reset

# Restore from backup (if needed)
supabase db dump --linked > backup.sql
psql $DATABASE_URL < backup_2025_12_08.sql
```

---

## 📞 Support

**Questions?** Check:
1. This document
2. `LOCATION_CONSOLIDATION_COMPLETE.md`
3. `supabase/functions/_shared/location-service/index.ts` (source code + JSDoc)
4. Slack: #easymo-dev

**Found a bug?** Report with:
- Correlation ID (from logs)
- User ID (masked)
- Expected vs actual behavior
- Steps to reproduce

---

## 🎓 Learning Resources

- [PostGIS Geography Tutorial](https://postgis.net/workshops/postgis-intro/geography.html)
- [Supabase RLS Policies](https://supabase.com/docs/guides/auth/row-level-security)
- [Structured Logging Best Practices](https://www.honeycomb.io/blog/structured-logging-and-your-team)

---

**Last Updated**: 2025-12-09  
**Next Review**: 2026-01-06 (after migration period ends)
