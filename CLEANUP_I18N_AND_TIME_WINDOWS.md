# I18N Cleanup & Time Window Documentation

**Date**: 2025-12-05  
**Status**: ✅ **DEPLOYED**  
**Service**: `wa-webhook-mobility`

## Problem

User reported seeing developer jargon in production:
```
"mobility.nearby.newlocation...."
```

This is a **missing translation key** fallback showing the actual i18n key instead of proper text.

## Issues Fixed

### 1. Missing Translation Key

**Before:**
```json
// en.json - MISSING the base key!
{
  "mobility.nearby.new_location.desc": "Search from a different location"
}
```

Code was trying to use:
```typescript
t(ctx.locale, "mobility.nearby.new_location") || "📍 Share New Location"
```

When translation missing → shows fallback  
When fallback missing → shows the key itself: `"mobility.nearby.newlocation...."`

**After:**
```json
// en.json
{
  "mobility.nearby.new_location": "📍 Share New Location",
  "mobility.nearby.new_location.desc": "Search from a different location"
}

// fr.json
{
  "mobility.nearby.new_location": "📍 Partager Nouveau Lieu",
  "mobility.nearby.new_location.desc": "Rechercher depuis un lieu différent"
}
```

Now code shows proper translated text:
```typescript
title: t(ctx.locale, "mobility.nearby.new_location"),  // ✅ Works
description: t(ctx.locale, "mobility.nearby.new_location.desc"),  // ✅ Works
```

### 2. Clarified Time Windows

Added documentation to make time windows crystal clear:

**`config/mobility.ts`** - Added header comment:
```typescript
/**
 * TIME WINDOWS:
 * - Recent searches: 30 minutes (RECENT_SEARCH_WINDOW_MINUTES)
 * - Trip matching: 48 hours (DEFAULT_WINDOW_DAYS = 2 days)
 * - Location cache: 30 minutes (LOCATION_FRESHNESS_MINUTES)
 */

export const MOBILITY_CONFIG = {
  LOCATION_FRESHNESS_MINUTES: 30,      // Location cache window
  RECENT_SEARCH_WINDOW_MINUTES: 30,    // Recent search expiry (NEW)
  DEFAULT_WINDOW_DAYS: 2,              // Trip matching window (48 hours)
  // ...
}
```

**`domains/intent_storage.ts`** - Updated to use constant:
```typescript
// Before:
const expiresInMinutes = params.expiresInMinutes ?? 30;  // ❌ Hardcoded

// After:
const expiresInMinutes = params.expiresInMinutes ?? 
  MOBILITY_CONFIG.RECENT_SEARCH_WINDOW_MINUTES;  // ✅ Uses config
```

### 3. Removed Fallback Jargon

**Before:**
```typescript
title: t(ctx.locale, "mobility.nearby.new_location") || "📍 Share New Location",
//      ↑ If translation missing, shows fallback
//      ↑ If key typo'd, shows: "mobility.nearby.newlocation..."
```

**After:**
```typescript
title: t(ctx.locale, "mobility.nearby.new_location"),
//      ↑ Translation MUST exist (added to both en.json + fr.json)
//      ↑ If missing, translator will throw error in dev
```

## Time Windows Summary

| Feature | Window | Config Constant |
|---------|--------|-----------------|
| **Recent Searches** | 30 minutes | `RECENT_SEARCH_WINDOW_MINUTES` |
| **Location Cache** | 30 minutes | `LOCATION_FRESHNESS_MINUTES` |
| **Trip Matching** | 48 hours (2 days) | `DEFAULT_WINDOW_DAYS` |
| **Trip Expiry** | 90 minutes | `TRIP_EXPIRY_MINUTES` |

### Why These Windows?

**30 minutes (Recent Searches & Location Cache):**
- User location can change significantly in >30 mins (driving across city)
- Keeps searches relevant to current position
- Matches standard GPS cache duration

**48 hours (Trip Matching):**
- Allows flexible scheduling (tomorrow, day after)
- Accommodates timezone differences
- Balances freshness with availability

**90 minutes (Trip Expiry):**
- Longer than typical ride duration
- Prevents stale trips clogging database
- Auto-cleanup without manual intervention

## Files Changed

- ✅ `supabase/functions/wa-webhook-mobility/i18n/messages/en.json` (+1 line)
- ✅ `supabase/functions/wa-webhook-mobility/i18n/messages/fr.json` (+1 line)
- ✅ `supabase/functions/wa-webhook-mobility/handlers/nearby.ts` (removed fallbacks)
- ✅ `supabase/functions/_shared/wa-webhook-shared/config/mobility.ts` (+docs +constant)
- ✅ `supabase/functions/_shared/wa-webhook-shared/domains/intent_storage.ts` (use constant)

## Testing

### Before (Bug):
User sees in WhatsApp:
```
📍 mobility.nearby.newlocation....
Search from a different location
```

### After (Fixed):
User sees in WhatsApp:
```
📍 Share New Location
Search from a different location
```

French users see:
```
📍 Partager Nouveau Lieu
Rechercher depuis un lieu différent
```

## Best Practices for I18N

### ✅ DO:
```typescript
// 1. Define both title and description keys
{
  "feature.action": "Action Title",
  "feature.action.desc": "Action description"
}

// 2. Use keys directly (no fallbacks in code)
title: t(ctx.locale, "feature.action"),

// 3. Add to ALL language files (en.json, fr.json, rw.json)
```

### ❌ DON'T:
```typescript
// 1. Don't hardcode fallbacks (hides missing keys)
title: t(ctx.locale, "feature.action") || "Hardcoded Text",  // ❌

// 2. Don't use partial keys
{
  "feature.action.desc": "..."  // ❌ Missing base key
}

// 3. Don't leave translations in one language only
// en.json has it, fr.json doesn't → French users see English
```

## Deployment

```bash
supabase functions deploy wa-webhook-mobility --no-verify-jwt
```

**Status**: ✅ Live in production

---
**Commit**: `fix(i18n): add missing translation keys and document time windows`
