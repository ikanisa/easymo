# Buy & Sell System - Complete Implementation Plan

## Executive Summary
Based on comprehensive code analysis, the Buy & Sell system has:
- ✅ **2 Critical Issues Fixed** (Syntax error, Vendor outreach WhatsApp sending)
- 🟡 **4 High Priority Issues Remaining** (MoMo verification, Payment-AI integration, Idempotency, Transaction expiry)
- 🟢 **3 Medium Priority Enhancements** (Code consolidation, Order tracking, Rate limiting)

---

## 🎯 Phase 1: COMPLETED ✅

### 1. Node.js Agent Syntax Error ✅
**Status**: Fixed and deployed
**File**: `packages/agents/src/agents/commerce/buy-and-sell.agent.ts`
**Commit**: `982aeb05`

### 2. Vendor Outreach WhatsApp Sending ✅
**Status**: Implemented and deployed
**File**: `supabase/functions/wa-webhook-buy-sell/services/vendor-outreach.ts`
**Changes**: Added actual `sendText()` call (line 340-360)
**Commit**: `82aca61f`

### 3. Database Infrastructure ✅
**Status**: Migration applied
**File**: `supabase/migrations/20251211012600_buy_sell_critical_infrastructure.sql`
**Tables**: agent_requests, marketplace_inquiries, vendor_outreach_log, message_rate_limits

---

## 🚧 Phase 2: HIGH PRIORITY (Next Implementation)

### 1. Connect Payment Flow to AI Agent
**Priority**: 🔴 HIGH
**Effort**: Medium (2-3 hours)
**Impact**: Enables end-to-end purchase flow

#### Problem
Payment module (`payment.ts`, 547 lines) exists and is complete but:
- AI agent doesn't trigger payment flow
- No `initiate_purchase` action in `handleAction()`
- Buyer can't say "I'll buy it" and get payment link

#### Solution
```typescript
// File: supabase/functions/wa-webhook-buy-sell/agent.ts
// Add to handleAction() method

case "initiate_purchase":
  if (!context.currentListingId) {
    return {
      message: "❌ No listing selected. Please select an item first.",
      action: "error"
    };
  }
  
  // Import payment module
  const { initiatePayment } = await import("./payment.ts");
  
  const paymentResult = await initiatePayment(
    this.supabase,
    context.phone,
    context.currentListingId,
    aiResponse.extracted_entities?.price
  );
  
  if (!paymentResult.success) {
    return {
      message: `❌ ${paymentResult.error}`,
      action: "error"
    };
  }
  
  // Clear listing context after initiating payment
  context.currentListingId = null;
  
  return {
    message: paymentResult.message_to_buyer,
    action: "payment_initiated",
    data: {
      transactionId: paymentResult.transaction_id,
      ussdCode: paymentResult.ussd_code
    }
  };
```

#### Integration Points
1. Update system prompt to include purchase intent recognition
2. Add `initiate_purchase` to action types
3. Add payment status check commands
4. Handle transaction cancellation

**Files to Modify**:
- `supabase/functions/wa-webhook-buy-sell/agent.ts` (handleAction)
- `supabase/functions/wa-webhook-buy-sell/index.ts` (add payment status commands)
- System prompt to recognize "I'll buy it", "Let's do it", "Purchase"

---

### 2. Implement Real MoMo Payment Verification
**Priority**: 🔴 CRITICAL (Security)
**Effort**: Medium (2-3 hours)
**Impact**: Prevents fraud, ensures real payment verification

#### Problem
Current implementation (payment.ts line 253-258):
```typescript
// For now, we'll mark as success after a delay (simulation)
await markPaymentAsSuccess(ctx, transactionId);
```
**Risk**: Payments marked successful without actual verification!

#### Solution
Create MoMo webhook verification endpoint:

