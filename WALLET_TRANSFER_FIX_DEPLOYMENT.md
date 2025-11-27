# Wallet Token Transfer - Fix Deployment Guide

**Date**: 2025-11-27  
**Issue**: Token transfers fail silently - no response after partner selection and amount input  
**Status**: 🔴 CRITICAL - Blocking core wallet functionality

---

## 🔍 Issues Fixed

### 1. **Broken Database Function** (CRITICAL)
- Migration `20251123152000_add_wallet_transfer_rpc.sql` called non-existent `wallet_transfer()` function
- Caused all transfer RPCs to fail with database error
- Users received no feedback, transfers silently failed

### 2. **Incorrect Parameter Order** 
- Code called RPC with `p_recipient` before `p_amount`
- Newer migration changed parameter order breaking compatibility
- Named parameters saved us from complete failure, but function was still broken

### 3. **Missing Error Logging**
- RPC errors swallowed by generic catch block
- No visibility into what was failing
- Added detailed error logging for diagnostics

### 4. **Array Response Handling**
- Supabase RPC returns array of rows
- Code assumed direct object access
- Added array check: `Array.isArray(result2) ? result2[0] : result2`

---

## 📦 Files Changed

### 1. New Migration
**File**: `supabase/migrations/20251127120000_fix_wallet_transfer_function.sql`
- Drops broken function version
- Restores working implementation from 20251118093000
- Correct signature: `(p_sender uuid, p_amount integer, p_recipient uuid, ...)`
- Returns: `TABLE(success boolean, reason text, transfer_id uuid, sender_tokens integer, recipient_tokens integer)`

### 2. TypeScript Handler
**File**: `supabase/functions/wa-webhook-profile/wallet/transfer.ts`

**Changes**:
1. **Line 252-257**: Fixed parameter order
   ```typescript
   // BEFORE
   {
     p_sender: ctx.profileId,
     p_recipient: recipient.user_id,
     p_amount: amount,
     p_idempotency_key: idempotencyKey,
   }
   
   // AFTER
   {
     p_sender: ctx.profileId,
     p_amount: amount,  // ← Moved up
     p_recipient: recipient.user_id,
     p_idempotency_key: idempotencyKey,
   }
   ```

2. **Line 258-270**: Added detailed error logging
   ```typescript
   if (err2) {
     console.error(JSON.stringify({
       event: "WALLET_TRANSFER_RPC_ERROR",
       error: err2.message,
       details: err2.details,
       hint: err2.hint,
       code: err2.code,
       sender: ctx.profileId,
       recipient: recipient.user_id,
       amount
     }));
     throw err2;
   }
   ```

3. **Line 273**: Handle array response
   ```typescript
   const result = Array.isArray(result2) ? result2[0] : result2;
   const ok = result?.success === true;
   ```

4. **Line 278-281**: Log full transfer details
   ```typescript
   transfer_id: result?.transfer_id,
   sender_tokens: result?.sender_tokens,
   recipient_tokens: result?.recipient_tokens,
   ```

5. **Line 308**: Use `result` instead of `result2`

---

## 🚀 Deployment Steps

### Step 1: Apply Database Migration
```bash
cd /Users/jeanbosco/workspace/easymo-

# Apply the fix migration
supabase db push

# Or manually apply:
psql $DATABASE_URL -f supabase/migrations/20251127120000_fix_wallet_transfer_function.sql
```

### Step 2: Deploy Edge Function
```bash
# Deploy wa-webhook-profile with fixes
supabase functions deploy wa-webhook-profile

# Or deploy all profile-related functions
supabase functions deploy wa-webhook-profile \
  --project-ref YOUR_PROJECT_REF
```

### Step 3: Verify Deployment
```bash
# Check function exists and has correct signature
psql $DATABASE_URL -c "
  SELECT 
    p.proname, 
    pg_catalog.pg_get_function_arguments(p.oid) as arguments,
    pg_catalog.pg_get_function_result(p.oid) as result
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' 
    AND p.proname = 'wallet_transfer_tokens';
"

# Expected output:
# proname                | arguments                                                          | result
# -----------------------|--------------------------------------------------------------------|---------
# wallet_transfer_tokens | p_sender uuid, p_amount integer, p_recipient uuid DEFAULT NULL,... | TABLE(...)
```

### Step 4: Test Transfer Flow

#### Test 1: Partner Transfer
```
User → WhatsApp:
1. Type "wallet"
2. Select "Transfer"
3. Select a partner from list
4. Type amount: "5000"
5. ✅ Should see: "Sent 5000 tokens to [Partner Name]"
```

#### Test 2: Manual Recipient
```
User → WhatsApp:
1. Type "transfer"
2. Select "Enter number manually"
3. Type: "+250788123456"
4. Type amount: "3000"
5. ✅ Should see: "Sent 3000 tokens to +250788123456"
```

#### Test 3: Insufficient Balance
```
User → WhatsApp:
1. Type "transfer"
2. Select partner
3. Type amount greater than balance: "999999"
4. ✅ Should see: "Insufficient balance. You have X tokens."
```

#### Test 4: Minimum Balance Check
```
User → WhatsApp (with <2000 tokens):
1. Type "transfer"
2. ✅ Should see: "You need at least 2000 tokens to transfer."
```

---

## 🧪 Verification Queries

