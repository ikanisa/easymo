# 🎯 CLIENT PWA - PHASE 1 IMPLEMENTATION PLAN

**Status**: Ready to implement  
**Priority**: CRITICAL (Blockers)  
**Estimated Time**: 21 hours  
**Target**: Core ordering flow functional

---

## 📋 OVERVIEW

Phase 1 implements the **minimum viable ordering flow**:
```
QR Scan → Venue Page → Browse Menu → Add to Cart → Checkout → Order Tracking
```

---

## 🗂️ STEP 1: CREATE DIRECTORIES

Run this first:

```bash
cd /Users/jeanbosco/workspace/easymo-/client-pwa
chmod +x implement-phase1.sh
./implement-phase1.sh
```

This creates:
```
app/[venueSlug]/
app/[venueSlug]/cart/
app/[venueSlug]/checkout/
app/[venueSlug]/order/[orderId]/
components/layout/
components/venue/
types/
```

---

## 🔧 STEP 2: CREATE DATABASE TABLES

**File**: Create `supabase/migrations/20250127000000_client_pwa_tables.sql`

```sql
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

-- Menu Categories
CREATE TABLE IF NOT EXISTS public.menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Menu Items
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
  is_vegan BOOLEAN DEFAULT false,
  is_spicy BOOLEAN DEFAULT false,
  allergens TEXT[],
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
  payment_tx_id TEXT,
  status TEXT DEFAULT 'pending',
  special_instructions TEXT,
  estimated_prep_time INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  ready_at TIMESTAMPTZ,
  served_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_menu_items_venue ON menu_items(venue_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_venue ON orders(venue_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- RLS Policies
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public venues" ON venues FOR SELECT USING (is_active = true);
CREATE POLICY "Public categories" ON menu_categories FOR SELECT USING (is_active = true);
CREATE POLICY "Public items" ON menu_items FOR SELECT USING (is_available = true);
CREATE POLICY "Anyone can create orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Anyone can update orders" ON orders FOR UPDATE USING (true);
```

**Apply migration**:
```bash
cd /Users/jeanbosco/workspace/easymo-
supabase db push
```

---

## 🌱 STEP 3: SEED TEST DATA

**File**: Create `supabase/seed/client-pwa-test-data.sql`

```sql
-- Insert test venue
INSERT INTO public.venues (slug, name, logo_url, address, phone, hours) VALUES
('heaven-bar', 'Heaven Bar & Restaurant', 'https://placeholder.co/200x200/f9a825/0a0a0a?text=Heaven', 
 'KG 123 St, Kigali, Rwanda', '+250788123456',
 '{"mon": "10:00-23:00", "tue": "10:00-23:00", "wed": "10:00-23:00", "thu": "10:00-23:00", "fri": "10:00-01:00", "sat": "10:00-01:00", "sun": "12:00-22:00"}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- Get venue ID
DO $$
DECLARE
  v_id UUID;
  cat_appetizers UUID;
  cat_mains UUID;
  cat_drinks UUID;
BEGIN
  SELECT id INTO v_id FROM venues WHERE slug = 'heaven-bar';

  -- Insert categories
  INSERT INTO menu_categories (venue_id, name, emoji, sort_order) 
  VALUES (v_id, 'Appetizers', '🍟', 1) 
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_appetizers;

  INSERT INTO menu_categories (venue_id, name, emoji, sort_order) 
  VALUES (v_id, 'Main Courses', '🍕', 2)
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_mains;

  INSERT INTO menu_categories (venue_id, name, emoji, sort_order) 
  VALUES (v_id, 'Drinks', '🍺', 3)
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_drinks;

  -- Get category IDs if already exist
  IF cat_appetizers IS NULL THEN
    SELECT id INTO cat_appetizers FROM menu_categories WHERE venue_id = v_id AND name = 'Appetizers';
  END IF;
  IF cat_mains IS NULL THEN
    SELECT id INTO cat_mains FROM menu_categories WHERE venue_id = v_id AND name = 'Main Courses';
  END IF;
  IF cat_drinks IS NULL THEN
    SELECT id INTO cat_drinks FROM menu_categories WHERE venue_id = v_id AND name = 'Drinks';
  END IF;

  -- Insert menu items (only if not exists)
  INSERT INTO menu_items (venue_id, category_id, name, description, price, emoji, is_popular, is_vegetarian, prep_time_minutes) 
  VALUES 
  (v_id, cat_appetizers, 'French Fries', 'Crispy golden fries with special sauce', 3000.00, '🍟', true, true, 10),
  (v_id, cat_appetizers, 'Chicken Wings', 'Spicy buffalo wings (6 pcs)', 5000.00, '🍗', true, false, 15),
  (v_id, cat_appetizers, 'Spring Rolls', 'Vegetable spring rolls (4 pcs)', 4000.00, '🥟', false, true, 12),
  
  (v_id, cat_mains, 'Margherita Pizza', 'Classic tomato & mozzarella', 12000.00, '🍕', true, true, 20),
  (v_id, cat_mains, 'Beef Burger', 'Angus beef with cheese & bacon', 8000.00, '🍔', true, false, 18),
  (v_id, cat_mains, 'Grilled Chicken', 'Herb-marinated grilled chicken breast', 10000.00, '🍗', false, false, 25),
  (v_id, cat_mains, 'Pasta Carbonara', 'Creamy pasta with bacon', 9000.00, '🍝', false, false, 15),
  
  (v_id, cat_drinks, 'Primus Beer', 'Local beer (330ml)', 1500.00, '🍺', true, false, 2),
  (v_id, cat_drinks, 'Coca-Cola', 'Soft drink (330ml)', 1000.00, '🥤', false, false, 1),
  (v_id, cat_drinks, 'Fresh Orange Juice', 'Freshly squeezed (250ml)', 2000.00, '🍊', false, true, 5),
  (v_id, cat_drinks, 'Coffee', 'Hot espresso', 1500.00, '☕', false, true, 3)
  ON CONFLICT DO NOTHING;
END $$;
```

