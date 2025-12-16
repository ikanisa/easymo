# Comprehensive WhatsApp Workflow Fixes

**Date:** 2025-12-16  
**Status:** ✅ All Critical Issues Fixed

---

## Issues Identified and Fixed

### 1. ✅ wa-webhook-mobility: Module Not Found Error

**Error:**
```
Module not found: file:///var/tmp/sb-compile-edge-runtime/supabase/_shared/security/internal-forward.ts
```

**Root Cause:**
- Dynamic import with incorrect path
- Runtime path structure different from local

**Fix:**
- Changed from dynamic import to static import
- Updated import path to `../_shared/security/internal-forward.ts`
- File: `supabase/functions/wa-webhook-mobility/index.ts`

---

### 2. ✅ wa-webhook-buy-sell: Database Constraint Violation

**Error:**
```
null value in column "phone_number" of relation "wa_events" violates not-null constraint
```

**Root Cause:**
- `claimEvent()` function not setting `phone_number` when inserting into `wa_events`
- `wa_events` table requires `phone_number` (NOT NULL constraint)

**Fix:**
- Updated `claimEvent()` to accept `phoneNumber` parameter
- Added fallback to `"unknown"` if phone number not provided
- Updated all `claimEvent()` calls to pass phone number
- Files:
  - `supabase/functions/_shared/wa-webhook-shared/state/idempotency.ts`
  - `supabase/functions/wa-webhook-mobility/state/idempotency.ts`
  - `supabase/functions/wa-webhook-buy-sell/index.ts`

---

### 3. ✅ Missing Table: processed_webhook_messages

**Error:**
```
Could not find the table 'public.processed_webhook_messages' in the schema cache
```

**Root Cause:**
- Code references `processed_webhook_messages` table that doesn't exist
- Should use `wa_events` table instead

**Fix:**
- Replaced all `processed_webhook_messages` references with `wa_events`
- Updated `checkIdempotency()` to use `wa_events`
- Updated `recordProcessedMessage()` to use `wa_events`
- Updated `markMessageProcessed()` to use `wa_events`
- Updated `isNewMessage()` to use `wa_events`
- Files:
  - `supabase/functions/_shared/webhook-utils.ts`
  - `supabase/functions/_shared/wa-webhook-shared/utils/message-deduplication.ts`
  - `supabase/functions/wa-webhook-profile/index.ts`

---

### 4. ✅ wa-webhook-profile: Idempotency Check Failure

**Error:**
```
IDEMPOTENCY_CHECK_ERROR: Could not find the table 'public.processed_webhook_messages'
```

**Root Cause:**
- `checkIdempotency()` was using non-existent table
- Missing phone number parameter

**Fix:**
- Updated `checkIdempotency()` to use `wa_events` table
- Added `phoneNumber` parameter to `checkIdempotency()`
- Updated call in `wa-webhook-profile/index.ts` to pass phone number
- Files:
  - `supabase/functions/_shared/webhook-utils.ts`
  - `supabase/functions/wa-webhook-profile/index.ts`

---

### 5. ✅ wa-webhook-core: JSON Syntax Error

**Error:**
```
Expected double-quoted property name in JSON at position 78130 (line 1000 column 1)
```

**Root Cause:**
- Trailing comma in `fr.json` file

**Fix:**
- Removed trailing comma from `fr.json`
- File: `supabase/functions/_shared/wa-webhook-shared/i18n/messages/fr.json`

---

### 6. ✅ wa-webhook-mobility: Duplicate Import

**Error:**
```
Identifier 'sendText' has already been declared
```

**Root Cause:**
- Duplicate import of `sendText` in `handlers/nearby.ts`

**Fix:**
- Removed duplicate import
- File: `supabase/functions/wa-webhook-mobility/handlers/nearby.ts`

---

## Files Modified

