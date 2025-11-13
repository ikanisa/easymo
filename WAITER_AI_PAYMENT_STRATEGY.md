# Waiter AI Payment Strategy - Updated

## Payment Methods (Simplified)

### 1. Mobile Money (MTN MoMo) - USSD Based
**How it works**:
- User selects "Pay with Mobile Money"
- User enters their phone number
- System generates USSD prompt
- User dials USSD code (e.g., `*182*7*1#`)
- User approves payment on their phone
- System polls for payment confirmation (via webhook or status check)

**Implementation**:
```typescript
// No API integration needed
// Just store payment record as 'pending'
// User manually confirms when approved on phone
// OR use webhook from MoMo provider if available

async function initiate_momo_payment(orderId, phoneNumber, amount) {
  // 1. Create payment record
  const payment = await createPayment({
    order_id: orderId,
    provider: 'mtn_momo',
    phone_number: phoneNumber,
    amount: amount,
    status: 'pending'
  });

  // 2. Show USSD instructions to user
  return {
    success: true,
    instructions: `Please dial *182*7*1# and approve payment of ${amount}`,
    payment_reference: payment.id
  };
}
```

### 2. Revolut - Deep Link to User's Payment Link
**How it works**:
- User provides their Revolut.me payment link (stored in profile or provided at checkout)
- System adds amount and description as URL parameters
- Deep link launches Revolut app or web page
- User approves payment in Revolut
- System marks payment as pending until user confirms

**Revolut.me Link Format**:
```
https://revolut.me/username
https://revolut.me/username/12.50EUR
https://revolut.me/username/12.50EUR?description=Order%20ORD-123
```

**Implementation**:
```typescript
async function initiate_revolut_payment(orderId, revolutLink, amount, currency) {
  // 1. Create payment record
  const payment = await createPayment({
    order_id: orderId,
    provider: 'revolut',
    amount: amount,
    status: 'pending',
    metadata: { revolut_link: revolutLink }
  });

  // 2. Build payment link with amount
  const paymentUrl = `${revolutLink}/${amount}${currency}?description=Order%20${orderNumber}`;

  // 3. Return deep link
  return {
    success: true,
    payment_url: paymentUrl,
    payment_reference: payment.id,
    instructions: 'Click to open Revolut and approve payment'
  };
}
```

### 3. Cash (Optional)
**How it works**:
- User selects "Pay with Cash"
- Order marked as 'confirmed' but payment 'pending'
- Staff confirms cash payment manually
- System updates payment status to 'successful'

---

## Updated Database Schema

### Payments Table Updates
```sql
-- Add payment link field for Revolut
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_link TEXT;

-- Add instructions field for USSD/manual payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_instructions TEXT;

-- Add confirmation method
ALTER TABLE payments ADD COLUMN IF NOT EXISTS confirmation_method TEXT; -- 'automatic', 'manual', 'webhook'
```

### User Payment Preferences
```sql
-- Store user's preferred payment methods
CREATE TABLE IF NOT EXISTS user_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'mtn_momo', 'revolut', 'cash'
  phone_number TEXT, -- For MoMo
  revolut_link TEXT, -- For Revolut
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider)
);
```

---

## Payment Flow

### User Journey

1. **Add items to cart** → `draft` order
2. **Click "Checkout"** → `pending_payment` order
3. **Select payment method**:
   - MoMo → Enter phone number
   - Revolut → Provide/use saved Revolut.me link
   - Cash → Confirm cash payment
4. **Payment initiated** → Payment record created
5. **User approves** → External (USSD or Revolut app)
6. **Confirmation** → Manual or automatic
7. **Order confirmed** → `paid` status

### Payment Confirmation Options

#### Option A: Manual Confirmation
```typescript
// User clicks "I've completed the payment"
async function confirm_payment_manual(paymentId, userId) {
  await updatePayment(paymentId, {
    status: 'successful',
    completed_at: new Date(),
    confirmation_method: 'manual'
  });
  
  await updateOrder(orderId, {
    status: 'paid',
    payment_method: 'confirmed'
  });
}
```

#### Option B: Webhook (if provider supports)
```typescript
// MoMo or Revolut webhook hits our endpoint
async function handle_payment_webhook(provider, reference, status) {
  const payment = await getPaymentByReference(reference);
  
  if (status === 'completed') {
    await updatePayment(payment.id, {
      status: 'successful',
      completed_at: new Date(),
      confirmation_method: 'webhook'
    });
    
    await updateOrder(payment.order_id, {
      status: 'paid'
    });
  }
}
```

#### Option C: Status Polling (optional)
```typescript
// Frontend polls for payment status
async function check_payment_status(paymentId) {
  const payment = await getPayment(paymentId);
  return {
    status: payment.status,
    completed_at: payment.completed_at
  };
}
```

---

## Implementation Priority

### Phase 2A: Basic Payment Flow (This Week)
1. ✅ Payment initiation tools
   - `initiate_momo_payment`
   - `initiate_revolut_payment`
   - `initiate_cash_payment`

2. ✅ Manual confirmation
   - `confirm_payment_manual`
   - Update order status

3. ✅ Payment status checking
   - `get_payment_status`
   - Poll for updates

### Phase 2B: Enhanced Features (Next Week)
4. User payment preferences
   - Save Revolut links
   - Save phone numbers
   - Default payment method

5. Payment history
   - List user payments
   - Receipt generation

---

## Tool Specifications

### Tool: initiate_payment
```typescript
async function initiate_payment(
  context: WaiterToolContext,
  params: {
    order_id: string;
    payment_method: 'mtn_momo' | 'revolut' | 'cash';
    phone_number?: string; // For MoMo
    revolut_link?: string; // For Revolut
  }
): Promise<ToolResult>
```

### Tool: confirm_payment
```typescript
async function confirm_payment(
  context: WaiterToolContext,
  params: {
    payment_id: string;
    confirmation_code?: string; // Optional verification
  }
): Promise<ToolResult>
```

### Tool: cancel_payment
```typescript
async function cancel_payment(
  context: WaiterToolContext,
  params: {
    payment_id: string;
    reason?: string;
  }
): Promise<ToolResult>
```

---

## UI/UX Considerations

### MoMo Payment Screen
```
┌─────────────────────────────┐
│  Mobile Money Payment       │
├─────────────────────────────┤
│  Amount: €28.00             │
│  Order: ORD-20251113-1234   │
│                             │
│  Enter your phone number:   │
│  [+250 788 123 456       ] │
│                             │
│  [Request Payment]          │
│                             │
│  Instructions:              │
│  1. Dial *182*7*1#         │
│  2. Approve the payment     │
│  3. Click "I've Paid"       │
│                             │
│  [I've Completed Payment]   │
└─────────────────────────────┘
```

### Revolut Payment Screen
```
┌─────────────────────────────┐
│  Revolut Payment            │
├─────────────────────────────┤
│  Amount: €28.00             │
│  Order: ORD-20251113-1234   │
│                             │
│  Your Revolut Link:         │
│  [revolut.me/jean        ] │
│                             │
│  [Open Revolut to Pay] 🔗   │
│                             │
│  After completing payment:  │
│  [I've Completed Payment]   │
└─────────────────────────────┘
```

---

## Next Steps

Please provide:
1. **MoMo USSD codes** for your country (if specific)
2. **Example Revolut.me links** to test format
3. **Webhook URLs** (if providers send notifications)
4. **Confirmation flow preferences** (manual vs automatic)

Then I'll implement Phase 2A with the correct payment logic!

