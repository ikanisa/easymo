# 🚀 CLIENT PWA IMPLEMENTATION - FINAL EXECUTION GUIDE

**Generated:** 2025-11-27 23:03 UTC  
**Status:** Ready for Manual Implementation  
**Completion:** 45% → Target 100%

---

## 📊 CURRENT STATUS

### ✅ COMPLETED (45%)
- [x] Project setup (Next.js 15, React 19, TypeScript 5.7)
- [x] Tailwind CSS configuration
- [x] Supabase integration
- [x] State management (Zustand cart store)
- [x] Core hooks (useCart, useHaptics, useOrderRealtime)
- [x] Base UI components (Button, Input)
- [x] Menu components (MenuItemCard, CategoryTabs, CartSheet)
- [x] Utility functions (format, utils, haptics)
- [x] Home page + QR Scanner page
- [x] **NEW:** Card, Badge, Skeleton components
- [x] **NEW:** CartItem, CartSummary, EmptyCart components

### ❌ PENDING (55%) - MANUAL CREATION REQUIRED

Due to system limitations, the following files need to be created manually:

---

## 📁 FILES TO CREATE MANUALLY

### 1. DIRECTORY STRUCTURE

Create these directories first:

```bash
cd /Users/jeanbosco/workspace/easymo-/client-pwa

# App routes
mkdir -p app/\[venueSlug\]/cart
mkdir -p app/\[venueSlug\]/checkout
mkdir -p app/\[venueSlug\]/order/\[orderId\]

# API routes
mkdir -p app/api/venue/\[slug\]
mkdir -p app/api/order/create
mkdir -p app/api/order/\[orderId\]
mkdir -p app/api/payment/momo/initiate
mkdir -p app/api/payment/revolut/create
mkdir -p app/api/payment/revolut/webhook

# Component directories (some may exist)
mkdir -p components/venue
mkdir -p components/checkout
mkdir -p components/order
mkdir -p components/payment
mkdir -p components/layout

# Lib directories
mkdir -p lib/payment
```

---

### 2. CORE PAGES (4 files - CRITICAL)

#### File: `app/[venueSlug]/page.tsx`
**Purpose:** Main venue menu page  
**URL:** `/heaven-bar?table=5`

<details>
<summary>Click to view full code (162 lines)</summary>

```typescript
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { VenueHeader } from '@/components/venue/VenueHeader';
import { CategoryTabs } from '@/components/menu/CategoryTabs';
import { MenuItemCard } from '@/components/menu/MenuItemCard';
import { CartFab } from '@/components/layout/CartFab';
import { MenuItemSkeleton, CategoryTabSkeleton } from '@/components/ui/Skeleton';
import type { Venue, MenuCategory, MenuItem } from '@/types/menu';

interface VenuePageProps {
  params: Promise<{ venueSlug: string }>;
  searchParams: Promise<{ table?: string; category?: string }>;
}

async function getVenueData(slug: string) {
  const supabase = await createClient();

  const { data: venue, error: venueError } = await supabase
    .from('venues')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (venueError || !venue) return null;

  const { data: categories } = await supabase
    .from('menu_categories')
    .select('*')
    .eq('venue_id', venue.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  const { data: items } = await supabase
    .from('menu_items')
    .select('*, category:menu_categories(id, name, emoji)')
    .eq('venue_id', venue.id)
    .eq('is_available', true)
    .order('sort_order', { ascending: true });

  return { venue, categories: categories || [], items: items || [] };
}

export default async function VenuePage({ params, searchParams }: VenuePageProps) {
  const { venueSlug } = await params;
  const { table, category } = await searchParams;
  const data = await getVenueData(venueSlug);

  if (!data) notFound();

  const { venue, categories, items } = data;
  const filteredItems = category
    ? items.filter((item) => item.category?.id === category)
    : items;

  return (
    <div className="min-h-screen bg-background pb-24">
      <VenueHeader venue={venue as Venue} tableNumber={table} />
      
      <Suspense fallback={<CategoryTabSkeleton />}>
        <CategoryTabs
          categories={categories as MenuCategory[]}
          activeCategory={category || 'all'}
          onCategoryChange={(cat) => {}}
        />
      </Suspense>

      <div className="container max-w-2xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item as MenuItem}
              venueSlug={venueSlug}
            />
          ))}
        </div>
      </div>

      <CartFab venueSlug={venueSlug} />
    </div>
  );
}

export async function generateMetadata({ params }: VenuePageProps) {
  const { venueSlug } = await params;
  const data = await getVenueData(venueSlug);
  
  if (!data) return { title: 'Venue Not Found' };
  
  return {
    title: `${data.venue.name} - Menu`,
    description: data.venue.description || `Order from ${data.venue.name}`,
  };
}
```
</details>