```typescript
// File: supabase/functions/momo-webhook-verify/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../_shared/observability.ts";

interface MoMoWebhookPayload {
  reference: string;
  amount: number;
  currency: string;
  status: "SUCCESSFUL" | "FAILED" | "PENDING";
  transaction_id: string;
  timestamp: string;
}

serve(async (req: Request) => {
  const correlationId = crypto.randomUUID();
  
  // Verify webhook signature
  const signature = req.headers.get("x-momo-signature");
  if (!verifyMoMoSignature(signature, await req.text())) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401
    });
  }
  
  const payload: MoMoWebhookPayload = await req.json();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
  
  await logStructuredEvent("MOMO_WEBHOOK_RECEIVED", {
    correlationId,
    reference: payload.reference,
    status: payload.status,
    amount: payload.amount
  });
  
  // Find transaction by reference
  const { data: transaction } = await supabase
    .from("marketplace_transactions")
    .select("*")
    .eq("payment_reference", payload.reference)
    .single();
  
  if (!transaction) {
    await logStructuredEvent("MOMO_WEBHOOK_NO_TRANSACTION", {
      correlationId,
      reference: payload.reference
    }, "warn");
    
    return new Response(JSON.stringify({ error: "Transaction not found" }), {
      status: 404
    });
  }
  
  // Verify amount matches
  if (Math.abs(payload.amount - transaction.agreed_price) > 0.01) {
    await logStructuredEvent("MOMO_WEBHOOK_AMOUNT_MISMATCH", {
      correlationId,
      expected: transaction.agreed_price,
      received: payload.amount
    }, "error");
    
    await supabase
      .from("marketplace_transactions")
      .update({
        status: "failed",
        payment_error: "Amount mismatch",
        updated_at: new Date().toISOString()
      })
      .eq("id", transaction.id);
    
    return new Response(JSON.stringify({ error: "Amount mismatch" }), {
      status: 400
    });
  }
  
  // Update transaction status
  const newStatus = payload.status === "SUCCESSFUL" ? "paid" : "failed";
  
  await supabase
    .from("marketplace_transactions")
    .update({
      status: newStatus,
      payment_verified_at: new Date().toISOString(),
      payment_reference: payload.reference,
      payment_transaction_id: payload.transaction_id,
      updated_at: new Date().toISOString()
    })
    .eq("id", transaction.id);
  
  // Notify buyer and seller
  if (newStatus === "paid") {
    const { sendText } = await import("../_shared/wa-webhook-shared/wa/client.ts");
    
    await sendText(transaction.buyer_phone, 
      `✅ *Payment Verified!*\n\n` +
      `Your payment of ${transaction.agreed_price} RWF has been confirmed.\n\n` +
      `Transaction: ${payload.reference}\n` +
      `The seller will now prepare your order.`
    );
    
    await sendText(transaction.seller_phone,
      `💰 *Payment Received!*\n\n` +
      `Buyer paid ${transaction.agreed_price} RWF for your listing.\n\n` +
      `Transaction: ${payload.reference}\n` +
      `Please confirm delivery by replying: CONFIRM`
    );
  }
  
  await logStructuredEvent("MOMO_WEBHOOK_PROCESSED", {
    correlationId,
    transactionId: transaction.id,
    status: newStatus
  });
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" }
  });
});

function verifyMoMoSignature(signature: string | null, body: string): boolean {
  if (!signature) return false;
  
  const secret = Deno.env.get("MOMO_WEBHOOK_SECRET");
  if (!secret) {
    console.warn("MOMO_WEBHOOK_SECRET not configured");
    return false;
  }
  
  // Implement HMAC-SHA256 verification
  // ... (similar to WhatsApp signature verification)
  
  return true; // Placeholder
}
```

**Environment Variables Needed**:
```bash
MOMO_API_KEY=your_mtn_momo_api_key
MOMO_WEBHOOK_SECRET=your_webhook_secret
MOMO_API_URL=https://sandbox.momodeveloper.mtn.com  # or production
```

---

### 3. Add Idempotency to AI Agent Calls
**Priority**: 🟡 MEDIUM
**Effort**: Small (1 hour)
**Impact**: Prevents duplicate processing on retries

#### Implementation
```typescript
// File: supabase/functions/wa-webhook-buy-sell/index.ts
// Update forwardToBuySellAgent()

async function forwardToBuySellAgent(
  userPhone: string,
  text: string,
  messageId: string,  // ADD THIS
  correlationId: string,
): Promise<boolean> {
  try {
    const idempotencyKey = `buy_sell:${userPhone}:${messageId}`;
    
    // Check if already processed
    const { data: existing } = await supabase
      .from('agent_requests')
      .select('response')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    
    if (existing) {
      logStructuredEvent("AI_AGENT_IDEMPOTENT_HIT", {
        correlationId,
        phone: userPhone.slice(-4),
        idempotencyKey
      });
      
      // Return cached response
      return true;
    }
    
    // Process normally
    const res = await fetch(`${baseUrl}/functions/v1/agent-buy-sell`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        userPhone,
        message: text,
        idempotencyKey,  // PASS TO AGENT
        correlationId
      }),
    });
    
    const response = await res.json();
    
    // Cache response
    await supabase
      .from('agent_requests')
      .insert({
        idempotency_key: idempotencyKey,
        agent_slug: 'buy_sell',
        request_payload: { userPhone, message: text },
        response: response,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });
    
    return res.ok;
  } catch (err) {
    logStructuredEvent("AI_AGENT_FORWARD_ERROR", {
      correlationId,
      error: err instanceof Error ? err.message : String(err)
    }, "error");
    return false;
  }
}
```

---

### 4. Schedule Transaction Expiry
**Priority**: 🟡 MEDIUM
**Effort**: Small (30 min)
**Impact**: Auto-cleanup of stale transactions

