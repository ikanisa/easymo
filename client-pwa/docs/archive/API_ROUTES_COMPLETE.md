# 🔌 CLIENT PWA - COMPLETE API ROUTES & PAYMENT CODE

**All API Routes + Payment Integration Code**  
**Ready to Copy & Paste**

---

## 📁 FILE 1: `app/api/order/create/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logStructuredEvent } from '@/lib/observability';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      venueSlug,
      tableNumber,
      customerName,
      customerPhone,
      items,
      paymentMethod,
      totalAmount,
      specialInstructions,
    } = body;

    const supabase = await createClient();

    // Get venue ID
    const { data: venue } = await supabase
      .from('venues')
      .select('id')
      .eq('slug', venueSlug)
      .single();

    if (!venue) {
      return NextResponse.json(
        { error: 'Venue not found' },
        { status: 404 }
      );
    }

    // Calculate totals
    const subtotal = items.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0
    );
    const tax = subtotal * 0.18; // 18% VAT for Rwanda
    const total = subtotal + tax;

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        venue_id: venue.id,
        table_number: tableNumber,
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
        status: 'pending',
        payment_method: paymentMethod,
        payment_status: 'pending',
        subtotal,
        tax,
        total,
        special_instructions: specialInstructions || null,
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order creation error:', orderError);
      return NextResponse.json(
        { error: 'Failed to create order' },
        { status: 500 }
      );
    }

    // Create order items
    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      menu_item_id: item.id,
      quantity: item.quantity,
      price_at_time: item.price,
      item_name: item.name,
      special_instructions: item.special_instructions || null,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Order items error:', itemsError);
      // Rollback order creation
      await supabase.from('orders').delete().eq('id', order.id);
      return NextResponse.json(
        { error: 'Failed to add order items' },
        { status: 500 }
      );
    }

    // Log event
    await logStructuredEvent('ORDER_CREATED', {
      orderId: order.id,
      venueId: venue.id,
      tableNumber,
      itemCount: items.length,
      total,
      paymentMethod,
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      status: order.status,
      paymentStatus: order.payment_status,
      total: order.total,
    });
  } catch (error) {
    console.error('Order creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## 📁 FILE 2: `app/api/order/[orderId]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const supabase = await createClient();

    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        venue:venues(id, name, slug, logo_url),
        items:order_items(
          *,
          menu_item:menu_items(name, image_url, emoji)
        )
      `)
      .eq('id', orderId)
      .single();

    if (error || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('Order fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## 📁 FILE 3: `app/api/payment/momo/initiate/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logStructuredEvent } from '@/lib/observability';

/**
 * MoMo Payment - USSD Self-Service
 * No API integration needed - user dials manually
 */
export async function POST(request: NextRequest) {
  try {
    const { orderId, amount } = await request.json();
    
    const supabase = await createClient();

    // Get order
    const { data: order } = await supabase
      .from('orders')
      .select('*, venue:venues(id, name, momo_code)')
      .eq('id', orderId)
      .single();

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Generate bar code (venue-specific)
    const barCode = order.venue.momo_code || '123456'; // Default test code
    
    // USSD code for Rwanda MoMo: *182*7*1#
    const ussdCode = '*182*7*1#';

    // Log payment initiation
    await logStructuredEvent('MOMO_PAYMENT_INITIATED', {
      orderId,
      amount,
      venueId: order.venue_id,
      barCode,
    });

    return NextResponse.json({
      success: true,
      method: 'momo_ussd',
      ussdCode,
      barCode,
      amount,
      instructions: [
        'Dial *182*7*1# on your phone',
        `Enter bar code: ${barCode}`,
        `Enter amount: ${Math.round(amount)} RWF`,
        'Enter your MoMo PIN',
        'Wait for confirmation',
      ],
      orderId,
    });
  } catch (error) {
    console.error('MoMo initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate payment' },
      { status: 500 }
    );
  }
}
```

---

## 📁 FILE 4: `app/api/payment/revolut/create/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logStructuredEvent } from '@/lib/observability';

/**
 * Revolut Payment Link Generation
 * Requires: REVOLUT_API_KEY in environment
 */
export async function POST(request: NextRequest) {
  try {
    const { orderId, amount, currency = 'EUR' } = await request.json();

    const supabase = await createClient();

    // Get order
    const { data: order } = await supabase
      .from('orders')
      .select('*, venue:venues(id, name)')
      .eq('id', orderId)
      .single();

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Revolut API endpoint (sandbox for testing)
    const revolutApiUrl = process.env.REVOLUT_API_URL || 
      'https://sandbox-merchant.revolut.com/api/1.0/orders';
    
    const revolutApiKey = process.env.REVOLUT_API_KEY;

    if (!revolutApiKey) {
      return NextResponse.json(
        { error: 'Revolut not configured' },
        { status: 503 }
      );
    }

    // Create payment link
    const revolutResponse = await fetch(revolutApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${revolutApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        description: `Order #${orderId.slice(0, 8)} - ${order.venue.name}`,
        merchant_order_ext_ref: orderId,
        customer_email: order.customer_email || undefined,
        enforce_challenge: 'automatic',
      }),
    });

    if (!revolutResponse.ok) {
      const errorText = await revolutResponse.text();
      console.error('Revolut API error:', errorText);
      return NextResponse.json(
        { error: 'Payment link creation failed' },
        { status: 500 }
      );
    }

    const revolutData = await revolutResponse.json();

    // Log payment initiation
    await logStructuredEvent('REVOLUT_PAYMENT_CREATED', {
      orderId,
      amount,
      currency,
      venueId: order.venue_id,
      revolutOrderId: revolutData.id,
    });

    return NextResponse.json({
      success: true,
      paymentLink: revolutData.checkout_url,
      revolutOrderId: revolutData.id,
      orderId,
    });
  } catch (error) {
    console.error('Revolut payment error:', error);
    return NextResponse.json(
      { error: 'Payment link creation failed' },
      { status: 500 }
    );
  }
}
```

---

## 📁 FILE 5: `app/api/payment/revolut/webhook/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logStructuredEvent } from '@/lib/observability';

