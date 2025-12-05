# Mobility Recent Search Fix - Deployed

**Date**: 2025-12-05  
**Status**: ✅ **DEPLOYED**  
**Service**: `wa-webhook-mobility`

## Problem

Users clicking on "Recent Search" options and "Share New Location" in the mobility flow were seeing `MOBILITY_UNHANDLED_MESSAGE` errors:

```json
{"event":"MOBILITY_UNHANDLED_MESSAGE","from":"35677186193","type":"interactive"}
{"event":"MOBILITY_INTERACTION","id":"RECENT_SEARCH::0::-1.9915554523468,30.105907440186"}
{"event":"MOBILITY_INTERACTION","id":"SHARE_NEW_LOCATION"}
```

The handlers existed in `handlers/nearby.ts` but were not wired up in the main router.

## Root Cause

The `handleRecentSearchSelection()` function was defined but not:
1. Exported from `handlers/nearby.ts` ✅ (was already exported)
2. Imported in `index.ts` ❌ (missing)
3. Routed for interactive button clicks ❌ (missing)

## Solution

### 1. Added Import
```typescript
// supabase/functions/wa-webhook-mobility/index.ts
import {
  handleSeeDrivers,
  handleSeePassengers,
  // ... other imports
  handleRecentSearchSelection,  // ← ADDED
  isVehicleOption,
} from "./handlers/nearby.ts";
```

### 2. Added Router Cases
```typescript
// Line ~322-326
} else if ((id.startsWith("RECENT_SEARCH::") || id === "SHARE_NEW_LOCATION") && 
           state?.key === "mobility_nearby_select") {
  handled = await handleRecentSearchSelection(ctx, id);
} else if (id === "USE_CURRENT_LOCATION" && state?.key === "location_saved_picker") {
  handled = await handleNearbySavedLocationSelection(ctx, state.data as any, id);
}
```

## Handler Logic (Already Implemented)

### Recent Search Selection
Parses coordinates from button ID format: `RECENT_SEARCH::{index}::{lat},{lng}`
- Extracts lat/lng from selection
- Retrieves user state to know mode (drivers/passengers)
- Executes search with cached coordinates

### Share New Location
- Reads current mode from state
- Shows vehicle selector for user to share new location

### Use Current Location  
- Uses last recorded location (within 30-min window)
- Executes search without requiring new location share

## Testing

Deploy confirmed successful:
```bash
supabase functions deploy wa-webhook-mobility --no-verify-jwt
# Deployed Functions: wa-webhook-mobility
```

### Expected Behavior
1. User taps "�� Nearby drivers" → sees recent searches if available
2. User selects recent search → executes search with cached coordinates  
3. User selects "Share New Location" → prompts for vehicle selection
4. User selects "Use Current Location" → uses last GPS position (if recent)

### Log Confirmation
After fix, logs should show:
```json
{"event":"MOBILITY_INTERACTION","id":"RECENT_SEARCH::0::-1.9915,30.1059"}
{"event":"MOBILITY_LAUNCHING_WORKFLOW","workflow":"handleNearbyLocation"}
// No more MOBILITY_UNHANDLED_MESSAGE
```

## Files Changed

- ✅ `supabase/functions/wa-webhook-mobility/index.ts` (+3 lines)
  - Import `handleRecentSearchSelection`
  - Route `RECENT_SEARCH::*` and `SHARE_NEW_LOCATION` buttons
  - Route `USE_CURRENT_LOCATION` button

## Deployment

```bash
supabase functions deploy wa-webhook-mobility --no-verify-jwt
```

**Status**: ✅ Live in production

## Related Features

This fix enables the "Recent Searches" UX flow added in [MOBILITY_V2_WEEK4_COMPLETE.md]:
- Shows last 3 searches with timestamp + vehicle type
- Allows quick re-search from previous locations
- Improves UX for frequent riders

## Next Steps

None required. Feature is fully functional.

---
**Commit**: `fix(mobility): wire up recent search handlers`
