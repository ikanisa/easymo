# 🎯 PHASE 5: PAYMENT INTEGRATION - DETAILED PLAN

**Status**: Ready to implement  
**Priority**: HIGH - Required for order completion  
**Estimated Time**: 6-8 hours  
**Dependencies**: Checkout page, Order API

---

## 📋 OVERVIEW

Implement payment processing for:
1. **MoMo (Rwanda)** - USSD-based (no API, user self-serves)
2. **Revolut (Malta)** - Payment Links

---

## 🇷🇼 MOMO PAYMENT (RWANDA)

### Implementation Strategy
**No API integration** - Users dial USSD code themselves

### User Flow
```
1. User completes checkout
2. System shows:
   - USSD code: *182*7*1#
   - Bar payment code: <venue_code>
   - Amount: 15,000 RWF
   - Instructions
3. User dials USSD manually
4. User completes payment on phone
5. User clicks "I've Paid" button
6. System polls order status
7. Bar manager confirms payment
8. Order status → "Paid"
```

### Files to Create

#### 1. `lib/payment/momo.ts`
```typescript
/**
 * MoMo USSD Payment Utilities
 * Rwanda only - USSD-based payment
 */

export interface MoMoPaymentConfig {
  ussdCode: string;        // *182*7*1#
  merchantCode?: string;   // Venue-specific code
  currency: 'RWF';
}

export interface MoMoPaymentInstructions {
  ussdCode: string;
  steps: string[];
  amount: number;
  currency: string;
  barCode?: string;
}

export function generateMoMoInstructions(
  amount: number,
  venueCode?: string
): MoMoPaymentInstructions {
  return {
    ussdCode: '*182*7*1#',
    amount,
    currency: 'RWF',
    barCode: venueCode,
    steps: [
      'Dial *182*7*1# on your phone',
      'Select "Pay Bill"',
      venueCode ? `Enter bar code: ${venueCode}` : 'Enter the bar code shown above',
      `Enter amount: ${amount.toLocaleString()} RWF`,
      'Enter your MoMo PIN',
      'Confirm payment',
      'Click "I\'ve Paid" below when complete',
    ],
  };
}

export function formatMoMoAmount(amount: number): string {
  return `${amount.toLocaleString('en-RW')} RWF`;
}
```

#### 2. `components/payment/MoMoPayment.tsx`
```typescript
'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Smartphone, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { generateMoMoInstructions, formatMoMoAmount } from '@/lib/payment/momo';
import { useHaptics } from '@/hooks/useHaptics';

interface MoMoPaymentProps {
  amount: number;
  venueCode?: string;
  onPaymentComplete: () => void;
  onCancel: () => void;
}

export function MoMoPayment({
  amount,
  venueCode,
  onPaymentComplete,
  onCancel,
}: MoMoPaymentProps) {
  const [copied, setCopied] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const { trigger } = useHaptics();
  
  const instructions = generateMoMoInstructions(amount, venueCode);

  const handleCopy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    trigger('success');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [trigger]);

  const handleConfirmPayment = useCallback(() => {
    setIsPaying(true);
    trigger('success');
    onPaymentComplete();
  }, [onPaymentComplete, trigger]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Smartphone className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Pay with MoMo</h2>
        <p className="text-muted-foreground">
          Follow the instructions below to complete your payment
        </p>
      </div>

      {/* Amount Display */}
      <div className="bg-card border border-border rounded-2xl p-6 text-center">
        <p className="text-sm text-muted-foreground mb-2">Total Amount</p>
        <p className="text-4xl font-bold text-primary">
          {formatMoMoAmount(amount)}
        </p>
      </div>

      {/* USSD Code */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Dial this code</p>
            <p className="text-2xl font-mono font-bold">{instructions.ussdCode}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCopy(instructions.ussdCode)}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Bar Code (if available) */}
      {venueCode && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Bar Code</p>
              <p className="text-xl font-mono font-bold">{venueCode}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(venueCode)}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-muted/50 rounded-2xl p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-primary" />
          Payment Steps
        </h3>
        <ol className="space-y-2">
          {instructions.steps.map((step, index) => (
            <li key={index} className="flex gap-3 text-sm">
              <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                {index + 1}
              </span>
              <span className="flex-1">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isPaying}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          onClick={handleConfirmPayment}
          disabled={isPaying}
          className="flex-1"
        >
          {isPaying ? 'Processing...' : "I've Paid"}
        </Button>
      </div>

      {/* Help Text */}
      <p className="text-xs text-center text-muted-foreground">
        Click "I've Paid" after completing the payment on your phone.
        The bar will verify and confirm your order.
      </p>
    </motion.div>
  );
}
```

