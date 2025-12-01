# 🚀 Client PWA Implementation Roadmap

**Status**: Phase 1-3 Complete, Phases 4-6 Pending  
**Updated**: 2025-11-27  
**Target**: Production-ready in 3 phases

---

## ✅ **COMPLETED** (Phases 1-3)

### Phase 1: Foundation ✅
- [x] Next.js 15 + TypeScript setup
- [x] Tailwind CSS + design tokens
- [x] PWA manifest
- [x] Service worker config (next-pwa)
- [x] Supabase client (`lib/supabase/`)
- [x] Cart store (Zustand with persistence)
- [x] Haptic feedback system
- [x] View transitions
- [x] Error boundary
- [x] Observability hooks

### Phase 2: Core Components ✅
- [x] Menu components (MenuItemCard, CategoryTabs, VirtualizedMenuList)
- [x] Cart components (CartSheet)
- [x] Payment components (MoMoPayment, RevolutPayment, PaymentSelector)
- [x] Order components (OrderStatus, OrderProgress, OrderItems, OrderReceipt)
- [x] Venue components (QRScanner, VenueHeader, VenueInfo)
- [x] Layout components (PWAInstallPrompt)
- [x] UI components (Button, Input, LottieAnimation, PullToRefresh)

### Phase 3: Hooks & Utilities ✅
- [x] useCart hook
- [x] useHaptics hook
- [x] useOrderRealtime hook
- [x] useSwipeNavigation hook
- [x] Format utilities
- [x] Realtime integration
- [x] Push notifications setup

---

## 🚧 **PENDING** (Phases 4-6)

## **PHASE 4: Dynamic Routes & Pages** [CRITICAL - 2 days]

### 4.1 Venue Page (Highest Priority)
**File**: `app/[venueSlug]/page.tsx`

**Tasks**:
1. Create dynamic route folder structure
2. Fetch venue data from Supabase
3. Fetch menu categories and items
4. Implement category filtering
5. Add search functionality
6. Floating cart FAB
7. Handle table parameter (?table=X)
8. Loading/error states

**Implementation**:
```typescript
// app/[venueSlug]/page.tsx
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { VenueHeader } from '@/components/venue/VenueHeader';
import { CategoryTabs } from '@/components/menu/CategoryTabs';
import { VirtualizedMenuList } from '@/components/menu/VirtualizedMenuList';
import { CartFab } from '@/components/layout/CartFab';

export default async function VenuePage({ 
  params,
  searchParams 
}: { 
  params: { venueSlug: string };
  searchParams: { table?: string };
}) {
  const supabase = createServerSupabaseClient();
  
  // Fetch venue
  const { data: venue } = await supabase
    .from('venues')
    .select('*')
    .eq('slug', params.venueSlug)
    .eq('is_active', true)
    .single();
  
  if (!venue) {
    notFound();
  }
  
  // Fetch categories
  const { data: categories } = await supabase
    .from('menu_categories')
    .select('*')
    .eq('venue_id', venue.id)
    .eq('is_active', true)
    .order('sort_order');
  
  // Fetch menu items
  const { data: items } = await supabase
    .from('menu_items')
    .select('*')
    .eq('venue_id', venue.id)
    .eq('is_available', true)
    .order('created_at', { ascending: false });
  
  return (
    <div className="min-h-screen bg-background">
      <VenueHeader venue={venue} tableNumber={searchParams.table} />
      <CategoryTabs categories={categories} />
      <VirtualizedMenuList items={items} venueSlug={params.venueSlug} />
      <CartFab venueSlug={params.venueSlug} />
    </div>
  );
}
```

**Estimated**: 8 hours

---

### 4.2 Cart Page
**File**: `app/[venueSlug]/cart/page.tsx`

**Tasks**:
1. Display cart items from Zustand store
2. Quantity controls (+/-)
3. Remove item functionality
4. Special instructions input
5. Cart summary (subtotal, tax, total)
6. "Proceed to Checkout" button
7. Empty cart state

**Implementation**:
```typescript
'use client';

import { useCart } from '@/hooks/useCart';
import { CartItem } from '@/components/cart/CartItem';
import { CartSummary } from '@/components/cart/CartSummary';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export default function CartPage({ params }: { params: { venueSlug: string } }) {
  const { items, totalAmount, totalItems } = useCart();
  
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <ShoppingBag className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
        <p className="text-muted-foreground mb-6">Add items to get started</p>
        <Link href={`/${params.venueSlug}`}>
          <Button>Browse Menu</Button>
        </Link>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-4">
        <h1 className="text-xl font-bold">Your Cart ({totalItems} items)</h1>
      </header>
      
      <div className="p-4 space-y-3">
        {items.map(item => (
          <CartItem key={item.id} item={item} />
        ))}
      </div>
      
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 pb-safe-bottom">
        <CartSummary total={totalAmount} />
        <Link href={`/${params.venueSlug}/checkout`}>
          <Button className="w-full mt-4" size="lg">
            Proceed to Checkout
          </Button>
        </Link>
      </div>
    </div>
  );
}
```

