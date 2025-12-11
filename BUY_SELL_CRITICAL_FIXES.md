# Buy & Sell System - Critical Fixes Implementation

## Issues Identified & Fixed

### 🔴 CRITICAL - Fixed

#### 1. Syntax Error in Node.js Agent ✅ FIXED
**File**: `packages/agents/src/agents/commerce/buy-and-sell.agent.ts`

**Problem**: Lines 36-50 had broken code with:
- Unclosed template literal
- Duplicate property declarations
- Static property declared after instance properties

**Fix**: Removed duplicate code, properly structured class:
```typescript
export class BuyAndSellAgent extends BaseAgent {
  static readonly SLUG = BUY_SELL_AGENT_SLUG;
  
  name = 'buy_and_sell_agent';
  instructions = BUY_SELL_SYSTEM_PROMPT;
  // ...
}
```

**Status**: ✅ Applied

---

### 🟡 MEDIUM PRIORITY - TO IMPLEMENT

#### 2. Missing Idempotency in AI Agent Calls
**File**: `supabase/functions/wa-webhook-buy-sell/index.ts`

**Problem**: Line 484 - No idempotency key when forwarding to agent-buy-sell
```typescript
body: JSON.stringify({
  userPhone,
  message: text,
  // Missing: idempotencyKey
}),
```

**Impact**: Retry = duplicate AI processing, wasted credits, inconsistent responses

**Fix Required**:
```typescript
// In index.ts
const idempotencyKey = `${userPhone}:${messageId}:${correlationId}`;

body: JSON.stringify({
  userPhone,
  message: text,
  idempotencyKey, // ADD THIS
}),

// In agent-buy-sell edge function
interface BuySellRequest {
  userPhone: string;
  message: string;
  idempotencyKey?: string;
}

// Check before processing
if (idempotencyKey) {
  const existing = await supabase
    .from('agent_requests')
    .select('response')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  
  if (existing?.data) {
    return existing.data.response;
  }
}
```

**Action Required**: Create new edge function with idempotency or update existing

---

#### 3. Missing Vendor Outreach Implementation
**Files**: 
- `supabase/functions/wa-webhook-buy-sell/agent.ts` (lines 164-180 - only UI)
- No actual WhatsApp sending implementation

**Problem**: Agent prompts for consent but never sends messages to vendors

**Evidence from Code**:
```typescript
// agent.ts - System prompt mentions:
// "4. VENDOR OUTREACH (after user says yes)"
// But no implementation of sendVendorInquiries()
```