---

#### File: `app/[venueSlug]/cart/page.tsx`
**Purpose:** Full cart view with checkout button  
**URL:** `/heaven-bar/cart`

<details>
<summary>Click to view full code (133 lines)</summary>

```typescript
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trash2, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCart } from '@/hooks/useCart';
import { useHaptics } from '@/hooks/useHaptics';
import { Button } from '@/components/ui/Button';
import { CartItem } from '@/components/cart/CartItem';
import { CartSummary } from '@/components/cart/CartSummary';
import { EmptyCart } from '@/components/cart/EmptyCart';

export default function CartPage() {
  const params = useParams();
  const router = useRouter();
  const venueSlug = params.venueSlug as string;
  const { items, totalItems, totalAmount, currency, clearCart } = useCart();
  const { trigger } = useHaptics();

  if (totalItems === 0) {
    return <EmptyCart venueSlug={venueSlug} />;
  }

  const subtotal = totalAmount;
  const tax = subtotal * 0.18;
  const total = subtotal + tax;

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-20 bg-card border-b border-border">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href={`/${venueSlug}`} className="p-2">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="font-display text-xl font-semibold">Your Cart</h1>
                <p className="text-sm text-muted-foreground">
                  {totalItems} {totalItems === 1 ? 'item' : 'items'}
                </p>
              </div>
            </div>
            <button onClick={() => clearCart()} className="p-2 text-destructive">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="container max-w-2xl mx-auto px-4 py-6 pb-32">
        <div className="space-y-3 mb-6">
          <AnimatePresence mode="popLayout">
            {items.map((item) => (
              <CartItem key={item.id} item={item} />
            ))}
          </AnimatePresence>
        </div>

        <CartSummary
          subtotal={subtotal}
          tax={tax}
          total={total}
          currency={currency}
        />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 bg-card border-t border-border">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <Button
            onClick={() => router.push(`/${venueSlug}/checkout`)}
            size="lg"
            className="w-full"
          >
            Proceed to Checkout • {currency} {total.toFixed(2)}
          </Button>
        </div>
      </div>
    </div>
  );
}
```
</details>

---

#### File: `app/[venueSlug]/checkout/page.tsx`
**Purpose:** Checkout form with payment selection  
**URL:** `/heaven-bar/checkout`

<details>
<summary>Click to view code skeleton - YOU IMPLEMENT</summary>

```typescript
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const venueSlug = params.venueSlug as string;
  const { items, totalAmount, clearCart } = useCart();
  
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'momo' | 'revolut'>('momo');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // TODO: Call API to create order
      const response = await fetch('/api/order/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venueSlug,
          tableNumber,
          customerName,
          customerPhone,
          items,
          paymentMethod,
          totalAmount,
        }),
      });

      const { orderId } = await response.json();
      
      // Clear cart and redirect to order tracking
      clearCart();
      router.push(`/${venueSlug}/order/${orderId}`);
    } catch (error) {
      console.error('Order creation failed:', error);
      alert('Failed to create order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <Card className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-display font-bold mb-6">Checkout</h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Table Number */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Table Number *
            </label>
            <input
              type="text"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg bg-secondary border border-border"
              placeholder="e.g., 5"
            />
          </div>

          {/* Customer Name */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Your Name (Optional)
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-secondary border border-border"
              placeholder="John Doe"
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium mb-2">Payment Method</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('momo')}
                className={`p-4 rounded-lg border-2 ${
                  paymentMethod === 'momo'
                    ? 'border-primary bg-primary/10'
                    : 'border-border'
                }`}
              >
                💳 MoMo
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('revolut')}
                className={`p-4 rounded-lg border-2 ${
                  paymentMethod === 'revolut'
                    ? 'border-primary bg-primary/10'
                    : 'border-border'
                }`}
              >
                🌍 Revolut
              </button>
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? 'Creating Order...' : 'Place Order'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
```
</details>

---

