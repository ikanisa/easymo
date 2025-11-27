# Wallet Token Transfer - Deep Review & Issue Analysis

**Date**: 2025-11-27  
**Issue**: Token transfers not working - no response after selecting partner and amount

---

## 🔴 CRITICAL ISSUES IDENTIFIED

### 1. **Function Signature Mismatch** (BLOCKING)
**Location**: `supabase/migrations/`

There are **TWO DIFFERENT** `wallet_transfer_tokens` functions:

#### Function A (20251118093000_wallet_double_entry.sql - Line 109)
```sql
CREATE OR REPLACE FUNCTION public.wallet_transfer_tokens(
  p_sender uuid,
  p_amount integer,
  p_recipient uuid DEFAULT NULL,
  p_recipient_whatsapp text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS TABLE(success boolean, reason text, transfer_id uuid, sender_tokens integer, recipient_tokens integer)
```

#### Function B (20251123152000_add_wallet_transfer_rpc.sql - Line 7)
```sql
CREATE OR REPLACE FUNCTION public.wallet_transfer_tokens(
  p_sender uuid,
  p_recipient_whatsapp text DEFAULT NULL,
  p_amount integer,
  p_idempotency_key text DEFAULT NULL,
  p_recipient uuid DEFAULT NULL
)
RETURNS TABLE(success boolean, reason text, transfer_id uuid, recipient_profile uuid, recipient_tokens integer)
```

**DIFFERENCE**: Parameter order changed! `p_amount` moved from 2nd to 3rd position.

#### Code Calling (transfer.ts Line 252)
```typescript
const { data: result2, error: err2 } = await ctx.supabase.rpc("wallet_transfer_tokens", {
  p_sender: ctx.profileId,
  p_recipient: recipient.user_id,  // Named params but wrong function!
  p_amount: amount,
  p_idempotency_key: idempotencyKey,
});
```

**PROBLEM**: The newer migration (20251123152000) replaces Function A, but expects different parameters. The code is calling with named parameters, which should work, BUT:

1. Function B also calls `wallet_transfer()` which doesn't exist!
2. Function B returns different columns (`recipient_profile` vs `sender_tokens`)

---

### 2. **Missing Core Function** (BLOCKING)
**Location**: 20251123152000_add_wallet_transfer_rpc.sql Line 75

```sql
SELECT * FROM public.wallet_transfer(
  p_from := v_sender,
  p_to := v_recipient_id,
  p_amount := p_amount,
  p_reason := 'transfer',
  p_meta := jsonb_build_object('idempotency_key', ...)
)
```

**ERROR**: Function `public.wallet_transfer()` **DOES NOT EXIST** in any migration!

---

### 3. **Auto-Share Button Interference** (MINOR - UI/UX)
**Location**: `_shared/wa-webhook-shared/utils/reply.ts` Lines 36-54

When showing "How many tokens to send?", the code provides:
```typescript
[{ id: IDS.BACK_MENU, title: "Cancel" }]
```

The `sendButtonsMessage` function automatically adds "Share easyMO" button when buttons < 3:
```typescript
if (canAutoShare) {
  augmented.push({
    id: IDS.SHARE_EASYMO,
    title: t(ctx.locale, "common.buttons.share_easymo"),
  });
}
```

**Result**: User sees "Cancel" + "🔗 Share easyMO" buttons, which is confusing when expecting numeric input.

---

### 4. **State Handling Works Correctly** ✅
**Location**: `wa-webhook-profile/index.ts` Line 613

```typescript
else if (state?.key === "wallet_transfer") {
  const { handleWalletTransferText } = await import("./wallet/transfer.ts");
  handled = await handleWalletTransferText(ctx, (message.text as any)?.body ?? "", state as any);
}
```

The text handler is properly wired. The issue is the transfer never executes due to RPC failure.

---

## 📊 LOG ANALYSIS

From the provided logs:
```json
{"timestamp":"2025-11-27T11:28:40.393Z","event":"PROFILE_STATE","level":"info","key":"wallet_transfer"}
{"timestamp":"2025-11-27T11:28:40.393Z","event":"PROFILE_INTERACTION","id":"partner::244a9a34-aa7e-48c6-a2fb-7f40babfd54e"}
```

**What happened**:
1. ✅ User selected partner `244a9a34-aa7e-48c6-a2fb-7f40babfd54e`
2. ✅ State set to `wallet_transfer` with `stage: "amount"`
3. ✅ Prompt sent: "How many tokens to send to easyMO Petro"
4. ❌ User likely typed amount, but RPC failed silently
5. ❌ No error logged because exception was swallowed in catch block

---

## 🔧 ROOT CAUSE

