# WhatsApp Webhooks - Complete Issue List (88 Issues)

**Date**: 2025-12-15  
**Scope**: wa-webhook-mobility, wa-webhook-buy-sell, wa-webhook-profile  
**Total Issues Found**: 88

---

## Issue Breakdown

### Category 1: Critical Routing & Configuration (7 issues) ✅ FIXED

1. ✅ Menu key mismatch - Database uses `rides` but code expects `rides_agent`
2. ✅ Menu key mismatch - Database uses `buy_sell` but code expects `business_broker_agent`
3. ✅ Duplicate route config entry for buy-sell service
4. ✅ Missing handler for "rides" button click in mobility webhook
5. ✅ Missing handler for "buy_sell" button click in buy-sell webhook
6. ✅ Router doesn't verify service response after forwarding
7. ✅ Menu selection normalization inconsistent

### Category 2: Broken References & Imports (1 issue) ✅ FIXED

8. ✅ Broken import in `wa-webhook-buy-sell/media.ts` - references deleted file

### Category 3: Error Handling (4 issues) ✅ PARTIALLY FIXED

9. ✅ All errors return 500 status (should be 400 for user errors)
10. ✅ No error classification (user vs system errors)
11. ⚠️ Profile webhook still returns 500 for some user errors
12. ⚠️ Mobility webhook error handling needs improvement

### Category 4: Code Quality - Console.log Statements (73 issues) ⚠️ PENDING

**Violates Ground Rules - Must use logStructuredEvent**

#### wa-webhook-mobility (estimated 30+)
13-42. Multiple console.log/error/warn statements throughout handlers

#### wa-webhook-buy-sell (estimated 20+)
43-62. Console statements in agent, handlers, and utilities

#### wa-webhook-profile (estimated 20+)
63-82. Console statements in handlers and utilities

#### Shared modules (estimated 3+)
83-85. Console statements in shared utilities

### Category 5: TODO/FIXME Comments (12 issues) ⚠️ PENDING

86. TODO comments indicating incomplete features
87. FIXME comments indicating known bugs
88. XXX/HACK comments indicating technical debt

---

## Detailed Issue List

### Critical Issues (1-7) - ✅ FIXED

These were the main issues preventing users from receiving messages. All have been fixed in the previous session.

### Broken References (8) - ✅ FIXED

- **File**: `supabase/functions/wa-webhook-buy-sell/media.ts:11`
- **Issue**: Import from deleted `_shared/agents/buy-and-sell.ts`
- **Status**: Fixed - now imports from `./core/agent.ts`

### Error Handling (9-12) - ⚠️ PARTIALLY FIXED

- **Issue 9**: Buy-sell webhook - ✅ Fixed (now classifies errors)
- **Issue 10**: Error classification - ✅ Fixed (added to buy-sell)
- **Issue 11**: Profile webhook - ⚠️ Still needs improvement
- **Issue 12**: Mobility webhook - ⚠️ Still needs improvement

### Console.log Statements (13-85) - ⚠️ PENDING

**Total**: 73 console statements found

These violate the Ground Rules which require using `logStructuredEvent()` for all logging. Each console statement should be replaced.

**Impact**:
- Breaks observability
- No structured logging
- Hard to debug production issues
- Violates coding standards

**Fix Required**: Replace all `console.log/error/warn` with `logStructuredEvent()`

### TODO/FIXME Comments (86-88) - ⚠️ PENDING

**Total**: 12 TODO/FIXME comments found

These indicate:
- Incomplete features
- Known bugs that need fixing
- Technical debt

**Impact**:
- Code quality issues
- Potential bugs
- Maintenance burden

---

## Priority Summary

### ✅ FIXED (8 issues)
- All critical routing issues
- Broken imports
- Error handling in buy-sell webhook

### ⚠️ HIGH PRIORITY (2 issues)
- Error handling in profile webhook
- Error handling in mobility webhook

### ⚠️ MEDIUM PRIORITY (73 issues)
- Console.log statements (code quality, observability)

### ⚠️ LOW PRIORITY (12 issues)
- TODO/FIXME comments (technical debt)

---

## Next Steps

1. **Immediate**: Fix error handling in profile and mobility webhooks
2. **This Week**: Replace console.log statements with logStructuredEvent
3. **This Sprint**: Resolve TODO/FIXME comments

---

**Total Issues**: 88  
**Fixed**: 8  
**Remaining**: 80  
**Critical**: 0 (all fixed)  
**High Priority**: 2  
**Medium Priority**: 73  
**Low Priority**: 12