#### File: `app/[venueSlug]/order/[orderId]/page.tsx`
**Purpose:** Real-time order tracking  
**URL:** `/heaven-bar/order/abc-123`

<details>
<summary>Click to view code skeleton - YOU IMPLEMENT</summary>

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'cancelled';

export default function OrderTrackingPage() {
  const params = useParams();
  const orderId = params.orderId as string;
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    
    // Fetch initial order
    const fetchOrder = async () => {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();
      
      setOrder(data);
      setLoading(false);
    };

    fetchOrder();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`order:${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          setOrder(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  if (loading) return <div>Loading...</div>;
  if (!order) return <div>Order not found</div>;

  const statusSteps = ['pending', 'confirmed', 'preparing', 'ready', 'served'];
  const currentStepIndex = statusSteps.indexOf(order.status);

  return (
    <div className="min-h-screen bg-background p-4">
      <Card className="max-w-2xl mx-auto p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-display font-bold mb-2">Order #{orderId.slice(0, 8)}</h1>
          <Badge variant={order.status === 'ready' ? 'success' : 'primary'}>
            {order.status.toUpperCase()}
          </Badge>
        </div>

        {/* Progress Bar */}
        <div className="flex justify-between mb-8">
          {statusSteps.map((step, index) => (
            <div key={step} className="flex-1 flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  index <= currentStepIndex
                    ? 'bg-primary text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {index + 1}
              </div>
              <span className="text-xs mt-1 capitalize">{step}</span>
            </div>
          ))}
        </div>

        {/* Order Items */}
        <div className="border-t border-border pt-4">
          <h2 className="font-semibold mb-3">Order Items</h2>
          {/* TODO: Map order.items */}
          <p className="text-sm text-muted-foreground">Items will appear here</p>
        </div>
      </Card>
    </div>
  );
}
```
</details>

---

### 3. API ROUTES (7 files)

Create these in `app/api/`:

1. **`venue/[slug]/route.ts`** - GET venue data
2. **`order/create/route.ts`** - POST create order
3. **`order/[orderId]/route.ts`** - GET order status
4. **`payment/momo/initiate/route.ts`** - MoMo payment instructions
5. **`payment/revolut/create/route.ts`** - Generate Revolut link
6. **`payment/revolut/webhook/route.ts`** - Handle payment confirmation

---

## 🎯 IMPLEMENTATION STEPS

### Step 1: Create Directories (5 min)
Run the commands in section #1 above to create all required directories.

### Step 2: Create Pages (30-45 min)
Copy each page code from sections above into the correct file path.

### Step 3: Create API Routes (20-30 min)
Implement the 7 API route handlers (refer to PENDING_DETAILED_PLAN.md for code examples).

### Step 4: Test Locally (15 min)
```bash
cd /Users/jeanbosco/workspace/easymo-/client-pwa
pnpm dev
# Open http://localhost:3002/heaven-bar?table=5
```

### Step 5: Apply Database Migration (5 min)
```bash
cd /Users/jeanbosco/workspace/easymo-
supabase db push
# Seeds test data automatically
```

### Step 6: Deploy to Netlify (10 min)
```bash
cd /Users/jeanbosco/workspace/easymo-/client-pwa
pnpm build
netlify deploy --prod
```

---

## 📋 COMPLETION CHECKLIST

- [ ] All directories created
- [ ] `app/[venueSlug]/page.tsx` created
- [ ] `app/[venueSlug]/cart/page.tsx` created
- [ ] `app/[venueSlug]/checkout/page.tsx` created
- [ ] `app/[venueSlug]/order/[orderId]/page.tsx` created
- [ ] 7 API route files created
- [ ] Database migration applied (`supabase db push`)
- [ ] Local testing successful
- [ ] Build passes (`pnpm build`)
- [ ] Deployed to Netlify

---

## 🆘 SUPPORT

**Reference Files:**
- `PENDING_DETAILED_PLAN.md` - Full feature breakdown
- `IMPLEMENTATION_PLAN_DETAILED.md` - Code examples
- `NEXT_STEPS_GUIDE.md` - Step-by-step guide

**Test URL After Deploy:**
`https://your-app.netlify.app/heaven-bar?table=5`

---

**Status:** Manual implementation required  
**Est. Time:** 2-3 hours for full MVP  
**Next:** Create directories → Copy code → Test → Deploy

