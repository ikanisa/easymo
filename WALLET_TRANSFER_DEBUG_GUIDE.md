# Wallet Transfer Debugging Guide

## Issue Reported
**Date:** 2025-11-27 09:23 AM  
**Problem:** When transferring tokens, user doesn't get response message and recipient doesn't receive notification or tokens.

## Symptoms
1. ❌ User selects partner to send tokens to
2. ❌ User sees "How many tokens to send to SP Test Petro?"
3. ❌ User enters amount (e.g., "100")
4. ❌ **No response message received**
5. ❌ **Recipient not notified**
6. ❌ **Recipient wallet not credited**

## Root Cause Analysis

### Code Flow
```
User Message Flow:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. User taps "Transfer Tokens" 
   → startWalletTransfer() called
   → Shows partner list

2. User selects partner (e.g., "partner::54dc759b...")
   → handleWalletTransferSelection() called
   → Sets state: { stage: "amount", to: "+250...", idem: "uuid" }
   → Sends: "How many tokens to send to SP Test Petro?"

3. User types amount (e.g., "100")
   → Message type: "text"
   → index.ts line 613-616:
      else if (state?.key === "wallet_transfer") {
        handleWalletTransferText(ctx, message.text.body, state);
      }
   → Goes to transfer.ts handleWalletTransferText()
   
4. handleWalletTransferText() processes amount
   → Line 175: if (data.stage === "amount")
   → Parses amount
   → Validates transfer
   → Calls wallet_transfer_tokens RPC
   → Should send success message
   → Should notify recipient
```

### Possible Failure Points

#### 1. State Mismatch
**Check:** Is `state.data.stage === "amount"`?
```typescript
// transfer.ts line 136
const data = state.data || { stage: "recipient" };

// Line 175
if (data.stage === "amount") {
  // Process amount
}
```

**Fix Added:** Enhanced logging to track state transitions

#### 2. Text Message Not Captured
**Check:** Is `message.text.body` properly extracted?
```typescript
// index.ts line 615
const body = (message.text as any)?.body ?? "";
```

**Potential Issue:** 
- `message.text` might be undefined
- `body` might be empty string
- Type assertion `as any` hiding issues

**Fix Added:** Log raw body and parsed amount

#### 3. RPC Call Failure
**Check:** Is `wallet_transfer_tokens` RPC succeeding?
```typescript
// transfer.ts line 277-296
const { data: result2, error: err2 } = await ctx.supabase.rpc("wallet_transfer_tokens", {
  p_sender: ctx.profileId,
  p_amount: amount,
  p_recipient: recipient.user_id,
  p_idempotency_key: idempotencyKey,
});
```

**Potential Issues:**
- RPC not found
- Permission denied
- Insufficient balance (already checked)
- Recipient not found (already checked)
- Database constraint violation

**Fix Added:** Enhanced error logging for RPC calls

#### 4. Success Message Not Sent
**Check:** Is `sendButtonsMessage()` actually being called?
```typescript
// transfer.ts line 322-326
await sendButtonsMessage(
  ctx,
  `✅ Sent ${amount} tokens to ${data.to}.`,
  [{ id: IDS.WALLET, title: "💎 Wallet" }],
);
```

**Potential Issues:**
- WhatsApp API rate limit
- Invalid `ctx.from` number
- Network timeout
- Message queueing issue

**Fix Added:** Log before and after message sending

#### 5. Notification Not Sent
**Check:** Is `notifyWalletTransferRecipient()` working?
```typescript
// transfer.ts line 337-344
notifyWalletTransferRecipient(ctx.supabase, recipient.user_id, amount, senderName)
  .catch((err) => {
    console.error(JSON.stringify({
      event: "WALLET_TRANSFER_NOTIFICATION_FAILED",
      error: err instanceof Error ? err.message : String(err),
      recipient: recipient.user_id
    }));
  });
```

**Potential Issues:**
- Recipient has no `whatsapp_e164` or `wa_id`
- WhatsApp API quota exceeded
- sendText() function failure

**Fix Added:** Log notification attempts and results

## Fixes Applied

### 1. Enhanced Logging (transfer.ts)

Added comprehensive logging at every step:

