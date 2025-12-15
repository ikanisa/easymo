# WhatsApp Webhooks Deep Review Report

**Date**: 2025-12-15  
**Scope**: wa-webhook-mobility, wa-webhook-buy-sell, wa-webhook-profile  
**Status**: 🔴 CRITICAL ISSUES FOUND

---

## Executive Summary

A comprehensive review of the three WhatsApp webhooks reveals **critical routing and configuration issues** preventing users from receiving messages when tapping "Rides", "Buy and Sell", and "Profile" from the WhatsApp home menu. Additionally, there are **500 errors in Supabase**, broken file references, and significant code duplication.

### Critical Issues Found

1. ❌ **Menu Key Mismatch** - Database uses `rides`, `buy_sell`, `profile` but code expects `rides_agent`, `business_broker_agent`
2. ❌ **Duplicate Route Config** - Buy-sell service defined twice in route-config.ts
3. ❌ **Missing Interactive Handlers** - Webhooks don't properly handle home menu button clicks
4. ❌ **Broken References** - References to deleted files/functions
5. ❌ **500 Errors** - Poor error handling causing database failures

---

## Issue 1: Menu Key Mismatch (CRITICAL)

### Problem
The database table `whatsapp_home_menu_items` uses simplified keys:
- `rides` (not `rides_agent`)
- `buy_sell` (not `business_broker_agent` or `buy_and_sell_agent`)
- `profile` (correct)

But the code in multiple places expects:
- `rides_agent` or `business_broker_agent`
- `buy_and_sell_agent` or `business_broker_agent`

### Evidence

**Database Schema** (`20251215102500_fix_home_menu_schema.sql`):
```sql
INSERT INTO whatsapp_home_menu_items (key, title, ...) VALUES
('rides', 'Rides', ...),
('buy_sell', 'Buy & Sell', ...),
('profile', 'Profile', ...)
```

**Route Config** (`route-config.ts:32`):
```typescript
menuKeys: ["rides", "mobility", "rides_agent", ...]  // Mixed keys
```

**Router** (`router.ts:536`):
```typescript
const targetService = SERVICE_KEY_MAP[selection] ?? null;
// selection comes from menu button click, which uses database key
```

**Mobility Webhook** (`wa-webhook-mobility/index.ts:372`):
```typescript
if (id === IDS.RIDES_MENU || id === "rides_agent" || id === "rides") {
  // Handles multiple variations but may miss some
}
```

### Impact
- Users tap "Rides" → sends `rides` → router may not find it in SERVICE_KEY_MAP
- Users tap "Buy & Sell" → sends `buy_sell` → may route incorrectly
- Users tap "Profile" → sends `profile` → should work but needs verification

### Fix Required
1. Align route-config.ts menuKeys with database keys
2. Ensure router.ts handles both legacy and new keys
3. Update webhook handlers to accept database keys

---

## Issue 2: Duplicate Route Config Entry (HIGH)

### Problem
`route-config.ts` has duplicate entries for buy-sell service (lines 66-88).

### Evidence
```typescript
{
  // Buy & Sell + Support - consolidated marketplace service
  service: "wa-webhook-buy-sell",
  keywords: [...],
  menuKeys: [...],
  // Buy & Sell service - consolidated marketplace + support
  // Support functionality merged here per comprehensive cleanup (Phase 2)
  // Handles both marketplace transactions and customer support inquiries
  service: "wa-webhook-buy-sell",  // DUPLICATE
  keywords: [...],  // DUPLICATE
  menuKeys: [...],  // DUPLICATE
  priority: 1,
}
```

### Impact
- Confusing code
- Potential routing conflicts
- Maintenance issues

### Fix Required
Remove duplicate entry, keep single consolidated version.

---

## Issue 3: Missing Interactive Button Handlers (CRITICAL)

### Problem
When users tap buttons from the home menu, the webhooks may not properly handle the button IDs.

### Evidence

**Router** (`router.ts:534-570`):
```typescript
} else if (selection) {
  const targetService = SERVICE_KEY_MAP[selection] ?? null;
  if (targetService) {
    // Forwards to service
    const response = await fetch(url, {...});
    // But doesn't check if response is successful or if service handles it
  }
}
```

**Mobility Webhook** (`wa-webhook-mobility/index.ts:372`):
```typescript
if (id === IDS.RIDES_MENU || id === "rides_agent" || id === "rides") {
  handled = await showMobilityMenu(ctx);
}
// But what if id is just "rides" from database?
```

**Buy-Sell Webhook** (`wa-webhook-buy-sell/index.ts`):
- No explicit handler for `buy_sell` button ID
- Relies on AI agent to handle everything
- May not respond to initial button click

**Profile Webhook** (`wa-webhook-profile/index.ts:506`):
```typescript
if (id === "profile") {
  const { startProfile } = await import("./handlers/menu.ts");
  handled = await startProfile(ctx, state ?? { key: "home" });
}
// This should work, but needs verification
```