#### Implementation
```sql
-- File: supabase/migrations/20251211030000_schedule_transaction_expiry.sql
BEGIN;

-- Schedule transaction expiry every 15 minutes
-- Note: pg_cron may not be available on Supabase hosted
-- Alternative: Use edge function called by GitHub Actions cron

-- Create expiry edge function caller
CREATE OR REPLACE FUNCTION public.trigger_transaction_expiry()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Call expire_marketplace_transactions
  PERFORM public.expire_marketplace_transactions();
  
  -- Log execution
  INSERT INTO public.cron_job_log (job_name, executed_at, status)
  VALUES ('expire_marketplace_transactions', NOW(), 'success');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.cron_job_log (job_name, executed_at, status, error)
  VALUES ('expire_marketplace_transactions', NOW(), 'failed', SQLERRM);
END;
$$;

-- Create cron job log table
CREATE TABLE IF NOT EXISTS public.cron_job_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cron_job_log_name_time ON public.cron_job_log(job_name, executed_at DESC);

COMMENT ON TABLE public.cron_job_log IS 'Log of scheduled job executions';

COMMIT;
```

Then create GitHub Actions workflow:
```yaml
# .github/workflows/cron-expire-transactions.yml
name: Expire Marketplace Transactions

on:
  schedule:
    - cron: '*/15 * * * *'  # Every 15 minutes
  workflow_dispatch:

jobs:
  expire-transactions:
    runs-on: ubuntu-latest
    steps:
      - name: Call expiry function
        run: |
          curl -X POST \
            https://lhbowpbcpwoiparwnwgt.supabase.co/rest/v1/rpc/expire_marketplace_transactions \
            -H "apikey: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}"
```

---

## 🟢 Phase 3: MEDIUM PRIORITY (Future)

### 1. Code Consolidation
**Effort**: Large (1-2 days)
**Impact**: Maintainability

Consolidate three implementations into one:
- Move all logic to `packages/agents/src/agents/commerce/buy-and-sell/`
- Make Deno wrapper thin delegation layer
- Update admin-app to use shared package

### 2. Order Tracking
**Effort**: Medium (3-4 hours)

Add `/track` command and delivery status updates.

### 3. Rate Limiting Middleware
**Effort**: Small (1 hour)

Add rate limit check before AI processing.

---

## 📊 Implementation Priority Matrix

| Task | Priority | Effort | Impact | Status |
|------|----------|--------|--------|--------|
| Node.js Syntax Fix | 🔴 Critical | Small | High | ✅ DONE |
| Vendor Outreach Send | 🔴 Critical | Small | High | ✅ DONE |
| Database Infrastructure | 🔴 Critical | Medium | High | ✅ DONE |
| Payment-AI Integration | 🔴 High | Medium | High | 📋 TODO |
| MoMo Verification | 🔴 Critical | Medium | High | 📋 TODO |
| Idempotency | 🟡 Medium | Small | Medium | 📋 TODO |
| Transaction Expiry | 🟡 Medium | Small | Medium | 📋 TODO |
| Code Consolidation | 🟢 Low | Large | Medium | 📋 FUTURE |
| Order Tracking | 🟢 Low | Medium | Low | 📋 FUTURE |
| Rate Limiting | 🟢 Low | Small | Low | 📋 FUTURE |

---

## 🧪 Testing Checklist

### End-to-End Purchase Flow
```
1. Buyer: "I need paracetamol"
2. System: Shows pharmacies with listings
3. Buyer: "I'll buy the first one"
4. System: Initiates payment, sends USSD link
5. Buyer: Dials USSD, completes payment
6. MoMo: Webhook → Verifies payment
7. System: Notifies both parties
8. Seller: Confirms delivery
9. Transaction: Marked complete
```

### Verification Queries
```sql
-- Check payment flow integration
SELECT * FROM marketplace_transactions 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Check MoMo webhook logs
SELECT * FROM public.cron_job_log 
WHERE job_name = 'momo_webhook_verify'
ORDER BY executed_at DESC;

-- Check expired transactions
SELECT * FROM marketplace_transactions 
WHERE status = 'expired'
AND updated_at > NOW() - INTERVAL '1 day';
```

---

## 🚀 Deployment Sequence

### Phase 2A (Immediate - 4 hours)
1. Implement payment-AI integration
2. Add idempotency middleware
3. Deploy updated wa-webhook-buy-sell
4. Test end-to-end purchase flow

### Phase 2B (Next Day - 4 hours)
1. Implement MoMo webhook verification
2. Deploy momo-webhook-verify function
3. Setup transaction expiry GitHub Action
4. Integration testing with MoMo sandbox

### Phase 3 (Future - 2 days)
1. Code consolidation
2. Order tracking
3. Rate limiting
4. Comprehensive testing

---

**Document Version**: 1.0  
**Last Updated**: 2025-12-11 01:50 UTC  
**Status**: Phase 1 Complete ✅, Phase 2 Ready to Start 📋