### Check Recent Transfers
```sql
SELECT 
  t.id,
  t.sender_profile,
  t.recipient_profile,
  t.amount_tokens,
  t.status,
  t.created_at,
  t.idempotency_key,
  s.display_name as sender_name,
  r.display_name as recipient_name
FROM wallet_transfers t
LEFT JOIN profiles s ON s.user_id = t.sender_profile
LEFT JOIN profiles r ON r.user_id = t.recipient_profile
ORDER BY t.created_at DESC
LIMIT 10;
```

### Check Wallet Balances
```sql
SELECT 
  p.whatsapp_e164,
  p.display_name,
  w.tokens,
  w.updated_at
FROM wallet_accounts w
JOIN profiles p ON p.user_id = w.profile_id
WHERE p.whatsapp_e164 IN ('+35677186193', '+250788123456')  -- Replace with test numbers
ORDER BY w.tokens DESC;
```

### Check Transfer Entries (Double-Entry Ledger)
```sql
SELECT 
  e.id,
  t.id as transfer_id,
  p.whatsapp_e164,
  p.display_name,
  e.amount_tokens,
  e.description,
  e.occurred_at
FROM wallet_entries e
JOIN wallet_transfers t ON t.id = e.transfer_id
JOIN profiles p ON p.user_id = e.profile_id
ORDER BY e.occurred_at DESC
LIMIT 20;
```

---

## 🔒 Rollback Plan

If issues occur:

### Option 1: Revert Migration
```bash
# Restore previous function (though it was also broken)
psql $DATABASE_URL -c "
  DROP FUNCTION IF EXISTS public.wallet_transfer_tokens(uuid, integer, uuid, text, text);
"

# Manually recreate from 20251118093000_wallet_double_entry.sql
psql $DATABASE_URL -f supabase/migrations/20251118093000_wallet_double_entry.sql
```

### Option 2: Hotfix via RPC
```sql
-- Quick fix: Add missing parameter validation
CREATE OR REPLACE FUNCTION public.wallet_transfer_tokens(
  p_sender uuid,
  p_amount integer,
  p_recipient uuid DEFAULT NULL,
  p_recipient_whatsapp text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS TABLE(success boolean, reason text, transfer_id uuid, sender_tokens integer, recipient_tokens integer)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Add emergency logging
  RAISE NOTICE 'Transfer attempt: sender=%, amount=%, recipient=%', p_sender, p_amount, p_recipient;
  
  -- Call original implementation
  RETURN QUERY SELECT * FROM public.wallet_transfer_tokens(p_sender, p_amount, p_recipient, p_recipient_whatsapp, p_idempotency_key);
END;
$$;
```

---

## 📊 Monitoring

### Key Metrics to Watch

1. **Transfer Success Rate**
   ```sql
   SELECT 
     COUNT(*) FILTER (WHERE status = 'committed') as successful,
     COUNT(*) FILTER (WHERE status != 'committed') as failed,
     COUNT(*) as total,
     ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'committed') / NULLIF(COUNT(*), 0), 2) as success_rate_pct
   FROM wallet_transfers
   WHERE created_at > now() - interval '1 hour';
   ```

2. **Average Transfer Amount**
   ```sql
   SELECT 
     AVG(amount_tokens) as avg_amount,
     MIN(amount_tokens) as min_amount,
     MAX(amount_tokens) as max_amount,
     COUNT(*) as transfer_count
   FROM wallet_transfers
   WHERE created_at > now() - interval '24 hours';
   ```

3. **Error Logs**
   ```bash
   # Check Supabase logs for errors
   supabase functions logs wa-webhook-profile --tail
   
   # Filter for transfer errors
   supabase functions logs wa-webhook-profile | grep -i "WALLET_TRANSFER"
   ```

---

## ✅ Success Criteria

- [ ] Migration applied successfully
- [ ] Edge function deployed
- [ ] Test transfers complete end-to-end
- [ ] Balances update correctly in database
- [ ] Notifications sent to recipients
- [ ] Error messages clear and helpful
- [ ] Logs show detailed transfer events
- [ ] No regressions in other wallet features
- [ ] Performance < 2s per transfer
- [ ] Zero errors in production logs for 1 hour

---

## 📝 Additional Notes

### Why This Happened

1. **Migration 20251123152000** was created to "improve" the transfer function
2. Assumed a `wallet_transfer()` core function existed (it didn't)
3. Changed parameter order without updating calling code
4. No integration tests caught the breaking change
5. Error handling hid the real issue

### Prevention

1. **Add Integration Tests**
   - Create `wallet/transfer.test.ts` with full flow tests
   - Mock Supabase RPC responses
   - Test error scenarios

2. **Migration Checklist**
   - [ ] Function exists before calling
   - [ ] Parameter types match
   - [ ] Return types compatible with callers
   - [ ] Test migration in staging
   - [ ] Review all usages of modified functions

3. **Better Error Handling**
   - Log RPC errors before throwing
   - Include error details (code, hint, details)
   - Alert on critical wallet errors

---

## 🆘 Support

If issues persist after deployment:

1. Check logs: `supabase functions logs wa-webhook-profile --tail`
2. Verify function signature: `psql $DATABASE_URL -c "\df wallet_transfer_tokens"`
3. Test RPC directly:
   ```sql
   SELECT * FROM wallet_transfer_tokens(
     'sender-uuid'::uuid,
     5000,
     'recipient-uuid'::uuid,
     NULL,
     'test-key-123'
   );
   ```
4. Contact: Platform team or check `#wallet-transfers` channel

---

**Deployed By**: _____________  
**Deployed At**: _____________  
**Verified By**: _____________  
**Status**: ☐ Success ☐ Issues ☐ Rolled Back