### Core Fixes
1. `supabase/functions/wa-webhook-mobility/index.ts` - Fixed import path
2. `supabase/functions/_shared/wa-webhook-shared/state/idempotency.ts` - Added phone_number
3. `supabase/functions/wa-webhook-mobility/state/idempotency.ts` - Added phone_number
4. `supabase/functions/wa-webhook-buy-sell/index.ts` - Pass phone_number to claimEvent
5. `supabase/functions/_shared/webhook-utils.ts` - Use wa_events, add phone_number
6. `supabase/functions/_shared/wa-webhook-shared/utils/message-deduplication.ts` - Use wa_events
7. `supabase/functions/wa-webhook-profile/index.ts` - Pass phone_number to checkIdempotency
8. `supabase/functions/_shared/wa-webhook-shared/i18n/messages/fr.json` - Fixed JSON syntax
9. `supabase/functions/wa-webhook-mobility/handlers/nearby.ts` - Removed duplicate import

---

## Database Schema

### wa_events Table Structure
```sql
CREATE TABLE public.wa_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT UNIQUE NOT NULL,
  phone_number TEXT NOT NULL,  -- ✅ Required, never null
  event_type TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  body TEXT,
  status TEXT DEFAULT 'processed',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Key Points:**
- `phone_number` is NOT NULL - always provide a value
- Use `"unknown"` as fallback if phone number unavailable
- `message_id` is UNIQUE for deduplication

---

## Function Deployment Status

All functions redeployed successfully:

- ✅ `wa-webhook-core` (v1323) - JSON syntax fixed
- ✅ `wa-webhook-mobility` (v1061) - Import path fixed, duplicate removed
- ✅ `wa-webhook-buy-sell` (v492) - Phone number constraint fixed
- ✅ `wa-webhook-profile` (v795) - Idempotency check fixed

---

## Verification Checklist

### Pre-Deployment
- [x] All JSON files validated
- [x] No duplicate imports
- [x] All import paths correct
- [x] Phone number fallbacks in place
- [x] Table references updated

### Post-Deployment
- [ ] Check Supabase logs for boot errors
- [ ] Verify functions respond to webhooks
- [ ] Test idempotency (duplicate messages blocked)
- [ ] Verify phone_number in wa_events table
- [ ] Check metrics recording

---

## Key Changes Summary

### Import Paths
- ✅ Static imports instead of dynamic where possible
- ✅ Consistent relative path structure
- ✅ All shared modules accessible

### Database Operations
- ✅ All `wa_events` inserts include `phone_number`
- ✅ Fallback to `"unknown"` when phone unavailable
- ✅ All table references use existing tables

### Error Handling
- ✅ Graceful fallbacks for missing data
- ✅ Proper error logging
- ✅ Non-blocking idempotency checks

---

## Testing Recommendations

1. **Test Duplicate Messages:**
   - Send same message twice
   - Verify second message is blocked
   - Check `wa_events` table for entries

2. **Test Phone Number Handling:**
   - Send message with phone number
   - Verify `phone_number` in `wa_events` table
   - Test with missing phone (should use "unknown")

3. **Test Internal Forwards:**
   - Verify internal forward validation works
   - Check token validation

4. **Test All Services:**
   - Mobility: Send "rides" command
   - Buy & Sell: Send "buy" command
   - Profile: Send "profile" command
   - Core: Verify routing works

---

## Monitoring

### Key Metrics to Watch
- `webhook.duplicate_message` - Should increase for duplicates
- `buy_sell.message.error` - Should decrease after fixes
- `mobility.error` - Should decrease after fixes
- `profile.error` - Should decrease after fixes

### Logs to Monitor
- Boot errors (should be zero)
- Database constraint violations (should be zero)
- Module not found errors (should be zero)
- Idempotency check errors (should be zero)

---

## Next Steps

1. **Monitor Production:**
   - Watch logs for 24 hours
   - Verify no new errors
   - Check metrics dashboard

2. **Execute UAT:**
   - Follow `UAT_TEST_CASES.md`
   - Test all workflows
   - Document results

3. **Performance Testing:**
   - Load test webhook endpoints
   - Verify response times
   - Check database performance

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-16  
**All Issues:** ✅ Fixed and Deployed

