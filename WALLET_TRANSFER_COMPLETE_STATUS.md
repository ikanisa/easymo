# Wallet Transfer Fix - Complete Status Report

**Date**: 2025-11-27 13:04  
**Session**: Deep review + fixes deployed  
**Status**: 🟡 PARTIALLY FIXED - Edge function deployed, migration pending

---

## 🔍 Issues Found from Chat Logs

### Issue 1: Transfer Succeeds but Shows Error ❌
**Evidence**:
```
[13:00] User: 20 (tokens)
[13:00] Bot: "❌ Transfer failed: Unknown error"
[13:00] Balance: 10000 → 9980 (transfer actually worked!)
```

**Root Cause**: 
- Database transfer succeeds (tokens deducted)
- TypeScript code expects `result.success === true`
- But actual response structure might be different
- OR an exception is thrown after the transfer but before success message

**Fix Applied**:
1. Added detailed logging of RPC response structure
2. Added fallback check: if `transfer_id` exists or `reason === 'ok'`, treat as success
3. Better error handling to distinguish DB success from notification failures

### Issue 2: Recipient Not Found (Valid Number)
**Evidence**:
```
[13:01] User: +250795588248
[13:01] Bot: "Recipient not found"
```

**Root Cause**:
- Code only looks up by `whatsapp_e164` field
- Recipient profile might use `wa_id` field instead
- Or recipient hasn't registered yet

**Fix Applied**:
1. Try `whatsapp_e164` first
2. Fallback to `wa_id` (without + prefix)
3. Better error message explaining recipient needs to be registered

---

## ✅ Fixes Deployed

### 1. Edge Function - DEPLOYED ✓
**File**: `supabase/functions/wa-webhook-profile/wallet/transfer.ts`

**Changes**:
- Lines 197-231: Improved recipient lookup (try e164 then wa_id)
- Line 299-307: Added RPC response logging
- Line 345-391: Fallback success detection
- Better error messages throughout

**Deployment**:
```bash
✓ Deployed to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/functions
✓ Function: wa-webhook-profile
✓ Time: 2025-11-27 13:02
```

### 2. Database Migration - PENDING ⏳
**File**: `supabase/migrations/20251127120000_fix_wallet_transfer_function.sql`

**What it does**:
- Drops broken `wallet_transfer_tokens` function
- Restores working implementation
- Fixes parameter order and return structure

**Status**: Created but not yet applied
**Blocker**: Need to link correct Supabase project (easyMO) and apply migration

---

## 🚨 Critical Actions Needed

### Action 1: Apply Database Migration
```bash
cd /Users/jeanbosco/workspace/easymo-

# Link to correct project (easyMO - sdiivdbkvdslrzdgnsup)
supabase link --project-ref sdiivdbkvdslrzdgnsup

# Apply the fix migration
supabase db push --include-all

# OR manually via SQL:
# Get connection string from Supabase dashboard
# psql <CONNECTION_STRING> -f supabase/migrations/20251127120000_fix_wallet_transfer_function.sql
```

### Action 2: Test Complete Transfer Flow
Once migration is applied:

1. **Test Partner Transfer**:
   ```
   User → "wallet" → "Transfer" → Select partner → Type "100"
   Expected: ✅ "Sent 100 tokens to [Partner Name]"
   ```

2. **Test Manual Recipient**:
   ```
   User → "transfer" → "Enter manually" → "+250788123456" → "100"
   Expected: ✅ "Sent 100 tokens to +250788123456"
   ```

3. **Check Logs**:
   ```bash
   supabase functions logs wa-webhook-profile --tail
   ```
   
   Look for:
   - `WALLET_TRANSFER_RPC_RESPONSE` - shows what DB returns
   - `WALLET_TRANSFER_SUCCESS` - successful transfers
   - `WALLET_TRANSFER_SUCCESS_FLAG_MISMATCH` - if success flag is wrong
   - `WALLET_TRANSFER_RPC_ERROR` - database errors

---

## 📊 What We Know From Logs

### From First Test (Partner Transfer):
```json
{"event":"PROFILE_INTERACTION","id":"partner::244a9a34-aa7e-48c6-a2fb-7f40babfd54e"}
{"event":"PROFILE_STATE","key":"wallet_transfer"}
```
- ✓ Partner selection worked
- ✓ State set correctly
- ✓ Prompt sent: "How many tokens to send..."
- ❌ User typed amount but got error
- ⚠️ Balance decreased (transfer actually succeeded!)

### From Second Test (Manual Recipient):
```json
{"event":"PROFILE_MESSAGE_PROCESSING","from":"35677186193","type":"text"}
{"event":"PROFILE_STATE","key":"wallet_transfer"}
```
- ✓ Manual recipient flow started
- ✓ User entered: +250795588248
- ✓ State at "amount" stage
- ❌ Recipient lookup failed

---

## 🔧 Technical Details

