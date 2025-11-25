# Routing Logic Consolidation

**Date:** 2025-11-25  
**Issue:** CORE-001 - Routing Logic Duplication  
**Status:** ✅ Completed

## Summary

Consolidated duplicate routing logic from `routing_logic.ts` into the primary `router.ts` implementation. The `routing_logic.ts` file is now deprecated and serves only as a backward-compatibility wrapper for legacy services.

## Changes Made

### 1. Enhanced `router.ts`

Added unified agent system check to `routeIncomingPayload()`:

```typescript
// Check if unified agent system is enabled (consolidation from routing_logic.ts)
const unifiedSystemEnabled = await (async () => {
  try {
    const { isFeatureEnabled } = await import("../_shared/feature-flags.ts");
    return isFeatureEnabled("agent.unified_system");
  } catch {
    return false; // Graceful degradation if feature flags unavailable
  }
})();

if (unifiedSystemEnabled) {
  return {
    service: "wa-webhook-ai-agents",
    reason: "keyword",
    routingText,
  };
}
```

### 2. Deprecated `routing_logic.ts`

- Added `@deprecated` JSDoc annotation
- Converted to thin wrapper that calls `routeIncomingPayload()`
- Includes fallback logic for safety
- Logs deprecation warning on each use

### 3. Migration Path

**Old usage (deprecated):**
```typescript
import { routeMessage } from "./routing_logic.ts";
const service = await routeMessage(messageText, chatState);
```

**New usage (recommended):**
```typescript
import { routeIncomingPayload } from "./router.ts";
const decision = await routeIncomingPayload(whatsAppPayload);
const service = decision.service;
```

## Benefits

1. **Single Source of Truth:** All routing logic now in `router.ts`
2. **Better Type Safety:** Uses `WhatsAppWebhookPayload` instead of raw strings
3. **Detailed Decisions:** Returns routing reason and context
4. **Unified Features:** Includes unified agent system support
5. **Session Integration:** Manages user sessions automatically

## Backward Compatibility

Legacy services using `routeMessage()` will continue to work with deprecation warnings. The wrapper:
- Constructs a minimal WhatsApp payload
- Calls the new `routeIncomingPayload()`
- Falls back to original logic if new router fails
- Logs deprecation warnings for tracking

## Next Steps

1. ✅ Consolidate routing logic
2. ⏳ Update legacy `wa-webhook` service to use new router
3. ⏳ Add integration tests
4. ⏳ Remove `routing_logic.ts` after migration complete

## Testing

Run existing tests to verify backward compatibility:
```bash
deno test supabase/functions/wa-webhook-core/index.test.ts
```

## Rollback Plan

If issues arise:
1. Revert `router.ts` changes (remove unified agent check)
2. Restore original `routing_logic.ts` implementation
3. Both files are still present for easy rollback

## Related Issues

- CORE-002: Correlation ID Propagation (next priority)
- CORE-003: Home Menu Error Handling
- CORE-004: Session Manager Error Recovery