---

## 🇲🇹 REVOLUT PAYMENT (MALTA)

### Implementation Strategy
**Payment Links** - Generate link, user pays, webhook confirms

### User Flow
```
1. User completes checkout
2. System calls API to generate Revolut payment link
3. User clicks "Pay with Revolut"
4. Opens Revolut payment page (new tab)
5. User completes payment
6. Revolut sends webhook to our API
7. System updates order status → "Paid"
8. User sees confirmation
```

### Files to Create

#### 3. `lib/payment/revolut.ts`
```typescript
/**
 * Revolut Payment Link Integration
 * Malta market
 */

export interface RevolutPaymentRequest {
  amount: number;
  currency: 'EUR';
  orderId: string;
  description: string;
  customerEmail?: string;
  webhookUrl: string;
  returnUrl: string;
}

export interface RevolutPaymentResponse {
  id: string;
  paymentLink: string;
  expiresAt: string;
  status: 'pending' | 'completed' | 'failed';
}

export interface RevolutWebhookPayload {
  id: string;
  type: 'payment.completed' | 'payment.failed';
  payment: {
    id: string;
    orderId: string;
    amount: number;
    currency: string;
    status: string;
  };
}

/**
 * Create Revolut payment link
 */
export async function createRevolutPayment(
  request: RevolutPaymentRequest
): Promise<RevolutPaymentResponse> {
  const apiKey = process.env.REVOLUT_API_KEY;
  const baseUrl = process.env.REVOLUT_API_URL || 'https://merchant.revolut.com/api/1.0';

  if (!apiKey) {
    throw new Error('REVOLUT_API_KEY not configured');
  }

  const response = await fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: Math.round(request.amount * 100), // Convert to cents
      currency: request.currency,
      merchant_order_ext_ref: request.orderId,
      description: request.description,
      customer_email: request.customerEmail,
      settlement_currency: request.currency,
      webhook_url: request.webhookUrl,
      checkout_url: request.returnUrl,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Revolut API error: ${error.message || response.statusText}`);
  }

  const data = await response.json();

  return {
    id: data.id,
    paymentLink: data.checkout_url,
    expiresAt: data.expires_at,
    status: 'pending',
  };
}

/**
 * Verify Revolut webhook signature
 */
export function verifyRevolutWebhook(
  payload: string,
  signature: string
): boolean {
  const webhookSecret = process.env.REVOLUT_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.error('REVOLUT_WEBHOOK_SECRET not configured');
    return false;
  }

  // Implement HMAC SHA256 verification
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');

  return signature === expectedSignature;
}

export function formatRevolutAmount(amount: number): string {
  return `€${amount.toFixed(2)}`;
}
```

#### 4. `components/payment/RevolutPayment.tsx`
```typescript
'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatRevolutAmount } from '@/lib/payment/revolut';
import { useHaptics } from '@/hooks/useHaptics';

interface RevolutPaymentProps {
  amount: number;
  orderId: string;
  onPaymentComplete: () => void;
  onPaymentFailed: (error: string) => void;
  onCancel: () => void;
}

type PaymentStatus = 'idle' | 'creating' | 'pending' | 'completed' | 'failed';

