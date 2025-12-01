# 🚀 CLIENT PWA - IMPLEMENTATION EXECUTION PLAN

**Generated:** 2025-11-27  
**Status:** Ready to execute  
**Execution Time:** 20-30 hours (3-4 days)

---

## 📋 PREREQUISITES

Before starting, ensure:
1. ✅ Database migrations applied: `cd .. && supabase db push`
2. ✅ Dependencies installed: `pnpm install --frozen-lockfile`
3. ✅ Environment configured: `.env.local` has Supabase credentials

---

## PHASE 1: CREATE DIRECTORY STRUCTURE

Run these commands in `/Users/jeanbosco/workspace/easymo-/client-pwa`:

```bash
# API Routes
mkdir -p app/api/venue/\[slug\]/menu
mkdir -p app/api/order/create
mkdir -p app/api/order/\[orderId\]
mkdir -p app/api/payment/momo/initiate
mkdir -p app/api/payment/revolut/create
mkdir -p app/api/payment/revolut/webhook

# Pages
mkdir -p app/\[venueSlug\]/cart
mkdir -p app/\[venueSlug\]/checkout
mkdir -p app/\[venueSlug\]/order/\[orderId\]

# Components
mkdir -p components/venue
mkdir -p components/layout
mkdir -p components/checkout
mkdir -p components/order
mkdir -p components/payment
mkdir -p components/ui
mkdir -p components/cart

# Lib
mkdir -p lib/payment
```

---

## PHASE 2: TYPES (Already Created ✅)

- ✅ `types/venue.ts`
- ✅ `types/order.ts`

---

## PHASE 3: API ROUTES

### 3.1 Venue API

**File:** `app/api/venue/[slug]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { VenueWithMenu } from '@/types/venue';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = await createClient();
    const { slug } = await params;

    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (venueError || !venue) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 });
    }

    const { data: categories } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('venue_id', venue.id)
      .eq('is_active', true)
      .order('display_order');

    const { data: items } = await supabase
      .from('menu_items')
      .select('*')
      .eq('venue_id', venue.id)
      .eq('is_available', true)
      .order('display_order');

    const response: VenueWithMenu = {
      venue,
      categories: categories || [],
      items: items || [],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching venue:', error);
    return NextResponse.json({ error: 'Failed to fetch venue data' }, { status: 500 });
  }
}
```

---

**File:** `app/api/venue/[slug]/menu/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = await createClient();
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const categorySlug = searchParams.get('category');

    const { data: venue } = await supabase
      .from('venues')
      .select('id')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (!venue) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 });
    }

    let query = supabase
      .from('menu_items')
      .select('*')
      .eq('venue_id', venue.id)
      .eq('is_available', true);

    if (categorySlug) {
      const { data: category } = await supabase
        .from('menu_categories')
        .select('id')
        .eq('slug', categorySlug)
        .eq('venue_id', venue.id)
        .single();

      if (category) {
        query = query.eq('category_id', category.id);
      }
    }

    const { data: items } = await query.order('display_order');
    return NextResponse.json(items || []);
  } catch (error) {
    console.error('Error fetching menu:', error);
    return NextResponse.json({ error: 'Failed to fetch menu items' }, { status: 500 });
  }
}
```

---

### 3.2 Order API

