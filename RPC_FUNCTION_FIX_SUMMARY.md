# RPC Function Fix Summary

**Date:** 2025-12-16  
**Issue:** `ensure_whatsapp_user` RPC function not visible to PostgREST

---

## Problem

The `ensure_whatsapp_user` RPC function was created via migration but PostgREST reports it as "does not exist" in the schema cache.

**Error:**
```
MOBILITY_RPC_FUNCTION_MISSING: Function does not exist
```

---

## Root Causes

1. **PostgREST Schema Cache:** PostgREST caches the database schema and may not immediately see new functions
2. **Phone Number Validation:** Short/incomplete phone numbers (like "6193") fail validation, causing fallback to also fail
3. **Error Handling:** RPC function errors not properly distinguished from "function doesn't exist" errors

---

## Fixes Applied

### 1. PostgREST Schema Cache Refresh
- Added `NOTIFY pgrst, 'reload schema';` to migration
- This triggers PostgREST to refresh its schema cache

### 2. Improved Error Detection
- Enhanced error detection in `wa-webhook-mobility/index.ts`
- Better distinction between "function doesn't exist" vs other errors
- Added error code checking (`PGRST204`)

### 3. Phone Number Validation
- Added fallback normalization for short/incomplete phone numbers
- Numbers with 4-7 digits are normalized with default country code (250)
- Allows processing to continue even with test/incomplete numbers

### 4. Enhanced Logging
- Added detailed logging for RPC function errors
- Logs error codes and messages for debugging
- Tracks when fallback is used

---

## Migration Status

✅ **Migration Applied:** `20251216110626_create_ensure_whatsapp_user.sql`
- Function created in database
- Permissions granted (service_role, authenticated, anon)
- PostgREST notification added

---

## Deployment Status

✅ **All Functions Redeployed:**
- `wa-webhook-mobility` - Enhanced error handling
- `wa-webhook-buy-sell` - Profile lookup fixed
- `wa-webhook-profile` - Uses ensureProfile with fallback
- All with `verify_jwt = false`

---

## Expected Behavior

### If RPC Function is Visible:
1. Function is called successfully
2. Returns profile data if found
3. Returns NULL if profile needs TypeScript creation
4. Falls back to `ensureProfile` if NULL

### If RPC Function is NOT Visible:
1. Error detected (function doesn't exist)
2. Logs warning: `MOBILITY_RPC_FUNCTION_MISSING`
3. Falls back to `ensureProfile` utility
4. Profile creation continues normally

### Phone Number Handling:
- Valid numbers (8+ digits): Normalized normally
- Short numbers (4-7 digits): Fallback normalization with country code
- Very short (<4 digits): Error thrown

---

## Next Steps

1. **Wait for PostgREST Cache Refresh:**
   - PostgREST should auto-refresh within a few minutes
   - The `NOTIFY` command should trigger immediate refresh
   - If still not visible after 5-10 minutes, may need manual intervention

2. **Monitor Logs:**
   - Check if `MOBILITY_RPC_FUNCTION_MISSING` errors decrease
   - Verify `PROFILE_ENSURED_VIA_RPC` events appear
   - Monitor `USING_FALLBACK_NORMALIZATION_FOR_SHORT_NUMBER` for test numbers

3. **Verify Function Exists:**
   - Can check via Supabase dashboard SQL editor:
     ```sql
     SELECT proname, pronargs, proargnames 
     FROM pg_proc 
     WHERE proname = 'ensure_whatsapp_user';
     ```

4. **Manual Schema Refresh (if needed):**
   - If function still not visible after 10 minutes:
     - Restart PostgREST (via Supabase dashboard)
     - Or wait for automatic refresh (usually within 15 minutes)

---

## Testing

### Test Cases:
1. **Valid Phone Number:**
   - Send message with full phone number (+250788123456)
   - Should use RPC function if visible
   - Should create profile successfully

2. **Short Phone Number:**
   - Send message with short number (6193)
   - Should use fallback normalization
   - Should create profile with normalized number

3. **Existing Profile:**
   - Send message from existing user
   - Should return existing profile
   - Should not create duplicate

---

## Files Modified

- `supabase/migrations/20251216110626_create_ensure_whatsapp_user.sql` - Added NOTIFY
- `supabase/functions/wa-webhook-mobility/index.ts` - Enhanced error handling
- `supabase/functions/_shared/wa-webhook-shared/state/store.ts` - Phone number fallback

---

**Status:** ✅ All fixes deployed  
**Next:** Monitor logs for RPC function visibility