export function RevolutPayment({
  amount,
  orderId,
  onPaymentComplete,
  onPaymentFailed,
  onCancel,
}: RevolutPaymentProps) {
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [paymentLink, setPaymentLink] = useState<string>('');
  const [error, setError] = useState<string>('');
  const { trigger } = useHaptics();

  // Create payment link on mount
  useEffect(() => {
    createPaymentLink();
  }, []);

  const createPaymentLink = useCallback(async () => {
    setStatus('creating');
    
    try {
      const response = await fetch('/api/payment/revolut/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          amount,
          currency: 'EUR',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create payment link');
      }

      const { paymentLink: link } = await response.json();
      setPaymentLink(link);
      setStatus('idle');
      trigger('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment creation failed');
      setStatus('failed');
      trigger('error');
    }
  }, [orderId, amount, trigger]);

  const handleOpenPayment = useCallback(() => {
    if (!paymentLink) return;
    
    // Open payment in new window
    const width = 500;
    const height = 700;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;
    
    const paymentWindow = window.open(
      paymentLink,
      'RevolutPayment',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (paymentWindow) {
      setStatus('pending');
      trigger('light');
      
      // Poll for payment completion
      const pollInterval = setInterval(async () => {
        try {
          const response = await fetch(`/api/order/${orderId}`);
          const { paymentStatus } = await response.json();
          
          if (paymentStatus === 'completed') {
            clearInterval(pollInterval);
            setStatus('completed');
            trigger('success');
            paymentWindow.close();
            onPaymentComplete();
          } else if (paymentStatus === 'failed') {
            clearInterval(pollInterval);
            setStatus('failed');
            trigger('error');
            paymentWindow.close();
            onPaymentFailed('Payment was declined or cancelled');
          }
        } catch (err) {
          console.error('Payment polling error:', err);
        }
      }, 2000);

      // Stop polling after 5 minutes
      setTimeout(() => clearInterval(pollInterval), 300000);
    }
  }, [paymentLink, orderId, onPaymentComplete, onPaymentFailed, trigger]);

  if (status === 'creating') {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Creating payment link...</p>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="text-center py-12">
        <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Payment Failed</h3>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={createPaymentLink}>Try Again</Button>
      </div>
    );
  }

  if (status === 'completed') {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Payment Successful!</h3>
        <p className="text-muted-foreground">Redirecting to your order...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">Pay with Revolut</h2>
        <p className="text-muted-foreground">
          Secure payment powered by Revolut
        </p>
      </div>

      {/* Amount Display */}
      <div className="bg-card border border-border rounded-2xl p-6 text-center">
        <p className="text-sm text-muted-foreground mb-2">Total Amount</p>
        <p className="text-4xl font-bold text-primary">
          {formatRevolutAmount(amount)}
        </p>
      </div>

      {/* Payment Button */}
      <Button
        onClick={handleOpenPayment}
        disabled={!paymentLink || status === 'pending'}
        className="w-full h-14 text-lg"
      >
        {status === 'pending' ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Waiting for payment...
          </>
        ) : (
          <>
            <ExternalLink className="w-5 h-5 mr-2" />
            Open Revolut Payment
          </>
        )}
      </Button>

      {/* Cancel Button */}
      <Button
        variant="outline"
        onClick={onCancel}
        disabled={status === 'pending'}
        className="w-full"
      >
        Cancel
      </Button>

      {/* Security Info */}
      <div className="bg-muted/50 rounded-xl p-4 text-sm text-muted-foreground">
        <p className="mb-2">
          🔒 Your payment is processed securely by Revolut
        </p>
        <p>
          You'll be redirected to Revolut's secure payment page to complete your order.
        </p>
      </div>
    </motion.div>
  );
}
```

#### 5. `app/api/payment/revolut/create/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRevolutPayment } from '@/lib/payment/revolut';
import { logStructuredEvent } from '@easymo/commons';