**File:** `app/api/order/create/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { CreateOrderRequest, CreateOrderResponse } from '@/types/order';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body: CreateOrderRequest = await request.json();

    if (!body.venue_id || !body.table_number || !body.items?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const subtotal = body.items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0
    );
    const tax_amount = subtotal * 0.18; // 18% VAT (Rwanda)
    const total_amount = subtotal + tax_amount;

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        venue_id: body.venue_id,
        table_number: body.table_number,
        customer_name: body.customer_name,
        customer_phone: body.customer_phone,
        status: 'payment_pending',
        payment_method: body.payment_method,
        payment_status: 'pending',
        subtotal,
        tax_amount,
        total_amount,
        currency: 'RWF',
        special_instructions: body.special_instructions,
      })
      .select()
      .single();

    if (orderError || !order) {
      throw orderError || new Error('Failed to create order');
    }

    const orderItems = body.items.map((item) => ({
      order_id: order.id,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.unit_price * item.quantity,
      notes: item.notes,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      await supabase.from('orders').delete().eq('id', order.id);
      throw itemsError;
    }

    let payment_instructions;
    if (body.payment_method === 'momo') {
      const { data: venue } = await supabase
        .from('venues')
        .select('momo_bar_code')
        .eq('id', body.venue_id)
        .single();

      payment_instructions = {
        ussd_code: '*182*7*1#',
        bar_code: venue?.momo_bar_code || '000000',
        instructions: `1. Dial *182*7*1# on your phone\n2. Select "Pay Bill"\n3. Enter Bar Code: ${venue?.momo_bar_code || '000000'}\n4. Enter Amount: ${total_amount.toFixed(0)} RWF\n5. Confirm payment`,
      };
    } else if (body.payment_method === 'revolut') {
      payment_instructions = {
        payment_link: '#',
        instructions: 'Click the link to complete payment via Revolut',
      };
    } else {
      payment_instructions = {
        instructions: 'Please pay at the counter when your order is ready',
      };
    }

    const response: CreateOrderResponse = {
      order_id: order.id,
      status: order.status,
      payment_instructions,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
```

---

**File:** `app/api/order/[orderId]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const supabase = await createClient();
    const { orderId } = await params;

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*)
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}
```

---

## PHASE 4: CORE PAGES

### 4.1 Venue Menu Page

**File:** `app/[venueSlug]/page.tsx`

```typescript
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { VenueHeader } from '@/components/venue/VenueHeader';
import { CategoryTabs } from '@/components/menu/CategoryTabs';
import { MenuItemCard } from '@/components/menu/MenuItemCard';
import { CartFab } from '@/components/layout/CartFab';
import type { VenueWithMenu } from '@/types/venue';

export default async function VenuePage({
  params,
  searchParams,
}: {
  params: { venueSlug: string };
  searchParams: { table?: string };
}) {
  const { venueSlug } = await params;
  
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002'}/api/venue/${venueSlug}`,
    { next: { revalidate: 60 } }
  );

  if (!response.ok) {
    notFound();
  }

  const { venue, categories, items }: VenueWithMenu = await response.json();

  return (
    <div className="min-h-screen-safe bg-background pb-20">
      <VenueHeader venue={venue} tableNumber={searchParams.table} />
      
      <div className="sticky top-0 z-20">
        <CategoryTabs 
          categories={categories}
          activeCategory={categories[0]?.id || ''}
          onCategoryChange={(id) => {
            // Client-side category filtering
          }}
        />
      </div>

      <div className="container px-4 py-6">
        <div className="grid grid-cols-2 gap-4">
          {items.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              venueSlug={venueSlug}
            />
          ))}
        </div>
      </div>

      <CartFab venueSlug={venueSlug} />
    </div>
  );
}
```

---

### 4.2 Cart Page

**File:** `app/[venueSlug]/cart/page.tsx`

```typescript
'use client';

import { useCartStore } from '@/stores/cart.store';
import { CartItem } from '@/components/cart/CartItem';
import { CartSummary } from '@/components/cart/CartSummary';
import { EmptyCart } from '@/components/cart/EmptyCart';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';

