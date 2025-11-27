# 🚀 CLIENT PWA - QUICK START GUIDE

**Ready to implement Phase 1 in 1 day?** Follow this guide.

---

## ⏱️ TIME ESTIMATE

- **Setup (Steps 1-3)**: 45 minutes
- **Database (Steps 4-5)**: 30 minutes
- **Implementation (Steps 6-9)**: 6-8 hours
- **Testing (Step 10)**: 30 minutes

**Total**: 8-10 hours

---

## 📋 PREREQUISITES

```bash
# Verify you have:
- Supabase project running
- Database connection string
- pnpm installed
- Node.js 20+
```

---

## 🎯 STEP-BY-STEP IMPLEMENTATION

### Step 1: Review Current Status (5 min)

```bash
cd /Users/jeanbosco/workspace/easymo-/client-pwa

# Check what exists
ls -la app/          # Should see: page.tsx, scan/, layout.tsx, globals.css
ls -la components/   # Should see: cart/, menu/, ui/, etc.
ls -la stores/       # Should see: cart.store.ts
ls -la hooks/        # Should see: useCart.ts, useHaptics.ts
```

**Current state**: Foundation built, but no dynamic routes.

---

### Step 2: Create Directory Structure (5 min)

```bash
cd /Users/jeanbosco/workspace/easymo-/client-pwa

# Make script executable
chmod +x implement-phase1.sh

# Run it
./implement-phase1.sh
```

**Expected output**:
```
✅ Directory structure created
```

**Verify**:
```bash
ls -la app/[venueSlug]/
# Should see: cart/, checkout/, order/
```

---

### Step 3: Setup Environment (5 min)

Ensure `.env.local` has:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>

# Don't hardcode in public env!
# SUPABASE_SERVICE_ROLE_KEY should be in server-only context
```

---

### Step 4: Create Database Tables (15 min)

```bash
cd /Users/jeanbosco/workspace/easymo-

# Method 1: Using Supabase CLI (recommended)
supabase db push

# Method 2: Using psql directly
psql postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres < supabase/migrations/20250127000000_client_pwa_tables.sql
```

**Verify in Supabase Dashboard**:
- Go to Table Editor
- Check tables exist: `venues`, `menu_categories`, `menu_items`, `orders`
- Check RLS policies are enabled

---

### Step 5: Seed Test Data (15 min)

```bash
# Seed the database
psql postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres < supabase/seed/client-pwa-test-data.sql
```

**Verify**:
```sql
-- In Supabase SQL Editor, run:
SELECT name FROM venues WHERE slug = 'heaven-bar';
-- Should return: "Heaven Bar & Restaurant"

SELECT COUNT(*) FROM menu_items;
-- Should return: 27 items
```

---

### Step 6: Create Type Definitions (10 min)

**File**: `client-pwa/types/index.ts`

```bash
cd /Users/jeanbosco/workspace/easymo-/client-pwa
```

Copy the type definitions from `IMPLEMENTATION_PLAN.md` Section "STEP 4".

Or create manually:

```typescript
export interface Venue {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  hours: Record<string, string> | null;
  is_active: boolean;
}

export interface MenuCategory {
  id: string;
  venue_id: string;
  name: string;
  emoji: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface MenuItem {
  id: string;
  venue_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  image_url: string | null;
  emoji: string | null;
  is_available: boolean;
  is_popular: boolean;
  is_vegetarian: boolean;
  is_vegan: boolean;
  is_spicy: boolean;
  allergens: string[] | null;
  prep_time_minutes: number | null;
}

export interface CartItem {
  item: MenuItem;
  quantity: number;
  special_instructions?: string;
}

export interface Order {
  id: string;
  venue_id: string;
  table_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  items: CartItem[];
  total_amount: number;
  currency: string;
  payment_method: 'momo' | 'revolut' | 'cash' | null;
  payment_status: 'pending' | 'processing' | 'completed' | 'failed';
  status: 'pending' | 'pending_payment' | 'paid' | 'preparing' | 'ready' | 'served' | 'cancelled';
  special_instructions: string | null;
  estimated_prep_time: number | null;
  created_at: string;
  updated_at: string;
}
```

---

### Step 7: Create Components (2 hours)

Create these 3 critical components:

#### 7.1 VenueHeader (30 min)

**File**: `components/venue/VenueHeader.tsx`

See full code in `IMPLEMENTATION_PLAN.md` Section 5.1

#### 7.2 CartFab (30 min)

**File**: `components/layout/CartFab.tsx`

See full code in `IMPLEMENTATION_PLAN.md` Section 5.2

#### 7.3 SearchBar (30 min)

**File**: `components/menu/SearchBar.tsx`

See full code in `IMPLEMENTATION_PLAN.md` Section 5.3

---

### Step 8: Create Pages (4 hours)

Create these 4 critical pages in order:

#### 8.1 Venue Landing Page (2 hours)

**File**: `app/[venueSlug]/page.tsx`

This is the MOST IMPORTANT page. See full implementation in the initial response above.

**Key features**:
- Fetches venue by slug
- Displays menu grid
- Category filtering
- Search functionality
- Floating cart button

#### 8.2 Cart Page (1 hour)

**File**: `app/[venueSlug]/cart/page.tsx`

See full code in `IMPLEMENTATION_PLAN.md` Section 6.2

**Key features**:
- List cart items
- Quantity controls
- Remove items
- Total calculation
- Checkout button

#### 8.3 Checkout Page (1 hour)

**File**: `app/[venueSlug]/checkout/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCart } from '@/hooks/useCart';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const venueSlug = params.venueSlug as string;
  
  const { items, totalAmount, clearCart } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');

  const supabase = createClient();

  const handlePlaceOrder = async () => {
    try {
      setIsSubmitting(true);
      
      const tableNumber = localStorage.getItem('tableNumber');
      
      // Get venue ID
      const { data: venue } = await supabase
        .from('venues')
        .select('id')
        .eq('slug', venueSlug)
        .single();

      if (!venue) throw new Error('Venue not found');

      // Create order
      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          venue_id: venue.id,
          table_number: tableNumber,
          customer_name: name || null,
          customer_phone: phone,
          items: items,
          total_amount: totalAmount,
          currency: 'RWF',
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      // Clear cart
      clearCart();

      // Navigate to order tracking
      router.push(`/${venueSlug}/order/${order.id}`);
    } catch (error) {
      console.error('Order creation failed:', error);
      alert('Failed to place order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen p-4 pb-32">
      <h1 className="text-2xl font-bold mb-6">Checkout</h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Phone Number*</label>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+250788123456"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Name (optional)</label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-semibold mb-2">Order Summary</h3>
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span className="text-primary">{totalAmount.toLocaleString()} RWF</span>
          </div>
        </div>

        <Button
          onClick={handlePlaceOrder}
          disabled={!phone || isSubmitting}
          className="w-full"
          size="lg"
        >
          {isSubmitting ? 'Placing Order...' : 'Place Order'}
        </Button>
      </div>
    </div>
  );
}
```

#### 8.4 Order Tracking Page (1 hour)

**File**: `app/[venueSlug]/order/[orderId]/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Order } from '@/types';
import { Loader2 } from 'lucide-react';