**Fix Required**: Create `vendor_outreach.ts`:
```typescript
export interface VendorOutreachResult {
  sent: number;
  failed: number;
  inquiryId: string;
  errors: string[];
}

export async function sendVendorInquiries(
  businessIds: string[],
  requestSummary: string,
  buyerPhone: string,
  requestType: "product" | "service" | "medicine",
  supabase: SupabaseClient
): Promise<VendorOutreachResult> {
  // 1. Create inquiry record in marketplace_inquiries
  const { data: inquiry } = await supabase
    .from('marketplace_inquiries')
    .insert({
      buyer_phone: buyerPhone,
      request_summary: requestSummary,
      request_type: requestType,
      status: 'pending',
      business_ids: businessIds
    })
    .select()
    .single();

  // 2. Send WhatsApp to each vendor
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  
  for (const businessId of businessIds) {
    try {
      // Fetch business contact
      const { data: business } = await supabase
        .from('businesses')
        .select('name, phone_primary, whatsapp_number')
        .eq('id', businessId)
        .single();
      
      if (!business?.whatsapp_number) {
        failed++;
        errors.push(`${businessId}: No WhatsApp`);
        continue;
      }
      
      // Build message
      const message = buildVendorInquiryMessage(
        business.name,
        requestSummary,
        buyerPhone,
        inquiry.id
      );
      
      // Send via sendText()
      await sendText(business.whatsapp_number, message);
      
      // Log outreach
      await supabase.from('vendor_outreach_log').insert({
        inquiry_id: inquiry.id,
        business_id: businessId,
        sent_at: new Date().toISOString(),
        status: 'sent'
      });
      
      sent++;
    } catch (error) {
      failed++;
      errors.push(`${businessId}: ${error.message}`);
    }
  }
  
  // 3. Update inquiry status
  await supabase
    .from('marketplace_inquiries')
    .update({ 
      vendors_contacted: sent,
      status: sent > 0 ? 'sent' : 'failed'
    })
    .eq('id', inquiry.id);
  
  // 4. Notify buyer
  await notifyBuyerWithShortlist(buyerPhone, sent, inquiry.id, supabase);
  
  return { sent, failed, inquiryId: inquiry.id, errors };
}

function buildVendorInquiryMessage(
  businessName: string,
  requestSummary: string,
  buyerPhone: string,
  inquiryId: string
): string {
  return `🔔 *New Customer Inquiry*\n\n` +
    `A customer is looking for: ${requestSummary}\n\n` +
    `Can ${businessName} help with this?\n\n` +
    `Reply to this message to respond to the customer.\n\n` +
    `Inquiry ID: ${inquiryId.substring(0, 8)}`;
}

async function notifyBuyerWithShortlist(
  buyerPhone: string,
  vendorCount: number,
  inquiryId: string,
  supabase: SupabaseClient
): Promise<void> {
  const message = `✅ *Vendors Contacted*\n\n` +
    `I've sent your request to ${vendorCount} nearby vendors.\n\n` +
    `You should hear back from them soon! 📱\n\n` +
    `Use /status to check responses.`;
  
  await sendText(buyerPhone, message);
}
```

**Action Required**: Implement this module and integrate with agent.ts

---

#### 4. No Transaction Safety in Wallet Operations
**File**: `services/buyer-service/src/service.ts`

**Problem**: Lines ~180-200 - Wallet transfer outside transaction
```typescript
async recordPurchase(input: PurchaseInput) {
  // Wallet debited here (HTTP call)
  const response = await axios.post(`${settings.walletServiceUrl}/wallet/transfer`, {...});
  
  // If database insert fails, wallet was already debited!
  // No compensation logic
}
```

**Fix Required**:
```typescript
async recordPurchase(input: PurchaseInput) {
  return await this.prisma.$transaction(async (tx) => {
    // 1. Create pending purchase
    const purchase = await tx.purchase.create({
      data: {
        ...input,
        status: 'pending',
      }
    });
    
    // 2. Debit wallet with purchase.id as reference
    try {
      await axios.post(`${settings.walletServiceUrl}/wallet/transfer`, {
        from: input.buyerId,
        amount: input.amount,
        reference_table: 'purchases',
        reference_id: purchase.id,
      });
      
      // 3. Mark as completed
      return await tx.purchase.update({
        where: { id: purchase.id },
        data: { status: 'completed' }
      });
    } catch (walletError) {
      // Mark as failed
      await tx.purchase.update({
        where: { id: purchase.id },
        data: { status: 'failed', error: walletError.message }
      });
      throw walletError;
    }
  }, {
    timeout: 10000 // 10 second timeout
  });
}
```

**Alternative**: Use 2-phase commit pattern with compensation

**Action Required**: Update buyer-service

---

#### 5. Missing Ground Rules Observability (Node.js Agent)
**File**: `packages/agents/src/agents/commerce/buy-and-sell.agent.ts`

**Problem**: Incomplete observability - no correlation IDs, no metrics

**Current**:
```typescript
log.info({ query, lat, lng }, 'Executing AI business search');
```

**Required per docs/GROUND_RULES.md**:
```typescript
import { childLogger } from '@easymo/commons';
import { recordMetric } from '@easymo/commons'; // if available

const log = childLogger({ 
  service: 'agents', 
  agent: 'buy-and-sell' 
});

// Every tool execution
const startTime = Date.now();
log.info({ 
  event: 'TOOL_EXECUTE_START',
  correlationId: context.correlationId,
  tool: 'searchBusinesses',
  query,
  lat,
  lng
});