### Impact
- Users tap button → no response
- Users see no menu or error message
- Poor user experience

### Fix Required
1. Ensure all webhooks handle database menu keys
2. Add explicit handlers for initial button clicks
3. Verify response is sent to user

---

## Issue 4: Broken References (MEDIUM)

### Problem
References to deleted files/functions found in codebase.

### Evidence

**From PHASE4_IMMEDIATE_ACTIONS.md**:
- `agent-buy-sell` function was deleted but may still be referenced
- `_shared/agents/buy-and-sell.ts` was deleted but may be imported somewhere

**Potential Issues**:
- Import statements pointing to non-existent files
- Function calls to deleted functions
- Database references to deleted tables

### Impact
- Runtime errors when code executes
- 500 errors in Supabase
- Broken functionality

### Fix Required
1. Search for all references to deleted files
2. Remove or update broken imports
3. Clean up database references

---

## Issue 5: 500 Errors in Supabase (CRITICAL)

### Problem
Multiple 500 errors reported in Supabase logs.

### Potential Causes

1. **Database Connection Issues**:
   - Circuit breaker may be opening too frequently
   - Connection pool exhaustion
   - Timeout issues

2. **Error Handling Gaps**:
   - Unhandled promise rejections
   - Missing try-catch blocks
   - Database query failures not caught

3. **Missing Environment Variables**:
   - `WA_APP_SECRET` not configured
   - `SUPABASE_SERVICE_ROLE_KEY` missing
   - Other required env vars

4. **Invalid Database Queries**:
   - References to deleted tables
   - Missing columns
   - Foreign key violations

### Evidence

**Profile Webhook** (`wa-webhook-profile/index.ts:430-480`):
```typescript
let profile;
try {
  profile = await ensureProfile(supabase, from);
  dbCircuitBreaker.recordSuccess();
} catch (error) {
  dbCircuitBreaker.recordFailure(...);
  // Returns 500 on any error
  return json({ error: "internal_error", ... }, { status: 500 });
}
```

**Buy-Sell Webhook** (`wa-webhook-buy-sell/index.ts:537-559`):
```typescript
} catch (error) {
  logStructuredEvent("BUY_SELL_ERROR", {...}, "error");
  return respond({ error: errorMessage }, { status: 500 });
  // Always returns 500, even for user errors
}
```

### Fix Required
1. Improve error classification (user vs system errors)
2. Add better error handling
3. Fix database query issues
4. Verify environment variables

---

## Issue 6: Code Duplication (MEDIUM)

### Problem
Significant code duplication across webhooks.

### Evidence

**Similar Patterns**:
- All three webhooks have similar signature verification
- All have similar rate limiting
- All have similar error handling
- All have similar profile creation logic

### Impact
- Maintenance burden
- Inconsistent behavior
- Bug fixes need to be applied in multiple places

### Fix Required
1. Extract common logic to shared modules
2. Use shared utilities consistently
3. Reduce duplication

---

## Issue 7: Complex Logic (MEDIUM)

### Problem
Webhooks contain complex, hard-to-maintain logic.

### Evidence

**Mobility Webhook** (`wa-webhook-mobility/index.ts`):
- 787 lines
- Multiple nested conditionals
- Complex state management
- Many handler functions

**Buy-Sell Webhook** (`wa-webhook-buy-sell/index.ts`):
- 560 lines
- AI agent integration
- Business management logic
- Multiple state handlers

**Profile Webhook** (`wa-webhook-profile/index.ts`):
- 1177 lines
- Multiple feature handlers
- Complex location management
- Wallet integration

### Impact
- Hard to debug
- Difficult to test
- High risk of bugs

### Fix Required
1. Break down into smaller functions
2. Simplify state management
3. Extract feature-specific handlers
4. Improve code organization

---

## Recommended Fix Priority

### P0 - Critical (Fix Immediately)
1. ✅ Fix menu key mismatch
2. ✅ Fix duplicate route config
3. ✅ Fix interactive button handlers
4. ✅ Fix 500 errors

### P1 - High (Fix Soon)
5. ✅ Remove broken references
6. ✅ Improve error handling
7. ✅ Verify environment variables

### P2 - Medium (Fix When Possible)
8. ✅ Reduce code duplication
9. ✅ Simplify complex logic
10. ✅ Improve code organization

---

## Testing Checklist

After fixes, verify:

- [ ] User can tap "Rides" and receive mobility menu
- [ ] User can tap "Buy & Sell" and receive marketplace welcome
- [ ] User can tap "Profile" and receive profile menu
- [ ] No 500 errors in Supabase logs
- [ ] All webhooks respond within 2 seconds
- [ ] Error messages are user-friendly
- [ ] No broken imports or references

---

## Next Steps

1. Create fix implementation plan
2. Apply fixes in priority order
3. Test each fix
4. Deploy to staging
5. Monitor for errors
6. Deploy to production

---

**Report Generated**: 2025-12-15  
**Reviewer**: AI Assistant  
**Status**: Ready for Implementation