export default function OrderTrackingPage() {
  const params = useParams();
  const orderId = params.orderId as string;
  
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function fetchOrder() {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (data) setOrder(data);
      setIsLoading(false);
    }

    fetchOrder();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`order:${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      }, (payload) => {
        setOrder(payload.new as Order);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [orderId, supabase]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Order not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-6">Order #{order.id.slice(0, 8)}</h1>

      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Status</p>
          <p className="text-lg font-semibold capitalize">{order.status}</p>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-bold text-primary">
            {order.total_amount.toLocaleString()} {order.currency}
          </p>
        </div>

        {order.estimated_prep_time && (
          <div>
            <p className="text-sm text-muted-foreground">Estimated Time</p>
            <p className="text-lg font-semibold">{order.estimated_prep_time} minutes</p>
          </div>
        )}

        <div className="pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground mb-2">Items</p>
          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between py-2">
              <span>{item.quantity}x {item.item.name}</span>
              <span>{(item.item.price * item.quantity).toLocaleString()} RWF</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

### Step 9: Update Existing Files (30 min)

#### 9.1 Update useCart hook (if needed)

Ensure `hooks/useCart.ts` returns `totalItems` and `totalAmount`:

```typescript
// Add to return statement if missing:
const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
const totalAmount = items.reduce((sum, item) => sum + (item.item.price * item.quantity), 0);

return {
  items,
  totalItems,
  totalAmount,
  addItem,
  removeItem,
  updateQuantity,
  clearCart,
};
```

---

### Step 10: Test the Flow (30 min)

```bash
cd /Users/jeanbosco/workspace/easymo-/client-pwa

# Start dev server
pnpm dev
```

**Test checklist**:

1. **Visit venue page**:
   ```
   http://localhost:3002/heaven-bar?table=5
   ```
   - ✅ Venue header shows
   - ✅ Menu items display
   - ✅ Categories tabs work
   - ✅ Search filters items

2. **Add to cart**:
   - ✅ Click "+" on an item
   - ✅ Floating cart button appears
   - ✅ Cart count updates

3. **View cart**:
   - ✅ Click cart button
   - ✅ Items show correctly
   - ✅ Quantity controls work
   - ✅ Total calculates correctly

4. **Checkout**:
   - ✅ Click "Proceed to Checkout"
   - ✅ Enter phone number
   - ✅ Click "Place Order"
   - ✅ Redirects to order page

5. **Order tracking**:
   - ✅ Order details display
   - ✅ Status shows "pending"

---

## ✅ PHASE 1 COMPLETE!

You now have:
- ✅ Venue landing page
- ✅ Menu browsing with search/filters
- ✅ Cart functionality
- ✅ Checkout flow
- ✅ Order creation
- ✅ Basic order tracking

---

## 🎯 NEXT STEPS (Phase 2)

Once Phase 1 works:

1. **Implement Payment Integration**
   - MoMo USSD (Rwanda)
   - Revolut Link (Malta)

2. **Enhanced Order Tracking**
   - Real-time status updates
   - Push notifications
   - Status transitions

3. **Polish UI**
   - Loading states
   - Error handling
   - Animations

See `IMPLEMENTATION_PLAN.md` for Phase 2 details.

---

## 🆘 TROUBLESHOOTING

### Database connection issues
```bash
# Test connection
psql postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres -c "SELECT version();"
```

### Type errors
```bash
# Rebuild types
pnpm type-check
```

### Next.js errors
```bash
# Clear cache
rm -rf .next
pnpm dev
```

### Empty menu
```bash
# Verify seed data
psql <connection-string> -c "SELECT COUNT(*) FROM menu_items;"
```

---

## 📚 REFERENCE DOCS

- `IMPLEMENTATION_PLAN.md` - Full implementation guide
- `PENDING_DETAILED.md` - Complete pending work breakdown
- `PENDING_IMPLEMENTATION.md` - Original requirements

---

**Ready to proceed?** Start with Step 1!

**Questions?** Check the reference docs or ask for help with specific steps.