**Run seed**:
```bash
psql postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres < supabase/seed/client-pwa-test-data.sql
```

---

## 📝 STEP 4: CREATE TYPE DEFINITIONS

**File**: `client-pwa/types/index.ts`

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
  created_at: string;
  updated_at: string;
}

export interface MenuCategory {
  id: string;
  venue_id: string;
  name: string;
  emoji: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
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
  created_at: string;
  updated_at: string;
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
  payment_tx_id: string | null;
  status: 'pending' | 'pending_payment' | 'paid' | 'preparing' | 'ready' | 'served' | 'cancelled';
  special_instructions: string | null;
  estimated_prep_time: number | null;
  created_at: string;
  updated_at: string;
  ready_at: string | null;
  served_at: string | null;
}
```

---

## 🎨 STEP 5: CREATE MISSING COMPONENTS

### 5.1 VenueHeader Component

**File**: `components/venue/VenueHeader.tsx`

```typescript
'use client';

import Image from 'next/image';
import { MapPin, Clock } from 'lucide-react';
import type { Venue } from '@/types';

interface VenueHeaderProps {
  venue: Venue;
  tableNumber: string | null;
}

export function VenueHeader({ venue, tableNumber }: VenueHeaderProps) {
  return (
    <div className="bg-card border-b border-border px-4 py-6 space-y-4">
      <div className="flex items-start gap-4">
        {venue.logo_url && (
          <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
            <Image
              src={venue.logo_url}
              alt={venue.name}
              fill
              className="object-cover"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{venue.name}</h1>
          {venue.address && (
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="w-4 h-4" />
              {venue.address}
            </p>
          )}
        </div>
      </div>

      {tableNumber && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-2 inline-block">
          <p className="text-sm font-medium text-primary">
            Table {tableNumber}
          </p>
        </div>
      )}
    </div>
  );
}
```

### 5.2 CartFab Component

**File**: `components/layout/CartFab.tsx`

```typescript
'use client';

import { motion } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/hooks/useCart';
import { useHaptics } from '@/hooks/useHaptics';

interface CartFabProps {
  venueSlug: string;
}

export function CartFab({ venueSlug }: CartFabProps) {
  const router = useRouter();
  const { totalItems, totalAmount } = useCart();
  const { trigger } = useHaptics();

  if (totalItems === 0) return null;

  const handleClick = () => {
    trigger('light');
    router.push(`/${venueSlug}/cart`);
  };

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      whileTap={{ scale: 0.9 }}
      onClick={handleClick}
      className="fixed bottom-20 right-4 z-50 bg-primary text-primary-foreground rounded-full shadow-lg px-6 py-4 flex items-center gap-3 touch-manipulation"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}
    >
      <div className="relative">
        <ShoppingBag className="w-6 h-6" />
        <div className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center">
          {totalItems}
        </div>
      </div>
      <span className="font-semibold">{totalAmount.toLocaleString()} RWF</span>
    </motion.button>
  );
}
```

### 5.3 SearchBar Component

**File**: `components/menu/SearchBar.tsx`

```typescript
'use client';