export default function CartPage({ params }: { params: { venueSlug: string } }) {
  const router = useRouter();
  const { items, getTotalAmount } = useCartStore();

  if (items.length === 0) {
    return <EmptyCart venueSlug={params.venueSlug} />;
  }

  return (
    <div className="min-h-screen-safe bg-background">
      <div className="sticky top-0 z-10 bg-background border-b border-border p-4">
        <h1 className="text-2xl font-bold">Your Cart</h1>
        <p className="text-muted-foreground">{items.length} items</p>
      </div>

      <div className="container px-4 py-6 space-y-4">
        {items.map((item) => (
          <CartItem key={item.id} item={item} />
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 notch-safe-bottom">
        <CartSummary />
        <Button
          className="w-full mt-4"
          onClick={() => router.push(`/${params.venueSlug}/checkout`)}
        >
          Proceed to Checkout • {getTotalAmount().toFixed(0)} RWF
        </Button>
      </div>
    </div>
  );
}
```

---

### 4.3 Checkout Page

**File:** `app/[venueSlug]/checkout/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/stores/cart.store';
import { CheckoutForm } from '@/components/checkout/CheckoutForm';
import { OrderSummary } from '@/components/checkout/OrderSummary';
import { PaymentSelector } from '@/components/payment/PaymentSelector';
import type { PaymentMethod } from '@/types/order';

export default function CheckoutPage({ params }: { params: { venueSlug: string } }) {
  const router = useRouter();
  const { items, venueId, tableNumber, getTotalAmount, clearCart } = useCartStore();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('momo');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: { 
    table_number: string;
    customer_name?: string;
    customer_phone?: string;
    special_instructions?: string;
  }) => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/order/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venue_id: venueId,
          table_number: data.table_number,
          customer_name: data.customer_name,
          customer_phone: data.customer_phone,
          payment_method: paymentMethod,
          special_instructions: data.special_instructions,
          items: items.map(item => ({
            menu_item_id: item.menuItemId,
            quantity: item.quantity,
            unit_price: item.price,
            notes: item.notes,
          })),
        }),
      });

      if (!response.ok) throw new Error('Failed to create order');

      const { order_id } = await response.json();
      clearCart();
      router.push(`/${params.venueSlug}/order/${order_id}`);
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to place order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen-safe bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background border-b border-border p-4">
        <h1 className="text-2xl font-bold">Checkout</h1>
      </div>

      <div className="container px-4 py-6 space-y-6">
        <OrderSummary items={items} total={getTotalAmount()} />
        
        <PaymentSelector
          value={paymentMethod}
          onChange={setPaymentMethod}
        />

        <CheckoutForm
          defaultTableNumber={tableNumber || ''}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}
```

---

### 4.4 Order Tracking Page

**File:** `app/[venueSlug]/order/[orderId]/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useOrderRealtime } from '@/hooks/useOrderRealtime';
import { OrderTracker } from '@/components/order/OrderTracker';
import { OrderProgress } from '@/components/order/OrderProgress';
import { OrderItems } from '@/components/order/OrderItems';
import { OrderReceipt } from '@/components/order/OrderReceipt';
import type { Order } from '@/types/order';

export default function OrderPage({ params }: { params: { orderId: string } }) {
  const [order, setOrder] = useState<Order | null>(null);
  const { orderId } = params;

  // Real-time order updates
  useOrderRealtime(orderId, (updatedOrder) => {
    setOrder(updatedOrder);
  });

  // Initial fetch
  useEffect(() => {
    fetch(`/api/order/${orderId}`)
      .then(res => res.json())
      .then(setOrder)
      .catch(console.error);
  }, [orderId]);

  if (!order) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen-safe bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background border-b border-border p-4">
        <h1 className="text-2xl font-bold">Order Tracking</h1>
        <p className="text-muted-foreground">Order #{order.id.slice(0, 8)}</p>
      </div>

      <div className="container px-4 py-6 space-y-6">
        <OrderTracker status={order.status} />
        <OrderProgress status={order.status} estimatedTime={order.estimated_ready_at} />
        <OrderItems items={order.items || []} />
        <OrderReceipt order={order} />
      </div>
    </div>
  );
}
```

---

## PHASE 5: COMPONENTS

I'll provide the remaining 28 components in the next response. Would you like me to:

1. **Continue with all component implementations** (I'll create all 28 components)
2. **Create a script that generates all files** (automated setup)
3. **Provide manual copy-paste files** (you create them manually)

**Choose option 1** and I'll continue with the complete implementation.