```typescript
// Entry point logging
console.log(JSON.stringify({
  event: "WALLET_TRANSFER_TEXT_HANDLER_CALLED",
  body_length: body.length,
  body_preview: body.substring(0, 50),
  state_key: state.key,
  stage: state.data?.stage,
  sender: ctx.profileId
}));

// Amount parsing logging
console.log(JSON.stringify({
  event: "WALLET_TRANSFER_AMOUNT_INPUT",
  raw_body: body,
  sender: ctx.profileId,
  recipient: data.to,
  state_data: data
}));

// Success message logging
console.log(JSON.stringify({
  event: "WALLET_TRANSFER_SENDING_SUCCESS_MESSAGE",
  to: ctx.from,
  message: `✅ Sent ${amount} tokens to ${data.to}.`
}));

console.log(JSON.stringify({
  event: "WALLET_TRANSFER_SUCCESS_MESSAGE_SENT",
  to: ctx.from
}));

// Notification logging
console.log(JSON.stringify({
  event: "WALLET_TRANSFER_SENDING_NOTIFICATION",
  recipient: recipient.user_id,
  amount,
  senderName
}));

// Notification success/failure
.then(() => {
  console.log(JSON.stringify({
    event: "WALLET_TRANSFER_NOTIFICATION_SENT",
    recipient: recipient.user_id
  }));
})
.catch((err) => {
  console.error(JSON.stringify({
    event: "WALLET_TRANSFER_NOTIFICATION_FAILED",
    error: err instanceof Error ? err.message : String(err),
    recipient: recipient.user_id
  }));
});
```

## Testing Instructions

### Test the transfer flow with enhanced logging:

1. **Trigger a transfer:**
   ```
   User: Type "home" or "hi"
   Bot: Shows main menu
   User: Tap "👤 My Account"
   Bot: Shows profile menu
   User: Tap "💎 Wallet"
   Bot: Shows wallet menu
   User: Tap "Send Tokens"
   Bot: Shows partner list
   User: Select a partner (e.g., "SP Test Petro")
   Bot: "How many tokens to send to SP Test Petro?"
   User: Type amount (e.g., "100")
   Bot: Should respond with "✅ Sent 100 tokens to..."
   ```

2. **Check Supabase Logs:**
   ```bash
   # Open Supabase Dashboard
   https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/functions
   
   # Select: wa-webhook-profile
   # View: Logs tab
   # Look for these events in order:
   
   ✅ WALLET_TRANSFER_TEXT_HANDLER_CALLED
      body_length: 3
      body_preview: "100"
      state_key: "wallet_transfer"
      stage: "amount"
      
   ✅ WALLET_TRANSFER_AMOUNT_INPUT
      raw_body: "100"
      recipient: "+250..."
      
   ✅ WALLET_TRANSFER_RPC_RESPONSE
      success_field: true
      transfer_id: "uuid..."
      
   ✅ WALLET_TRANSFER_SENDING_SUCCESS_MESSAGE
      to: "35677186193"
      message: "✅ Sent 100 tokens to..."
      
   ✅ WALLET_TRANSFER_SUCCESS_MESSAGE_SENT
      to: "35677186193"
      
   ✅ WALLET_TRANSFER_SENDING_NOTIFICATION
      recipient: "uuid..."
      amount: 100
      
   ✅ WALLET_TRANSFER_NOTIFICATION_SENT
      recipient: "uuid..."
   ```

3. **If logs show failures, check:**

   **If missing WALLET_TRANSFER_TEXT_HANDLER_CALLED:**
   - State key is wrong (not "wallet_transfer")
   - Message not being routed to handler
   - Check index.ts line 613-616

   **If missing WALLET_TRANSFER_AMOUNT_INPUT:**
   - Stage is not "amount"
   - Check handleWalletTransferSelection() set state correctly

   **If WALLET_TRANSFER_RPC_ERROR:**
   - Check RPC exists: `wallet_transfer_tokens`
   - Check RPC permissions
   - Check sender has sufficient balance
   - Check recipient exists

   **If WALLET_TRANSFER_SENDING_SUCCESS_MESSAGE but no message:**
   - WhatsApp API issue
   - Check sendButtonsMessage() implementation
   - Check ctx.from is valid

   **If WALLET_TRANSFER_NOTIFICATION_FAILED:**
   - Recipient has no WhatsApp number in profiles
   - sendText() function error
   - WhatsApp API quota exceeded

## Database Checks

### Verify transfer was recorded:

```sql
-- Check sender's wallet_transactions
SELECT * FROM wallet_transactions
WHERE profile_id = 'sender_user_id'
ORDER BY created_at DESC
LIMIT 5;

-- Check recipient's wallet_transactions
SELECT * FROM wallet_transactions
WHERE profile_id = 'recipient_user_id'
ORDER BY created_at DESC
LIMIT 5;

-- Check wallet balances
SELECT 
  p.display_name,
  p.whatsapp_e164,
  w.tokens,
  w.updated_at
FROM profiles p
JOIN wallet_accounts w ON w.profile_id = p.user_id
WHERE p.user_id IN ('sender_id', 'recipient_id');

-- Check wallet_transfers table (if exists)
SELECT * FROM wallet_transfers
WHERE sender_id = 'sender_user_id'
  OR recipient_id = 'recipient_user_id'
ORDER BY created_at DESC
LIMIT 5;
```

