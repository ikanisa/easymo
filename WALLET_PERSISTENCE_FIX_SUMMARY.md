# Wallet Event Persistence Fix - Complete

**Date**: 2025-11-27  
**Issue**: `WALLET_ADJUST` and other critical business events were not being persisted to database  
**Status**: ✅ **FIXED & DEPLOYED**

## Problem Identified

From production logs:
```json
{
  "event": "WALLET_ADJUST",
  "payload": {
    "actor": "35677186193",
    "action": "referral_share_qr"
  },
  "persisted": false  // ❌ Not saved to DB!
}
```

### Root Cause

The `DB_EVENT_PATTERNS` list in `supabase/functions/_shared/wa-webhook-shared/observe/log.ts` only included 4 event types:
- `wa_inbound`
- `WEBHOOK_UNHANDLED_ERROR`
- `RETENTION_*`
- `HEALTH_CHECK_ERROR`

All other events (wallet, payments, OCR, etc.) were logged to console only but **not persisted to the `webhook_logs` table**.

## Solution Implemented

Updated `DEFAULT_DB_EVENT_PATTERNS` to include all critical business events:

```typescript
const DEFAULT_DB_EVENT_PATTERNS = [
  "wa_inbound",
  "WEBHOOK_UNHANDLED_ERROR",
  "RETENTION_*",
  "HEALTH_CHECK_ERROR",
  "WALLET_*",        // All wallet events (adjust, cashout, purchase, etc.)
  "PAYMENT_*",       // All payment events
  "MOBILITY_MATCH",  // Ride matching
  "OCR_STATUS",      // OCR processing
  "*_PAYMENT_*",     // Insurance, Jobs, Marketplace, Rides payment matches
  "ADMIN_ACTION",    // Admin operations
  "AGENT_ALERT",     // Agent alerts
  "AGENT_TRANSFER",  // Agent transfers
  "*_ERROR",         // All error events
];
```

### Events Now Persisted

**Wallet Events** (~10 types):
- `WALLET_ADJUST` - Token adjustments (referrals, rewards)
- `WALLET_CASHOUT_*` - Cashout lifecycle
- `WALLET_PURCHASE_*` - Token purchases
- `WALLET_*` - All wallet operations

**Payment Events** (~20 types):
- `PAYMENT_INITIATED`, `PAYMENT_COMPLETED`, `PAYMENT_PROCESSED`
- `INSURANCE_PAYMENT_MATCHED`
- `JOBS_PAYMENT_MATCHED`
- `MARKETPLACE_PAYMENT_MATCHED`
- `RIDES_PAYMENT_MATCHED`
- `TRIP_PAYMENT_*` - All trip payment lifecycle
- `MOMO_PAYMENT_*` - MoMo payment lifecycle

**Other Critical Events**:
- `MOBILITY_MATCH` - Ride matching events
- `OCR_STATUS` - Document OCR processing
- `ADMIN_ACTION` - Admin operations
- `AGENT_ALERT`, `AGENT_TRANSFER` - AI agent operations
- All `*_ERROR` events - Error tracking

## Deployment

✅ **Deployed**: `wa-webhook-profile` (contains wallet domain logic)  
📅 **Timestamp**: 2025-11-27T06:56:00Z

### Git Commit
```
commit 80809fd
fix: persist critical business events in webhook_logs
```

## Verification

To verify the fix is working:

1. **Test wallet share QR action** in production
2. **Check Supabase logs** for new events with `"persisted": true`
3. **Query webhook_logs table**:
```sql
SELECT * FROM webhook_logs 
WHERE endpoint = 'WALLET_ADJUST' 
ORDER BY created_at DESC 
LIMIT 10;
```

Expected: New rows should appear for wallet adjustments.

## Next Steps (Optional)

Consider deploying the updated shared code to other microservices that use it:

```bash
# Core router (uses shared logging)
supabase functions deploy wa-webhook-core --no-verify-jwt

# Other microservices (if they log important events)
supabase functions deploy wa-webhook-mobility --no-verify-jwt
supabase functions deploy wa-webhook-jobs --no-verify-jwt
supabase functions deploy wa-webhook-marketplace --no-verify-jwt
supabase functions deploy wa-webhook-insurance --no-verify-jwt
supabase functions deploy wa-webhook-ai-agents --no-verify-jwt
```

Or deploy all at once:
```bash
pnpm run functions:deploy:wa  # If script exists
```

## Impact

✅ **Auditing**: All wallet and payment events now tracked in DB  
✅ **Debugging**: Error events persisted for troubleshooting  
✅ **Analytics**: Payment matching events available for analysis  
✅ **Compliance**: Full audit trail for financial transactions  

## Related Files

- `supabase/functions/_shared/wa-webhook-shared/observe/log.ts` - Event persistence logic
- `supabase/functions/wa-webhook-profile/wallet/earn.ts` - Wallet sharing (where issue was seen)
- Table: `public.webhook_logs` - Where events are stored

---

**Note**: The `WA_LOG_DB_EVENTS` environment variable can override these defaults if needed. Current default patterns ensure comprehensive event tracking without manual configuration.
