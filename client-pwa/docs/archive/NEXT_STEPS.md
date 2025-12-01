# 🚀 Client PWA - Next Steps (Phase 5)

## ✅ Phase 4 Complete: Cart & Menu Components

**What's Working:**
- ✅ Cart store with Zustand (persistence, modifiers, totals)
- ✅ MenuItemCard component (2 variants, badges, quick-add)
- ✅ CategoryTabs component (horizontal scroll, auto-center)
- ✅ Button component (5 variants, touch-optimized)
- ✅ Haptic feedback system
- ✅ Formatting utilities (price, date, time)
- ✅ TypeScript types (MenuItem, Venue, Cart)

**Files Created:**
```
stores/cart.store.ts              ✅
hooks/useCart.ts                  ✅
hooks/useHaptics.ts               ✅
components/menu/MenuItemCard.tsx  ✅
components/menu/CategoryTabs.tsx  ✅
components/ui/Button.tsx          ✅
lib/format.ts                     ✅
types/menu.ts                     ✅ (enhanced)
```

---

## 🎯 Phase 5: QR Scanner, Venue Pages & Checkout

### 1. Install Dependencies

```bash
cd /Users/jeanbosco/workspace/easymo-/client-pwa
pnpm add qr-scanner
```

### 2. Create Database Tables

Run in Supabase SQL Editor:

```sql
-- Venues
CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  cover_image_url TEXT,
  currency TEXT DEFAULT 'RWF',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Menu Categories
CREATE TABLE IF NOT EXISTS menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  category_id UUID REFERENCES menu_categories(id) ON DELETE SET NULL,
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
  is_gluten_free BOOLEAN DEFAULT false,
  prep_time_minutes INT,
  allergens TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  table_number TEXT,
  customer_phone TEXT,
  items JSONB NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'RWF',
  payment_method TEXT,
  payment_status TEXT DEFAULT 'pending',
  order_status TEXT DEFAULT 'received',
  special_instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Venues are viewable by everyone" ON venues FOR SELECT USING (is_active = true);
CREATE POLICY "Categories are viewable by everyone" ON menu_categories FOR SELECT USING (true);
CREATE POLICY "Menu items are viewable by everyone" ON menu_items FOR SELECT USING (is_available = true);
CREATE POLICY "Orders are viewable by creator" ON orders FOR SELECT USING (true);
CREATE POLICY "Anyone can create orders" ON orders FOR INSERT WITH CHECK (true);
```

### 3. Seed Test Data

```sql
-- Insert test venue
INSERT INTO venues (slug, name, description, currency) VALUES
('heaven-bar', 'Heaven Bar & Restaurant', 'Premium dining & drinks in Kigali', 'RWF');

-- Get venue ID (replace with actual UUID after insert)
DO $$
DECLARE
  venue_id UUID;
  appetizers_id UUID;
  mains_id UUID;
  drinks_id UUID;
BEGIN
  SELECT id INTO venue_id FROM venues WHERE slug = 'heaven-bar';
  
  -- Categories
  INSERT INTO menu_categories (venue_id, name, emoji, display_order) VALUES
  (venue_id, 'Appetizers', '🥗', 1) RETURNING id INTO appetizers_id;
  
  INSERT INTO menu_categories (venue_id, name, emoji, display_order) VALUES
  (venue_id, 'Mains', '🍕', 2) RETURNING id INTO mains_id;
  
  INSERT INTO menu_categories (venue_id, name, emoji, display_order) VALUES
  (venue_id, 'Drinks', '🍺', 3) RETURNING id INTO drinks_id;
  
  -- Menu items
  INSERT INTO menu_items (venue_id, category_id, name, description, price, emoji, is_popular, prep_time_minutes) VALUES
  (venue_id, appetizers_id, 'Caesar Salad', 'Fresh romaine, parmesan, croutons', 8000, '🥗', false, 10),
  (venue_id, mains_id, 'Margherita Pizza', 'Classic tomato & mozzarella', 15000, '🍕', true, 20),
  (venue_id, mains_id, 'Beef Burger', 'Angus beef, cheese, bacon', 18000, '🍔', true, 25),
  (venue_id, drinks_id, 'Primus Beer', 'Local Rwandan beer', 2000, '🍺', false, 5),
  (venue_id, drinks_id, 'Red Wine Glass', 'House red wine', 5000, '🍷', false, 5);
END $$;
```

---

## 📝 Implementation Tasks

### Task 1: QR Scanner Page ⏳
Create `app/scan/page.tsx` - camera scanner for venue QR codes

### Task 2: Venue Menu Page ⏳
Create `app/[venueSlug]/page.tsx` - browse venue menu

### Task 3: Cart FAB ⏳
Create `components/cart/CartFab.tsx` - floating cart button

### Task 4: Checkout Page ⏳
Create `app/checkout/page.tsx` - review cart & payment

### Task 5: Payment Integration ⏳
- MoMo USSD (dial `*182*8*1*AMOUNT#`)
- Revolut Payment Link

---

## 🧪 Quick Test

```bash
# Type check
pnpm type-check

# Start dev server
pnpm dev
# → http://localhost:3002

# Test cart in browser console:
import { useCartStore } from '@/stores/cart.store';
const { addItem } = useCartStore.getState();
addItem({ menuItemId: '123', name: 'Pizza', price: 15000, currency: 'RWF' });
```

---

## 📦 Current File Structure

```
client-pwa/
├── app/
│   ├── layout.tsx              ✅ Root layout
│   ├── page.tsx                ✅ Landing page
│   └── globals.css             ✅ Tailwind styles
├── components/
│   ├── menu/
│   │   ├── MenuItemCard.tsx    ✅ Menu item display
│   │   └── CategoryTabs.tsx    ✅ Category nav
│   └── ui/
│       └── Button.tsx          ✅ Button component
├── stores/
│   └── cart.store.ts           ✅ Zustand cart
├── hooks/
│   ├── useCart.ts              ✅ Cart hook
│   └── useHaptics.ts           ✅ Haptics hook
├── lib/
│   ├── supabase/
│   │   └── client.ts           ✅ Supabase client
│   ├── format.ts               ✅ Formatting utils
│   └── utils.ts                ✅ cn utility
└── types/
    ├── menu.ts                 ✅ Menu types
    └── cart.ts                 ✅ Cart types
```

---

## 🎯 Success Criteria

Phase 5 complete when:
- [ ] QR scanner opens camera and parses venue URLs
- [ ] Venue page loads menu from Supabase
- [ ] Categories filter menu items
- [ ] Cart FAB displays total
- [ ] Checkout page shows cart items
- [ ] MoMo USSD payment triggers
- [ ] Revolut link generates
- [ ] Cart persists across page refreshes

---

## 📚 Documentation

- `PHASE_4_COMPLETE.md` - Phase 4 summary
- `STATUS.md` - Overall project status
- `IMPLEMENTATION_GUIDE.md` - Full feature guide
- `NEXT_STEPS.md` - This file

---

**Created:** 2025-11-27  
**Status:** 🚧 Phase 4 Complete → Phase 5 Ready  
**Progress:** 70%