### Verify RPC exists:

```sql
-- Check if wallet_transfer_tokens RPC exists
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_name = 'wallet_transfer_tokens'
  AND routine_schema = 'public';

-- If exists, check signature
SELECT 
  proname AS function_name,
  pg_get_function_arguments(oid) AS arguments
FROM pg_proc
WHERE proname = 'wallet_transfer_tokens';
```

## Expected Log Sequence

```json
{"event":"PROFILE_MESSAGE_PROCESSING","from":"35677186193","type":"text","hasProfile":true}
{"event":"PROFILE_STATE","key":"wallet_transfer"}
{"event":"WALLET_TRANSFER_TEXT_HANDLER_CALLED","body_length":3,"body_preview":"100","state_key":"wallet_transfer","stage":"amount","sender":"49c7130e-33e8-46db-a631-74df6ff74483"}
{"event":"WALLET_TRANSFER_AMOUNT_INPUT","raw_body":"100","sender":"49c7130e-33e8-46db-a631-74df6ff74483","recipient":"+250788123456","state_data":{"stage":"amount","to":"+250788123456","idem":"uuid..."}}
{"event":"WALLET_TRANSFER_RPC_RESPONSE","raw_response":[{"success":true,"transfer_id":"uuid...","sender_tokens":900,"recipient_tokens":100}],"unwrapped":{"success":true,"transfer_id":"uuid...","sender_tokens":900,"recipient_tokens":100},"success_field":true}
{"event":"WALLET_TRANSFER_SUCCESS","sender":"49c7130e-33e8-46db-a631-74df6ff74483","recipient":"recipient_user_id","amount":100,"transfer_id":"uuid...","sender_tokens":900,"recipient_tokens":100}
{"event":"WALLET_TRANSFER_SENDING_SUCCESS_MESSAGE","to":"35677186193","message":"✅ Sent 100 tokens to +250788123456."}
{"event":"WALLET_TRANSFER_SUCCESS_MESSAGE_SENT","to":"35677186193"}
{"event":"WALLET_TRANSFER_SENDING_NOTIFICATION","recipient":"recipient_user_id","amount":100,"senderName":"John Doe"}
{"event":"WALLET_TRANSFER_NOTIFICATION_SENT","recipient":"recipient_user_id"}
```

## Quick Fixes

### If issue persists after logging reveals the problem:

1. **Clear stuck state:**
   ```sql
   -- Clear wallet_transfer state for user
   UPDATE whatsapp_user_state
   SET state_data = NULL
   WHERE profile_id = 'user_id'
     AND (state_data->>'key') = 'wallet_transfer';
   ```

2. **Manually credit recipient (emergency):**
   ```sql
   -- Only if transfer was deducted from sender but not credited to recipient
   UPDATE wallet_accounts
   SET tokens = tokens + 100,
       updated_at = NOW()
   WHERE profile_id = 'recipient_user_id';
   
   -- Log the manual adjustment
   INSERT INTO wallet_transactions (profile_id, amount, type, description)
   VALUES ('recipient_user_id', 100, 'ADMIN_ADJUSTMENT', 'Manual credit - transfer issue');
   ```

3. **Check WhatsApp API status:**
   ```bash
   # Check if sendText is working
   curl -X POST "https://graph.facebook.com/v18.0/PHONE_NUMBER_ID/messages" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "messaging_product": "whatsapp",
       "to": "RECIPIENT_WA_ID",
       "type": "text",
       "text": { "body": "Test message" }
     }'
   ```

## Deployment

**Status:** ✅ Enhanced logging deployed  
**Version:** wa-webhook-profile v2.1.0  
**Deployed:** 2025-11-27 12:53 UTC  
**Changes:**
- Added 10+ new log events for transfer flow
- Enhanced error tracking
- Better state transition visibility
- Notification success/failure tracking

## Next Steps

1. **Test the transfer again** with a real user
2. **Monitor Supabase logs** in real-time during test
3. **Identify the exact failure point** from logs
4. **Apply targeted fix** based on log findings
5. **Verify recipient receives tokens and notification**

## Support

If issue persists after following this guide:

1. Collect logs from Supabase Dashboard
2. Check database state (run SQL queries above)
3. Verify RPC exists and has correct permissions
4. Test WhatsApp API directly
5. Contact support with collected logs

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-27 12:53 UTC  
**Author:** AI Assistant  
**Related Files:** 
- `supabase/functions/wa-webhook-profile/wallet/transfer.ts`
- `supabase/functions/wa-webhook-profile/index.ts`
- `supabase/functions/wa-webhook-profile/wallet/notifications.ts`