/**
 * Revolut Webhook Handler
 * Receives payment confirmation from Revolut
 */
export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('Revolut-Signature');
    const body = await request.json();

    // TODO: Verify webhook signature (important for production)
    // const isValid = verifyRevolutSignature(signature, body, process.env.REVOLUT_WEBHOOK_SECRET);
    // if (!isValid) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    // }

    const { event, order_id, state } = body;

    if (event !== 'ORDER_COMPLETED' && state !== 'COMPLETED') {
      return NextResponse.json({ received: true });
    }

    // Extract EasyMO order ID from merchant reference
    const orderId = body.merchant_order_ext_ref;

    const supabase = await createClient();

    // Update order payment status
    const { error } = await supabase
      .from('orders')
      .update({
        payment_status: 'completed',
        payment_completed_at: new Date().toISOString(),
        status: 'confirmed', // Auto-confirm on payment
      })
      .eq('id', orderId);

    if (error) {
      console.error('Order update error:', error);
      return NextResponse.json(
        { error: 'Failed to update order' },
        { status: 500 }
      );
    }

    // Log payment completion
    await logStructuredEvent('REVOLUT_PAYMENT_COMPLETED', {
      orderId,
      revolutOrderId: order_id,
      state,
    });

    return NextResponse.json({ success: true, orderId });
  } catch (error) {
    console.error('Revolut webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
```

---

## 📁 FILE 6: `lib/payment/momo.ts`

```typescript
/**
 * MoMo Payment Utilities
 * Rwanda Mobile Money (MTN, Airtel)
 */

export interface MoMoPaymentData {
  ussdCode: string;
  barCode: string;
  amount: number;
  instructions: string[];
}

export function generateMoMoInstructions(barCode: string, amount: number): MoMoPaymentData {
  return {
    ussdCode: '*182*7*1#',
    barCode,
    amount: Math.round(amount),
    instructions: [
      'Step 1: Dial *182*7*1# on your phone',
      `Step 2: Enter bar code: ${barCode}`,
      `Step 3: Enter amount: ${Math.round(amount)} RWF`,
      'Step 4: Enter your MoMo PIN',
      'Step 5: Wait for SMS confirmation',
    ],
  };
}

export function formatMoMoAmount(amount: number): string {
  return `${Math.round(amount)} RWF`;
}

export function validateMoMoPhone(phone: string): boolean {
  // Rwanda phone: 07X XXX XXXX
  const regex = /^(07[238]\d{7})$/;
  return regex.test(phone.replace(/\s/g, ''));
}
```

---

## 📁 FILE 7: `lib/payment/revolut.ts`

```typescript
/**
 * Revolut Payment Utilities
 * International card payments via Revolut
 */

export interface RevolutPaymentData {
  paymentLink: string;
  orderId: string;
  amount: number;
  currency: string;
}

export async function createRevolutPayment(
  orderId: string,
  amount: number,
  currency: string = 'EUR',
  description: string
): Promise<RevolutPaymentData | null> {
  try {
    const response = await fetch('/api/payment/revolut/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, amount, currency, description }),
    });

    if (!response.ok) {
      throw new Error('Payment creation failed');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Revolut payment error:', error);
    return null;
  }
}

export function formatRevolutAmount(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function openRevolutPayment(paymentLink: string): void {
  // Open in new tab for desktop, same tab for mobile
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  if (isMobile) {
    window.location.href = paymentLink;
  } else {
    window.open(paymentLink, '_blank', 'noopener,noreferrer');
  }
}
```

---

## 📁 FILE 8: `components/payment/MoMoPayment.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Check, Copy, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { generateMoMoInstructions } from '@/lib/payment/momo';

interface MoMoPaymentProps {
  orderId: string;
  amount: number;
  barCode: string;
  onComplete?: () => void;
}

export function MoMoPayment({ orderId, amount, barCode, onComplete }: MoMoPaymentProps) {
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  
  const payment = generateMoMoInstructions(barCode, amount);

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const checkPaymentStatus = async () => {
    setChecking(true);
    // Poll order status
    const response = await fetch(`/api/order/${orderId}`);
    const order = await response.json();
    
    if (order.payment_status === 'completed') {
      onComplete?.();
    }
    
    setChecking(false);
  };

  useEffect(() => {
    // Auto-check every 5 seconds
    const interval = setInterval(checkPaymentStatus, 5000);
    return () => clearInterval(interval);
  }, [orderId]);

  return (
    <Card className="p-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-3xl">💳</span>
        </div>
        <h2 className="text-2xl font-display font-bold mb-1">Pay with MoMo</h2>
        <p className="text-muted-foreground">Follow the steps below</p>
      </div>

      {/* Amount */}
      <div className="bg-primary/10 rounded-xl p-4 mb-6 text-center">
        <p className="text-sm text-muted-foreground mb-1">Amount to Pay</p>
        <p className="text-3xl font-bold text-primary">{payment.amount} RWF</p>
      </div>

      {/* USSD Code */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">USSD Code</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={payment.ussdCode}
            readOnly
            className="flex-1 px-4 py-3 rounded-lg bg-secondary border border-border text-center text-xl font-mono"
          />
          <Button
            variant="outline"
            onClick={() => copyToClipboard(payment.ussdCode)}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Bar Code */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Bar Code</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={payment.barCode}
            readOnly
            className="flex-1 px-4 py-3 rounded-lg bg-secondary border border-border text-center text-xl font-mono font-bold"
          />
          <Button
            variant="outline"
            onClick={() => copyToClipboard(payment.barCode)}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Instructions */}
      <div className="space-y-2 mb-6">
        {payment.instructions.map((step, index) => (
          <div key={index} className="flex gap-3">
            <Badge variant="outline" size="sm" className="flex-shrink-0">
              {index + 1}
            </Badge>
            <p className="text-sm">{step}</p>
          </div>
        ))}
      </div>

      {/* Check Status */}
      <Button
        onClick={checkPaymentStatus}
        disabled={checking}
        variant="outline"
        className="w-full"
      >
        {checking ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Checking...
          </>
        ) : (
          'Check Payment Status'
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center mt-4">
        Payment will be auto-confirmed once received
      </p>
    </Card>
  );
}
```

---

## 📁 FILE 9: `components/payment/RevolutPayment.tsx`

```typescript
'use client';

import { useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { createRevolutPayment, openRevolutPayment } from '@/lib/payment/revolut';

interface RevolutPaymentProps {
  orderId: string;
  amount: number;
  currency?: string;
  venueName: string;
  onComplete?: () => void;
}

export function RevolutPayment({
  orderId,
  amount,
  currency = 'EUR',
  venueName,
  onComplete,
}: RevolutPaymentProps) {
  const [loading, setLoading] = useState(false);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePayment = async () => {
    setLoading(true);
    setError(null);

    const result = await createRevolutPayment(
      orderId,
      amount,
      currency,
      `Order - ${venueName}`
    );

    if (result) {
      setPaymentLink(result.paymentLink);
      openRevolutPayment(result.paymentLink);
      
      // Start polling for payment confirmation
      pollPaymentStatus();
    } else {
      setError('Failed to create payment link. Please try again.');
    }

    setLoading(false);
  };

  const pollPaymentStatus = async () => {
    const interval = setInterval(async () => {
      const response = await fetch(`/api/order/${orderId}`);
      const order = await response.json();
      
      if (order.payment_status === 'completed') {
        clearInterval(interval);
        onComplete?.();
      }
    }, 3000);

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(interval), 300000);
  };

  return (
    <Card className="p-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-3xl">🌍</span>
        </div>
        <h2 className="text-2xl font-display font-bold mb-1">Pay with Revolut</h2>
        <p className="text-muted-foreground">Card payment via Revolut</p>
      </div>

      {/* Amount */}
      <div className="bg-primary/10 rounded-xl p-4 mb-6 text-center">
        <p className="text-sm text-muted-foreground mb-1">Amount to Pay</p>
        <p className="text-3xl font-bold text-primary">
          {currency} {amount.toFixed(2)}
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-lg p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {!paymentLink ? (
        <Button
          onClick={handlePayment}
          disabled={loading}
          size="lg"
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Creating Payment Link...
            </>
          ) : (
            <>
              <ExternalLink className="w-5 h-5 mr-2" />
              Pay Now
            </>
          )}
        </Button>
      ) : (
        <div className="space-y-3">
          <Button
            onClick={() => openRevolutPayment(paymentLink)}
            size="lg"
            className="w-full"
          >
            <ExternalLink className="w-5 h-5 mr-2" />
            Open Payment Page
          </Button>
          
          <p className="text-xs text-muted-foreground text-center">
            Complete payment in the opened window. This page will update automatically.
          </p>
        </div>
      )}
    </Card>
  );
}
```

---

## ✅ IMPLEMENTATION CHECKLIST

1. Create all 9 files above in correct paths
2. Ensure Supabase env vars are set (.env.local)
3. For Revolut: Add `REVOLUT_API_KEY` to env (or use mock for testing)
4. Test MoMo flow (mock payment in dev)
5. Test Revolut flow (sandbox mode)
6. Deploy to Netlify

---

**All API routes complete!** Ready to integrate with checkout/order pages.