**Estimated**: 4 hours

---

### 4.3 Checkout Page
**File**: `app/[venueSlug]/checkout/page.tsx`

**Tasks**:
1. Display order summary
2. Customer info form (name, phone)
3. Table number display
4. Special instructions
5. Payment method selector
6. Create order in Supabase
7. Initiate payment
8. Navigate to order tracking

**Implementation**:
```typescript
'use client';

import { useState } from 'react';
import { useCart } from '@/hooks/useCart';
import { PaymentSelector } from '@/components/payment/PaymentSelector';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function CheckoutPage({ params }: { params: { venueSlug: string } }) {
  const { items, totalAmount, clearCart } = useCart();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'momo' | 'revolut'>('momo');
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  
  const handlePlaceOrder = async () => {
    setIsProcessing(true);
    
    try {
      // Get venue ID
      const { data: venue } = await supabase
        .from('venues')
        .select('id')
        .eq('slug', params.venueSlug)
        .single();
      
      // Create order
      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          venue_id: venue.id,
          table_number: localStorage.getItem('tableNumber'),
          customer_name: customerName,
          customer_phone: customerPhone,
          items: items.map(item => ({
            item_id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity
          })),
          total_amount: totalAmount,
          currency: 'RWF',
          payment_method: paymentMethod,
          status: 'pending_payment'
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Clear cart
      clearCart();
      
      // Navigate to order tracking
      router.push(`/${params.venueSlug}/order/${order.id}`);
    } catch (error) {
      console.error('Order creation failed:', error);
      alert('Failed to create order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-background p-4">
      {/* Form and payment UI */}
      <Button 
        onClick={handlePlaceOrder} 
        disabled={isProcessing}
        className="w-full mt-6"
      >
        {isProcessing ? 'Processing...' : `Pay ${totalAmount} RWF`}
      </Button>
    </div>
  );
}
```

**Estimated**: 6 hours

---

### 4.4 Order Tracking Page
**File**: `app/[venueSlug]/order/[orderId]/page.tsx`

**Tasks**:
1. Fetch order from Supabase
2. Subscribe to real-time updates
3. Display order status timeline
4. Show estimated time
5. Confetti on "ready" status
6. Payment status indicator
7. Rating dialog after served

**Implementation**:
```typescript
'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { useOrderRealtime } from '@/hooks/useOrderRealtime';
import { OrderProgress } from '@/components/order/OrderProgress';
import confetti from 'canvas-confetti';

export default function OrderTrackingPage({ 
  params 
}: { 
  params: { venueSlug: string; orderId: string } 
}) {
  const [order, setOrder] = useState(null);
  const supabase = createBrowserSupabaseClient();
  
  // Subscribe to real-time updates
  useOrderRealtime(params.orderId, (updatedOrder) => {
    setOrder(updatedOrder);
    
    // Trigger confetti on ready
    if (updatedOrder.status === 'ready') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  });
  
  useEffect(() => {
    const fetchOrder = async () => {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('id', params.orderId)
        .single();
      
      setOrder(data);
    };
    
    fetchOrder();
  }, [params.orderId]);
  
  if (!order) return <div>Loading...</div>;
  
  return (
    <div className="min-h-screen bg-background p-4">
      <OrderProgress order={order} />
      {/* Order details */}
    </div>
  );
}
```

**Estimated**: 6 hours

---

## **PHASE 5: Database Schema** [CRITICAL - 1 day]

### 5.1 Create Migration
**File**: `supabase/migrations/20251127000000_client_pwa_schema.sql`

```sql
BEGIN;

-- Venues table
CREATE TABLE IF NOT EXISTS public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  hours JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Menu categories
CREATE TABLE IF NOT EXISTS public.menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Menu items
CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  category_id UUID REFERENCES menu_categories(id),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'RWF',
  image_url TEXT,
  emoji TEXT,
  is_available BOOLEAN DEFAULT true,
  is_popular BOOLEAN DEFAULT false,
  is_vegetarian BOOLEAN DEFAULT false,
  prep_time_minutes INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES venues(id),
  table_number TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  items JSONB NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'RWF',
  payment_method TEXT CHECK (payment_method IN ('momo', 'revolut', 'cash')),
  payment_status TEXT DEFAULT 'pending',
  status TEXT DEFAULT 'pending',
  special_instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  ready_at TIMESTAMPTZ,
  served_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_menu_items_venue ON menu_items(venue_id);
CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_orders_venue ON orders(venue_id);
CREATE INDEX idx_orders_status ON orders(status);

-- RLS Policies
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public venues" ON venues FOR SELECT USING (is_active = true);
CREATE POLICY "Public categories" ON menu_categories FOR SELECT USING (is_active = true);
CREATE POLICY "Public menu items" ON menu_items FOR SELECT USING (is_available = true);
CREATE POLICY "Anyone can create orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view orders" ON orders FOR SELECT USING (true);

COMMIT;
```

