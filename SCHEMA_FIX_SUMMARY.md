# Database Schema Fix Summary

## Date: 2025-01-20

## Problem
Code was querying non-existent columns in the `profiles` table, causing 500 errors:
- `whatsapp_e164` ❌
- `phone_e164` ❌  
- `whatsapp_number` ❌

## Actual Schema
The `profiles` table only has:
- `wa_id` ✅ (WhatsApp ID, digits only)
- `phone_number` ✅ (Phone number, can be E.164 format)

## Files Fixed

### 1. `supabase/functions/_shared/database/optimized-queries.ts`
- ✅ Fixed `getProfileById` default fields
- ✅ Fixed `getProfileByPhone` to use `wa_id` and `phone_number` with OR query

### 2. `supabase/functions/_shared/cache/cached-accessors.ts`
- ✅ Fixed `getCachedProfileByPhone` to query both `wa_id` and `phone_number`

### 3. `supabase/functions/_shared/wa-webhook-shared/wallet/transfer.ts`
- ✅ Fixed recipient lookup to use `wa_id` and `phone_number`
- ✅ Updated recipient type definition
- ✅ Fixed recipient WhatsApp number retrieval

### 4. `supabase/functions/_shared/wa-webhook-shared/state/store.ts`
- ✅ Fixed `loadChatStateRow` to use `wa_id` and `phone_number`
- ✅ Updated `ProfileRecord` type definition
- ✅ Fixed `ensureProfile` return values
- ✅ Removed non-existent column references from lookup candidates
- ✅ Fixed profile update calls to only use existing columns

### 5. `supabase/functions/wa-webhook-profile/handlers/wallet.ts`
- ✅ Fixed recipient profile lookup to use `wa_id` and `phone_number`
- ✅ Removed invalid profile creation code

### 6. `supabase/functions/notify-buyers/handlers/interactive-buttons.ts`
- ✅ Fixed `getProfileContext` to query both `wa_id` and `phone_number`

### 7. `supabase/functions/wa-webhook-mobility/index.ts`
- ✅ Fixed profile lookup to use `wa_id` and `phone_number` (removed `whatsapp_e164`)

## Strategy Used

For phone lookups, we now:
1. Try `wa_id` with digits only (no +)
2. Try `phone_number` with E.164 format (+ prefix)
3. Try `phone_number` with original format as fallback

This handles both formats that might be stored in the database.

## Remaining Files to Check

Some files may still have references that need fixing:
- `supabase/functions/_shared/tool-executor.ts` (large file, may need review)
- `supabase/functions/schedule_pickup/index.ts` (has `whatsapp_e164` references)
- Other files in the codebase

## Next Steps

1. ✅ Fixed critical shared files
2. ⏳ Monitor logs to verify 500 errors are resolved
3. ⏳ Check remaining files if errors persist
4. ⏳ Test wallet transfers and profile lookups
5. ⏳ Verify all edge functions work correctly

## Testing Recommendations

1. Test WhatsApp webhook processing
2. Test wallet token transfers
3. Test profile creation/lookup
4. Monitor Supabase logs for any remaining column errors