export async function POST(request: NextRequest) {
  try {
    const { orderId, amount, currency } = await request.json();

    // Validate input
    if (!orderId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create payment link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://order.easymo.app';
    const paymentResponse = await createRevolutPayment({
      amount,
      currency: currency || 'EUR',
      orderId,
      description: `Order #${orderId}`,
      webhookUrl: `${baseUrl}/api/payment/revolut/webhook`,
      returnUrl: `${baseUrl}/order/${orderId}`,
    });

    // Log event
    await logStructuredEvent('PAYMENT_LINK_CREATED', {
      orderId,
      amount,
      provider: 'revolut',
      paymentId: paymentResponse.id,
    });

    return NextResponse.json({
      paymentLink: paymentResponse.paymentLink,
      paymentId: paymentResponse.id,
      expiresAt: paymentResponse.expiresAt,
    });
  } catch (error) {
    console.error('Revolut payment creation error:', error);
    
    await logStructuredEvent('PAYMENT_LINK_FAILED', {
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: 'revolut',
    });

    return NextResponse.json(
      { error: 'Failed to create payment link' },
      { status: 500 }
    );
  }
}
```

#### 6. `app/api/payment/revolut/webhook/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyRevolutWebhook } from '@/lib/payment/revolut';
import { createClient } from '@/lib/supabase/server';
import { logStructuredEvent } from '@easymo/commons';

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('revolut-signature') || '';
    const rawBody = await request.text();

    // Verify webhook signature
    if (!verifyRevolutWebhook(rawBody, signature)) {
      console.error('Invalid Revolut webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const payload = JSON.parse(rawBody);
    const { type, payment } = payload;

    // Get order ID from payment reference
    const orderId = payment.merchant_order_ext_ref;

    // Update order status in database
    const supabase = createClient();
    
    if (type === 'payment.completed') {
      await supabase
        .from('orders')
        .update({
          payment_status: 'completed',
          payment_provider: 'revolut',
          payment_id: payment.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      await logStructuredEvent('PAYMENT_COMPLETED', {
        orderId,
        provider: 'revolut',
        paymentId: payment.id,
        amount: payment.amount / 100, // Convert from cents
      });

      // TODO: Trigger real-time notification to user
      // TODO: Notify bar manager

    } else if (type === 'payment.failed') {
      await supabase
        .from('orders')
        .update({
          payment_status: 'failed',
          payment_provider: 'revolut',
          payment_id: payment.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      await logStructuredEvent('PAYMENT_FAILED', {
        orderId,
        provider: 'revolut',
        paymentId: payment.id,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Revolut webhook error:', error);
    
    await logStructuredEvent('PAYMENT_WEBHOOK_ERROR', {
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: 'revolut',
    });

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
```

---

## 📝 IMPLEMENTATION STEPS

### Step 1: Create Payment Utilities (1 hour)
```bash
# Create lib/payment directory
mkdir -p lib/payment

# Create files
touch lib/payment/momo.ts
touch lib/payment/revolut.ts
```

Implement the utilities as specified above.

### Step 2: Create Payment Components (2 hours)
```bash
# Create components
touch components/payment/MoMoPayment.tsx
touch components/payment/RevolutPayment.tsx
touch components/payment/PaymentSelector.tsx
```

### Step 3: Create API Routes (2 hours)
```bash
# Create API directories
mkdir -p app/api/payment/revolut

# Create routes
touch app/api/payment/revolut/create/route.ts
touch app/api/payment/revolut/webhook/route.ts
```

### Step 4: Environment Variables (15 min)
Add to `.env.local`:
```bash
# Revolut (Malta only)
REVOLUT_API_KEY=your_api_key_here
REVOLUT_API_URL=https://merchant.revolut.com/api/1.0
REVOLUT_WEBHOOK_SECRET=your_webhook_secret_here

# Public URL
NEXT_PUBLIC_APP_URL=https://order.easymo.app
```

### Step 5: Update Database Schema (30 min)
Add payment fields to orders table if not exists:
```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
```

### Step 6: Integrate with Checkout (1 hour)
Update checkout page to include payment selection and processing.

### Step 7: Testing (1.5 hours)
- Test MoMo flow
- Test Revolut flow
- Test webhook handling
- Test error cases

---

## ✅ COMPLETION CHECKLIST

- [ ] `lib/payment/momo.ts` created
- [ ] `lib/payment/revolut.ts` created
- [ ] `components/payment/MoMoPayment.tsx` created
- [ ] `components/payment/RevolutPayment.tsx` created
- [ ] `components/payment/PaymentSelector.tsx` created
- [ ] `app/api/payment/revolut/create/route.ts` created
- [ ] `app/api/payment/revolut/webhook/route.ts` created
- [ ] Environment variables configured
- [ ] Database schema updated
- [ ] Checkout page integrated
- [ ] MoMo flow tested
- [ ] Revolut flow tested
- [ ] Webhook handling tested
- [ ] Error handling tested
- [ ] Documentation updated

---

## 🎯 SUCCESS CRITERIA

Phase 5 is complete when:
1. ✅ Users can select payment method (MoMo or Revolut)
2. ✅ MoMo payment shows USSD code and instructions
3. ✅ Revolut payment opens payment link
4. ✅ Payment status updates correctly
5. ✅ Webhooks process successfully
6. ✅ Users receive confirmation
7. ✅ Bar manager notified of payment

---

**Ready to implement?** → Start with Step 1 above!