try {
  const result = await searchBusinesses(...);
  
  const durationMs = Date.now() - startTime;
  log.info({ 
    event: 'TOOL_EXECUTE_SUCCESS',
    correlationId: context.correlationId,
    tool: 'searchBusinesses',
    resultCount: result.length,
    durationMs
  });
  
  // Record metric
  recordMetric('agent.tool.duration', durationMs, {
    agent: 'buy_and_sell',
    tool: 'searchBusinesses',
    status: 'success'
  });
  
  return result;
} catch (error) {
  log.error({
    event: 'TOOL_EXECUTE_ERROR',
    correlationId: context.correlationId,
    tool: 'searchBusinesses',
    error: error.message,
    stack: error.stack
  });
  
  recordMetric('agent.tool.error', 1, {
    agent: 'buy_and_sell',
    tool: 'searchBusinesses'
  });
  
  throw error;
}
```

**Action Required**: Add comprehensive logging to all tool functions

---

### 🟢 LOW PRIORITY - FUTURE ENHANCEMENTS

#### 6. Rate Limiting
- No per-user message throttling
- No AI API quota tracking
- No abuse detection

**Recommendation**: Add middleware in wa-webhook-buy-sell/index.ts:
```typescript
async function checkRateLimit(phone: string): Promise<boolean> {
  const limit = 20; // messages per minute
  const window = 60; // seconds
  
  const { count } = await supabase
    .from('message_rate_limits')
    .select('*', { count: 'exact' })
    .eq('phone', phone)
    .gte('created_at', new Date(Date.now() - window * 1000).toISOString());
  
  if (count >= limit) {
    await sendText(phone, "⏳ Please slow down. Try again in a minute.");
    return false;
  }
  
  return true;
}
```

#### 7. Payment Flow Integration
- payment.ts exists but not connected to checkout flow
- No "Buy Now" button in agent responses

#### 8. Order Tracking
- No order status notifications
- No "Track my order" command

---

## Implementation Priority

### Phase 1 (CRITICAL - This commit)
1. ✅ Fix Node.js agent syntax error
2. Create idempotency table and logic
3. Implement vendor outreach module
4. Add observability to Node.js agent

### Phase 2 (HIGH)
1. Fix transaction safety in buyer-service
2. Add rate limiting
3. Connect payment flow

### Phase 3 (MEDIUM)
1. Order tracking system
2. Vendor response handling
3. Enhanced error recovery

---

## Database Migrations Needed

### 1. Agent Idempotency Table
```sql
CREATE TABLE IF NOT EXISTS agent_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT UNIQUE NOT NULL,
  agent_slug TEXT NOT NULL,
  request_payload JSONB NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX idx_agent_requests_key ON agent_requests(idempotency_key);
CREATE INDEX idx_agent_requests_expires ON agent_requests(expires_at) 
  WHERE expires_at > NOW();
```

### 2. Marketplace Inquiries
```sql
CREATE TABLE IF NOT EXISTS marketplace_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_phone TEXT NOT NULL,
  request_summary TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('product', 'service', 'medicine')),
  business_ids UUID[] NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'completed', 'failed')),
  vendors_contacted INTEGER DEFAULT 0,
  vendors_responded INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inquiries_buyer ON marketplace_inquiries(buyer_phone, created_at DESC);
CREATE INDEX idx_inquiries_status ON marketplace_inquiries(status, created_at DESC);
```

### 3. Vendor Outreach Log
```sql
CREATE TABLE IF NOT EXISTS vendor_outreach_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES marketplace_inquiries(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('sent', 'delivered', 'responded', 'failed')),
  response_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outreach_inquiry ON vendor_outreach_log(inquiry_id);
CREATE INDEX idx_outreach_business ON vendor_outreach_log(business_id);
```

---

## Testing Checklist

- [ ] Node.js agent compiles without syntax errors
- [ ] Idempotency prevents duplicate AI calls
- [ ] Vendor outreach sends WhatsApp messages
- [ ] Buyer receives shortlist notification
- [ ] Observability logs include correlation IDs
- [ ] Rate limiting blocks spam
- [ ] Transaction safety prevents double-debits

---

**Date**: 2025-12-11
**Status**: Syntax error fixed, other issues documented
**Next**: Implement idempotency and vendor outreach