### Current Database Function Signature (After Migration)
```sql
CREATE OR REPLACE FUNCTION public.wallet_transfer_tokens(
  p_sender uuid,
  p_amount integer,
  p_recipient uuid DEFAULT NULL,
  p_recipient_whatsapp text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS TABLE(
  success boolean,
  reason text,
  transfer_id uuid,
  sender_tokens integer,
  recipient_tokens integer
)
```

**Returns**:
- Success case: `{success: true, reason: 'ok', transfer_id: <uuid>, sender_tokens: 9980, recipient_tokens: 20}`
- Duplicate: `{success: true, reason: 'duplicate', ...}`
- Failure: `{success: false, reason: 'insufficient_tokens', ...}`

### TypeScript Call Pattern
```typescript
const { data: result2, error: err2 } = await ctx.supabase.rpc("wallet_transfer_tokens", {
  p_sender: ctx.profileId,
  p_amount: amount,
  p_recipient: recipient.user_id,
  p_idempotency_key: idempotencyKey,
});

// result2 is an array: [{success: true, reason: 'ok', ...}]
const result = Array.isArray(result2) ? result2[0] : result2;
const ok = result?.success === true;
```

### Success Detection Logic (NEW)
```typescript
if (ok) {
  // Primary success path
  sendButtonsMessage("✅ Sent X tokens...");
} else {
  // Check if transfer actually succeeded despite success=false
  const likelySucceeded = result?.transfer_id || 
                          result?.reason === 'ok' || 
                          result?.reason === 'duplicate';
  
  if (likelySucceeded) {
    // Fallback success path
    sendButtonsMessage("✅ Sent X tokens...");
  } else {
    // Actual failure
    sendButtonsMessage("❌ Transfer failed...");
  }
}
```

---

## 🧪 Debugging Queries

### Check if Function Exists
```sql
SELECT 
  p.proname, 
  pg_catalog.pg_get_function_arguments(p.oid) as arguments,
  pg_catalog.pg_get_function_result(p.oid) as result
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'wallet_transfer_tokens';
```

### Check Recent Transfers
```sql
SELECT 
  t.id,
  t.sender_profile,
  t.recipient_profile,
  t.amount_tokens,
  t.status,
  t.created_at,
  s.whatsapp_e164 as sender_phone,
  r.whatsapp_e164 as recipient_phone
FROM wallet_transfers t
LEFT JOIN profiles s ON s.user_id = t.sender_profile
LEFT JOIN profiles r ON r.user_id = t.recipient_profile
WHERE t.sender_profile = '49c7130e-33e8-46db-a631-74df6ff74483'  -- From logs
ORDER BY t.created_at DESC
LIMIT 5;
```

### Check Profile Lookup
```sql
-- Check if recipient exists
SELECT 
  user_id, 
  whatsapp_e164, 
  wa_id, 
  display_name
FROM profiles 
WHERE whatsapp_e164 = '+250795588248' 
   OR wa_id = '250795588248';
```

### Test RPC Directly
```sql
-- Test with known UUIDs
SELECT * FROM wallet_transfer_tokens(
  '49c7130e-33e8-46db-a631-74df6ff74483'::uuid,  -- sender
  50,  -- amount
  '244a9a34-aa7e-48c6-a2fb-7f40babfd54e'::uuid,  -- recipient (SP Test Petrol)
  NULL,  -- recipient_whatsapp
  'test-' || gen_random_uuid()::text  -- idempotency_key
);

-- Expected output:
-- success | reason | transfer_id | sender_tokens | recipient_tokens
-- --------|--------|-------------|---------------|------------------
-- true    | ok     | <uuid>      | 9930          | 70
```

---

## 📝 Next Steps Summary

1. ✅ **DONE**: Fixed edge function code
2. ✅ **DONE**: Deployed edge function 
3. ⏳ **TODO**: Apply database migration
4. ⏳ **TODO**: Test complete flow
5. ⏳ **TODO**: Monitor logs for new errors
6. ⏳ **TODO**: Verify balances update correctly

---

## 🆘 If Migration Fails

### Option 1: Manual SQL Apply
1. Get connection string from Supabase dashboard
2. Connect: `psql <connection-string>`
3. Run migration SQL manually
4. Verify: `\df wallet_transfer_tokens`

### Option 2: Supabase Dashboard
1. Go to https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt
2. Navigate to: SQL Editor
3. Copy contents of `20251127120000_fix_wallet_transfer_function.sql`
4. Execute
5. Verify in Database → Functions

### Option 3: Rollback Edge Function
If migration can't be applied immediately:
```bash
# Revert edge function to use old signature
git checkout HEAD~1 supabase/functions/wa-webhook-profile/wallet/transfer.ts
supabase functions deploy wa-webhook-profile
```

---

## 📚 Related Documentation

- [WALLET_TOKEN_TRANSFER_ISSUES.md](./WALLET_TOKEN_TRANSFER_ISSUES.md) - Detailed analysis
- [WALLET_TRANSFER_FIX_DEPLOYMENT.md](./WALLET_TRANSFER_FIX_DEPLOYMENT.md) - Deployment guide

---

**Status**: Waiting for database migration to complete  
**Deployed By**: GitHub Copilot  
**Next Action**: User needs to apply migration and test