import { useState, useCallback, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/Input';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export function SearchBar({ onSearch, placeholder = 'Search menu...' }: SearchBarProps) {
  const [query, setQuery] = useState('');

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, onSearch]);

  const handleClear = useCallback(() => {
    setQuery('');
  }, []);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
      <Input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="pl-10 pr-10"
      />
      {query && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
```

---

## 🚀 STEP 6: CREATE CORE PAGES

### 6.1 Venue Page

Already created above - see full implementation in the code.

### 6.2 Cart Page

**File**: `app/[venueSlug]/cart/page.tsx`

```typescript
'use client';

import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Trash2, Plus, Minus } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { useHaptics } from '@/hooks/useHaptics';
import { Button } from '@/components/ui/Button';
import Image from 'next/image';

export default function CartPage() {
  const params = useParams();
  const router = useRouter();
  const venueSlug = params.venueSlug as string;
  
  const { items, totalAmount, totalItems, updateQuantity, removeItem, clearCart } = useCart();
  const { trigger } = useHaptics();

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-6xl">🛒</p>
          <h1 className="text-2xl font-semibold">Your cart is empty</h1>
          <p className="text-muted-foreground">Add some items to get started</p>
          <Button onClick={() => router.push(`/${venueSlug}`)}>
            Browse Menu
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold flex-1">Your Cart ({totalItems})</h1>
        <button
          onClick={() => {
            trigger('medium');
            clearCart();
          }}
          className="text-sm text-destructive"
        >
          Clear
        </button>
      </div>

      {/* Cart Items */}
      <div className="p-4 space-y-4">
        {items.map((cartItem) => (
          <motion.div
            key={cartItem.item.id}
            layout
            className="bg-card border border-border rounded-xl p-4 flex gap-3"
          >
            {/* Item Image */}
            <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
              {cartItem.item.image_url ? (
                <Image
                  src={cartItem.item.image_url}
                  alt={cartItem.item.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">
                  {cartItem.item.emoji || '🍽️'}
                </div>
              )}
            </div>

            {/* Item Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{cartItem.item.name}</h3>
              <p className="text-sm text-muted-foreground">
                {cartItem.item.price.toLocaleString()} {cartItem.item.currency}
              </p>

              {/* Quantity Controls */}
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => {
                    trigger('light');
                    updateQuantity(cartItem.item.id, -1);
                  }}
                  className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center font-semibold">
                  {cartItem.quantity}
                </span>
                <button
                  onClick={() => {
                    trigger('light');
                    updateQuantity(cartItem.item.id, 1);
                  }}
                  className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Remove Button */}
            <button
              onClick={() => {
                trigger('medium');
                removeItem(cartItem.item.id);
              }}
              className="text-destructive"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </motion.div>
        ))}
      </div>

      {/* Bottom Summary */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 space-y-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
        <div className="flex items-center justify-between text-lg font-semibold">
          <span>Total</span>
          <span className="text-primary">{totalAmount.toLocaleString()} RWF</span>
        </div>
        <Button
          onClick={() => router.push(`/${venueSlug}/checkout`)}
          className="w-full"
          size="lg"
        >
          Proceed to Checkout
        </Button>
      </div>
    </div>
  );
}
```

---

## ✅ STEP 7: TEST THE FLOW

1. **Start dev server**:
   ```bash
   cd /Users/jeanbosco/workspace/easymo-/client-pwa
   pnpm dev
   ```

2. **Test URL**:
   ```
   http://localhost:3002/heaven-bar?table=5
   ```

3. **Expected Flow**:
   - See venue header with "Table 5"
   - Browse menu with categories
   - Add items to cart
   - Click floating cart button
   - See cart page with items
   - Click "Proceed to Checkout"

---

## 📊 PHASE 1 COMPLETION CHECKLIST

- [ ] Database tables created
- [ ] Test data seeded
- [ ] Type definitions created
- [ ] Venue page functional
- [ ] Cart page functional
- [ ] Search works
- [ ] Category filtering works
- [ ] Cart persists in localStorage
- [ ] Floating cart button appears
- [ ] Navigation flows correctly

**When complete**: Move to Phase 2 (Checkout & Payment)

---

**Last Updated**: 2025-11-27  
**Next**: Implement checkout page and payment integration
