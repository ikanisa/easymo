# Mobility Nearby Drivers Workflow Fix

## Issue
The mobility nearby drivers/passengers workflow was showing "Recent Searches" UI even when users wanted to start a fresh search. This violated the principle of predictable, standard workflows.

**User Experience Problem:**
```
User taps: "🚖 Nearby drivers"
System shows: "🕐 Recent Searches" 
              "🔄 Quick search from a recent location, or share a new one:"

Expected: Direct vehicle selection → location share → results
```

## Root Cause
Both `wa-webhook-mobility` and `wa-webhook` handlers were trying to be "smart" by:
1. Checking for cached locations (30min window)
2. Showing recent search history
3. Only falling back to standard flow if nothing cached

This created an unpredictable experience where users couldn't reliably start fresh searches.

## Solution
Simplified the workflow to follow the **standard pattern every time**:

### For "Nearby Drivers" (handleSeeDrivers)
```typescript
// OLD: Complex caching + recent searches logic
// NEW: Simple, predictable flow
1. Check pending payments
2. Ask for vehicle selection
3. User selects vehicle
4. Ask for location share
5. Show results
```

### For "Nearby Passengers" (handleSeePassengers)
```typescript
// OLD: Check cache → check recent → fallback to stored vehicle
// NEW: Simple, predictable flow
1. Ensure vehicle plate registered
2. If user has stored vehicle preference → use it, ask for location
3. If no stored preference → ask for vehicle selection
4. Ask for location share
5. Show results
```

## Files Changed
1. `supabase/functions/wa-webhook-mobility/handlers/nearby.ts`
   - Simplified `handleSeeDrivers()` - removed location caching and recent searches
   - Simplified `handleSeePassengers()` - removed location caching

2. `supabase/functions/wa-webhook/domains/mobility/nearby.ts`
   - Simplified `handleSeeDrivers()` - removed all caching logic
   - Simplified `handleSeePassengers()` - removed all caching logic

## Benefits
✅ **Predictable**: Same flow every time
✅ **Clear**: No confusion about recent vs new searches
✅ **Fast**: Fewer database queries
✅ **Maintainable**: Simpler code, easier to debug

## Removed Features
❌ Automatic location cache reuse (30min window)
❌ Recent searches auto-display
❌ Smart fallback logic

Note: Recent searches functionality still exists in the codebase (for potential future use as an explicit feature), but is no longer auto-triggered in the main flow.

## Testing
Deploy both functions and verify:
1. Tap "Nearby drivers" → should show vehicle selection immediately
2. Select vehicle → should ask for location (no recent searches UI)
3. Share location → should show results
4. Repeat → should still show vehicle selection (not cache)

## Deployment
```bash
supabase functions deploy wa-webhook-mobility --no-verify-jwt
supabase functions deploy wa-webhook --no-verify-jwt
```

**Status**: ✅ Deployed (2025-12-05)