**Tasks**:
1. Create migration file
2. Apply migration: `supabase db push`
3. Verify tables created
4. Create seed data

**Estimated**: 3 hours

---

### 5.2 Seed Data
**File**: `supabase/seed/client_pwa_seed.sql`

```sql
-- Insert demo venue
INSERT INTO venues (slug, name, logo_url, address, hours) VALUES
('heaven-bar', 'Heaven Bar & Restaurant', '/venues/heaven-logo.png', 'KG 123 St, Kigali', 
 '{"mon": "10:00-23:00", "tue": "10:00-23:00", "wed": "10:00-23:00", "thu": "10:00-23:00", "fri": "10:00-01:00", "sat": "10:00-01:00", "sun": "12:00-22:00"}');

-- Get venue ID
DO $$
DECLARE
  venue_id UUID;
  appetizers_id UUID;
  mains_id UUID;
  drinks_id UUID;
BEGIN
  SELECT id INTO venue_id FROM venues WHERE slug = 'heaven-bar';

  -- Categories
  INSERT INTO menu_categories (venue_id, name, emoji, sort_order) VALUES
  (venue_id, 'Appetizers', '🍟', 1) RETURNING id INTO appetizers_id;
  
  INSERT INTO menu_categories (venue_id, name, emoji, sort_order) VALUES
  (venue_id, 'Main Courses', '🍕', 2) RETURNING id INTO mains_id;
  
  INSERT INTO menu_categories (venue_id, name, emoji, sort_order) VALUES
  (venue_id, 'Drinks', '🍺', 3) RETURNING id INTO drinks_id;

  -- Menu items
  INSERT INTO menu_items (venue_id, category_id, name, description, price, is_popular, prep_time_minutes) VALUES
  (venue_id, appetizers_id, 'French Fries', 'Crispy golden fries', 3000, true, 10),
  (venue_id, mains_id, 'Margherita Pizza', 'Classic tomato & mozzarella', 12000, true, 20),
  (venue_id, drinks_id, 'Primus Beer', 'Local beer (330ml)', 1500, false, 2);
END $$;
```

**Estimated**: 2 hours

---

## **PHASE 6: Payment Integration** [2 days]

### 6.1 MoMo API Routes
**Files**: 
- `app/api/payment/momo/initiate/route.ts`
- `app/api/payment/momo/status/[txId]/route.ts`

**Tasks**:
1. MoMo API authentication
2. USSD push initiation
3. Payment status polling
4. Webhook handler
5. Update order status

**Note**: MoMo uses USSD, not direct API. User dials *182*7# and enters amount.

**Estimated**: 8 hours

---

### 6.2 Revolut Link Integration
**File**: `app/api/payment/revolut/create/route.ts`

**Tasks**:
1. Generate Revolut payment link
2. Store payment session
3. Handle redirect callback
4. Update order on success

**Estimated**: 6 hours

---

## **OPTIONAL ENHANCEMENTS** (Post-MVP)

### Search & Filters
- [ ] SearchBar component with debounce
- [ ] FilterSheet (dietary, price range)
- [ ] Search API route

### Advanced PWA
- [ ] Offline queue for orders
- [ ] Background sync
- [ ] Advanced service worker caching

### Analytics
- [ ] Track user events
- [ ] Performance monitoring
- [ ] Error tracking (Sentry)

### Testing
- [ ] Unit tests (Vitest)
- [ ] E2E tests (Playwright)
- [ ] Cross-browser testing

---

## 📅 Timeline Summary

| Phase | Duration | Priority | Tasks |
|-------|----------|----------|-------|
| **Phase 4: Routes** | 2 days | CRITICAL | Venue, Cart, Checkout, Order pages |
| **Phase 5: Database** | 1 day | CRITICAL | Migrations, seed data |
| **Phase 6: Payments** | 2 days | HIGH | MoMo & Revolut integration |
| **Optional** | 1-2 weeks | LOW | Search, analytics, tests |

**Total Critical Path**: 5 days

---

## 🚀 Next Steps

### Immediate (Today):
1. Create dynamic route structure: `app/[venueSlug]/page.tsx`
2. Apply database migrations
3. Test venue page with seed data

### This Week:
1. Complete all 4 dynamic pages
2. Test full user flow (QR → Menu → Cart → Checkout → Order)
3. Implement at least MoMo payment

### Deployment Checklist:
- [ ] All critical routes working
- [ ] Database tables created
- [ ] At least one payment method working
- [ ] PWA installable
- [ ] Environment variables configured
- [ ] Deployed to Netlify

---

## 📊 Progress Tracker

**Completed**: 60% (Foundation + Components)  
**Remaining**: 40% (Routes + Database + Payments)  
**Production Ready**: 5 days from now

---

**Questions?** Start with Phase 4.1 (Venue Page) - it's the most critical blocker.