**Primary**: The newer migration (20251123152000) attempts to call `public.wallet_transfer()` which doesn't exist. This causes the RPC to fail.

**Secondary**: Function signature inconsistency between migrations means even if we fix the missing function, the return types don't match what the code expects.

---

## ✅ RECOMMENDED FIXES

### Fix 1: Remove Broken Migration (CRITICAL)
The migration `20251123152000_add_wallet_transfer_rpc.sql` is fundamentally broken:
- Calls non-existent `wallet_transfer()` function
- Inconsistent with existing working implementation
- Should be **REVERTED** or **REPLACED**

### Fix 2: Use Working Implementation
The original function in `20251118093000_wallet_double_entry.sql` (Lines 109-201) is **complete and functional**:
- Implements full double-entry accounting
- Has proper idempotency checks
- Handles account locking correctly
- Returns correct response structure

**Action**: Keep Function A, remove Function B

### Fix 3: Update Code to Match Function A
**File**: `supabase/functions/wa-webhook-profile/wallet/transfer.ts`  
**Line**: 252

Change from:
```typescript
const { data: result2, error: err2 } = await ctx.supabase.rpc("wallet_transfer_tokens", {
  p_sender: ctx.profileId,
  p_recipient: recipient.user_id,
  p_amount: amount,
  p_idempotency_key: idempotencyKey,
});
```

To (matching Function A signature):
```typescript
const { data: result2, error: err2 } = await ctx.supabase.rpc("wallet_transfer_tokens", {
  p_sender: ctx.profileId,
  p_amount: amount,
  p_recipient: recipient.user_id,
  p_idempotency_key: idempotencyKey,
});
```

**Also update line 260** to handle correct return structure:
```typescript
const ok = result2?.[0]?.success === true;  // Function A returns array
```

And lines 267-268:
```typescript
transfer_id: result2?.[0]?.transfer_id,
```

And lines 295-300:
```typescript
reason: result2?.[0]?.reason || "unknown"
```

### Fix 4: Improve Error Logging
**File**: `supabase/functions/wa-webhook-profile/wallet/transfer.ts`  
**Lines**: 258, 313-329

Add error details BEFORE the generic catch:
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

### Fix 5: Disable Auto-Share for State-Based Flows (OPTIONAL)
**File**: `_shared/wa-webhook-shared/utils/reply.ts`  
**Lines**: 40-44

Update condition:
```typescript
const canAutoShare = Boolean(
  !hasAdmin &&
    augmented.length < 3 &&
    ctx.profileId &&
    !ctx.state?.key?.includes('transfer') &&  // Don't auto-share during transfers
    !ctx.state?.key?.includes('amount')       // or amount inputs
);
```

---

## 🧪 TESTING CHECKLIST

After fixes, test:
1. ✅ Start transfer flow (`💎 Wallet` → `Transfer`)
2. ✅ Select partner from list
3. ✅ Enter amount (e.g., "5000")
4. ✅ Verify sender balance decreases
5. ✅ Verify recipient balance increases
6. ✅ Check notification sent to recipient
7. ✅ Test insufficient balance error
8. ✅ Test minimum 2000 token requirement
9. ✅ Test idempotency (send same amount twice with same key)
10. ✅ Test manual recipient (phone number entry)

---

## 🚨 DEPLOYMENT PRIORITY

**CRITICAL** - Blocking feature. Users cannot transfer tokens.

**Estimated Fix Time**: 15 minutes  
**Risk Level**: LOW (reverting to working implementation)  
**User Impact**: HIGH (core wallet functionality broken)

---

## 📝 ADDITIONAL OBSERVATIONS

1. **Idempotency Check Flawed**: Line 66-70 in 20251123152000 checks `description ILIKE` which won't work reliably
2. **Security**: Both functions use `SECURITY DEFINER` correctly
3. **Permissions**: Grants are proper for `service_role` and `authenticated`
4. **Notification**: Recipient notification logic at line 286 is correct
5. **Fraud Check**: Lines 210-218 implement fraud detection correctly

---

## 💡 MIGRATION STRATEGY

**Option A - Quick Fix (Recommended)**:
1. Create new migration that reverts 20251123152000
2. Ensure 20251118093000 function is active
3. Update transfer.ts to use correct parameter order
4. Deploy and test

**Option B - Complete Refactor**:
1. Create unified `wallet_transfer()` core function
2. Update `wallet_transfer_tokens()` to call it
3. Standardize all wallet operations
4. Add comprehensive tests

**Recommendation**: Use Option A for immediate fix, plan Option B for next sprint.

---

**Status**: READY FOR FIX  
**Next Action**: Create migration to revert broken function + update TypeScript code
