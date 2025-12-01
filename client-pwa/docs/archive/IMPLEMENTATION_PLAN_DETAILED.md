# 🚀 Client PWA - Detailed Implementation Plan

**Current Status:** 45% Complete (Foundation Done)  
**Next Phase:** Commerce Features (Cart, Menu, Payments)  
**Timeline:** 3-5 days for core features  

---

## ✅ COMPLETED (What's Already Built)

### Phase 1: Foundation ✓
- [x] Next.js 15 + TypeScript setup
- [x] Tailwind CSS with dark mode
- [x] Supabase client (client.ts, server.ts)
- [x] Basic UI components (Button, Input)
- [x] Haptic feedback system (lib/haptics.ts)
- [x] View Transitions API (lib/view-transitions.ts)
- [x] Cart store (stores/cart.store.ts)
- [x] Cart hook (hooks/useCart.ts)
- [x] Menu components (MenuItemCard, CategoryTabs, VirtualizedMenuList)
- [x] Cart sheet (components/cart/CartSheet.tsx)
- [x] QR Scanner page (app/scan/page.tsx)
- [x] Format utilities (lib/format.ts)
- [x] Error boundary
- [x] Real-time hooks (useOrderRealtime.ts)
- [x] Push notifications (lib/push-notifications.ts)
- [x] Swipe navigation (hooks/useSwipeNavigation.ts)
- [x] Recommendations engine (lib/recommendations.ts)
- [x] Observability (lib/observability.ts)

---

## 🔨 PENDING IMPLEMENTATION (Prioritized)

### **PHASE 2: Core Pages & Routes** (Priority 1 - CRITICAL)

#### 2.1 Venue Page - `app/[venueSlug]/page.tsx`
**Status:** Missing  
**Dependencies:** MenuItemCard, CategoryTabs (already built)  
**Files to Create:**
```
app/[venueSlug]/page.tsx
app/[venueSlug]/layout.tsx
components/venue/VenueHeader.tsx
components/venue/VenueInfo.tsx
types/venue.ts
```

**Features:**
- Load venue data from Supabase
- Display venue header (logo, name, hours)
- Show menu categories
- Filter/search menu items
- Add to cart functionality
- Loading states & skeletons

**API Calls:**
```typescript
// Fetch venue by slug
GET /api/venue/[slug]
// Fetch menu items
GET /api/venue/[slug]/menu
```

---

#### 2.2 Cart Page - `app/[venueSlug]/cart/page.tsx`
**Status:** CartSheet exists, need full page  
**Files to Create:**
```
app/[venueSlug]/cart/page.tsx
components/cart/CartSummary.tsx
components/cart/CartItem.tsx
components/cart/EmptyCart.tsx
```

**Features:**
- Full cart view (not just sheet)
- Item quantity controls
- Remove items
- Apply promo codes
- Cart summary (subtotal, tax, total)
- Navigate to checkout
- Clear cart option

---

#### 2.3 Checkout Page - `app/[venueSlug]/checkout/page.tsx`
**Status:** Missing (CRITICAL)  
**Files to Create:**
```
app/[venueSlug]/checkout/page.tsx
components/checkout/CheckoutForm.tsx
components/checkout/TableSelector.tsx
components/checkout/OrderSummary.tsx
components/payment/PaymentSelector.tsx
types/order.ts
```

**Features:**
- Table number selection
- Customer name/phone (optional)
- Special instructions
- Order summary
- Payment method selection
- Submit order
- Loading states
- Error handling

**API Calls:**
```typescript
POST /api/order/create
{
  venueId: string
  tableNumber: string
  items: CartItem[]
  paymentMethod: 'momo' | 'revolut'
  customerInfo: {...}
}
```

---

#### 2.4 Order Tracking Page - `app/[venueSlug]/order/[orderId]/page.tsx`
**Status:** Missing  
**Dependencies:** useOrderRealtime (already built)  
**Files to Create:**
```
app/[venueSlug]/order/[orderId]/page.tsx
components/order/OrderTracker.tsx
components/order/OrderProgress.tsx
components/order/OrderItems.tsx
components/order/OrderReceipt.tsx
```

**Features:**
- Real-time order status updates
- Progress bar (Pending → Preparing → Ready → Served)
- Estimated time remaining
- Call waiter button
- Order items list
- Receipt/summary
- Confetti animation (when ready)

**Supabase Realtime:**
```typescript
supabase
  .channel(`order:${orderId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'orders',
    filter: `id=eq.${orderId}`
  }, handleOrderUpdate)
```

---

### **PHASE 3: Payment Integration** (Priority 2 - CRITICAL)

#### 3.1 MoMo Payment (Rwanda)
**Status:** Missing  
**Files to Create:**
```
lib/payment/momo.ts
components/payment/MoMoPayment.tsx
components/payment/MoMoUSSD.tsx
app/api/payment/momo/initiate/route.ts
app/api/payment/momo/status/route.ts
```

**Implementation:**
```typescript
// MoMo USSD Flow
1. User selects MoMo at checkout
2. Display USSD code: *182*7*1#
3. User dials on phone
4. Enters bar code + amount
5. Confirms payment
6. Poll payment status
7. Update order status
```

**Components:**
- MoMo instructions dialog
- USSD code display (large, copyable)
- Payment pending state
- Auto-refresh status check
- Success/failure states

---

#### 3.2 Revolut Payment Link (Malta)
**Status:** Missing  
**Files to Create:**
```
lib/payment/revolut.ts
components/payment/RevolutPayment.tsx
app/api/payment/revolut/create-link/route.ts
app/api/payment/revolut/webhook/route.ts
```

**Implementation:**
```typescript
// Revolut Link Flow
1. User selects Revolut at checkout
2. Generate payment link via Revolut API
3. Open link in new tab/window
4. User completes payment
5. Webhook confirms payment
6. Update order status
7. Show success
```

**Components:**
- Revolut payment button
- External link warning
- Payment pending state
- Webhook handler
- Success confirmation

---

### **PHASE 4: Missing UI Components** (Priority 3)

#### 4.1 Core UI Components
**Files to Create:**
```
components/ui/Card.tsx
components/ui/Sheet.tsx (bottom sheet)
components/ui/Toast.tsx
components/ui/Badge.tsx
components/ui/Skeleton.tsx
components/ui/Dialog.tsx
components/ui/Tabs.tsx
components/ui/Select.tsx
```

#### 4.2 Layout Components
**Files to Create:**
```
components/layout/Header.tsx
components/layout/BottomNav.tsx
components/layout/CartFab.tsx (floating action button)
components/layout/PWAInstallPrompt.tsx
components/Providers.tsx (React Query, etc.)
```

---

### **PHASE 5: API Routes** (Priority 2)

#### 5.1 Required API Routes
**Files to Create:**
```
app/api/venue/[slug]/route.ts          # Get venue data
app/api/venue/[slug]/menu/route.ts     # Get menu items
app/api/order/create/route.ts          # Create order
app/api/order/[orderId]/route.ts       # Get order status
app/api/payment/momo/initiate/route.ts # MoMo payment
app/api/payment/revolut/create/route.ts # Revolut link
```

**Supabase Integration:**
Each route should:
1. Validate request
2. Query Supabase
3. Log events (observability.ts)
4. Return typed response
5. Handle errors

---

### **PHASE 6: Database Schema** (Priority 1)

#### 6.1 Required Tables (Supabase)
**File:** `supabase/migrations/YYYYMMDDHHMMSS_client_pwa_schema.sql`

```sql
BEGIN;

-- Venues table
CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  address TEXT,
  hours JSONB,
  currency TEXT DEFAULT 'RWF',
  payment_methods TEXT[] DEFAULT ARRAY['momo', 'revolut'],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu categories
CREATE TABLE IF NOT EXISTS menu_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  emoji TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu items
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  allergens TEXT[],
  prep_time_minutes INTEGER,
  calories INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  table_number TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  items JSONB NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'RWF',
  payment_method TEXT NOT NULL,
  payment_status TEXT DEFAULT 'pending',
  payment_id TEXT,
  order_status TEXT DEFAULT 'pending',
  special_instructions TEXT,
  estimated_ready_time TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  served_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order status enum
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled');
ALTER TABLE orders ALTER COLUMN order_status TYPE order_status USING order_status::order_status;

-- Payment status enum
CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');
ALTER TABLE orders ALTER COLUMN payment_status TYPE payment_status USING payment_status::payment_status;

-- Indexes
CREATE INDEX idx_venues_slug ON venues(slug);
CREATE INDEX idx_menu_items_venue ON menu_items(venue_id);
CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_orders_venue ON orders(venue_id);
CREATE INDEX idx_orders_status ON orders(order_status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- RLS Policies (Row Level Security)
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Public read for venues and menu
CREATE POLICY "Venues are publicly readable" ON venues FOR SELECT USING (is_active = true);
CREATE POLICY "Menu categories are publicly readable" ON menu_categories FOR SELECT USING (is_active = true);
CREATE POLICY "Menu items are publicly readable" ON menu_items FOR SELECT USING (is_available = true);

-- Anyone can create orders
CREATE POLICY "Anyone can create orders" ON orders FOR INSERT WITH CHECK (true);

-- Users can view their own orders (by order ID in URL)
CREATE POLICY "Orders are publicly readable" ON orders FOR SELECT USING (true);

COMMIT;
```

---

### **PHASE 7: PWA Features** (Priority 4)

#### 7.1 PWA Manifest & Icons
**Files to Create:**
```
public/icons/icon-192x192.png
public/icons/icon-512x512.png
public/icons/icon-maskable-192x192.png
public/icons/icon-maskable-512x512.png
public/manifest.json
```

**Script:** Run `./setup-pwa.sh` (already exists)

#### 7.2 Service Worker
**File:** `public/sw.js`

Features:
- Cache static assets
- Offline menu viewing
- Background sync
- Push notifications

#### 7.3 Install Prompt
**File:** `components/layout/PWAInstallPrompt.tsx`

Features:
- Detect if installable
- Show install button
- Handle beforeinstallprompt event
- Track installation

---

### **PHASE 8: Advanced Features** (Priority 5 - Nice to Have)

#### 8.1 Search & Filters
**Files:**
```
components/menu/SearchBar.tsx
components/menu/FilterSheet.tsx
```

Features:
- Full-text menu search
- Filter by dietary restrictions
- Filter by price range
- Sort by popularity, price, name

#### 8.2 Order History
**Files:**
```
app/(auth)/orders/page.tsx
app/(auth)/orders/[orderId]/page.tsx
```

Features:
- View past orders
- Reorder functionality
- Rate orders
- Save favorites

#### 8.3 User Profile (Optional)
**Files:**
```
app/(auth)/profile/page.tsx
components/profile/ProfileForm.tsx
```

Features:
- Save name/phone
- Payment preferences
- Dietary restrictions
- Language selection

---

## 📋 IMPLEMENTATION SEQUENCE (Next Steps)

### **Week 1: Core Pages** (Days 1-3)
1. ✅ Database schema migration
2. ✅ Venue page (`app/[venueSlug]/page.tsx`)
3. ✅ Cart page (`app/[venueSlug]/cart/page.tsx`)
4. ✅ Checkout page (`app/[venueSlug]/checkout/page.tsx`)
5. ✅ API routes (venue, menu, order)

### **Week 2: Payments** (Days 4-5)
6. ✅ MoMo USSD integration
7. ✅ Revolut payment link
8. ✅ Payment status tracking
9. ✅ Order tracking page

### **Week 3: Polish** (Days 6-7)
10. ✅ PWA setup (icons, manifest, service worker)
11. ✅ Missing UI components
12. ✅ Error handling
13. ✅ Loading states
14. ✅ Testing on mobile devices
15. ✅ Deployment to Netlify

---

## 🎯 SUCCESS CRITERIA

### Must Have (MVP)
- [ ] User can scan QR code → view venue menu
- [ ] User can browse menu, add items to cart
- [ ] User can checkout and select payment method
- [ ] User can pay via MoMo USSD or Revolut
- [ ] User can track order status in real-time
- [ ] PWA is installable on mobile
- [ ] Works offline (cached menu)

### Should Have
- [ ] Search menu items
- [ ] Filter by dietary restrictions
- [ ] Save order history
- [ ] Reorder from history
- [ ] Push notifications when order ready

### Nice to Have
- [ ] User profiles
- [ ] Favorites/saved items
- [ ] Loyalty points
- [ ] Split bill feature
- [ ] Social sharing

---

## 🚀 QUICK START (Next Commands)

```bash
cd /Users/jeanbosco/workspace/easymo-/client-pwa

# 1. Create database migration
supabase migration new client_pwa_schema
# Copy SQL from PHASE 6 above

# 2. Apply migration
supabase db push

# 3. Start implementing pages (order from PHASE 2)
# Create venue page first, then cart, then checkout

# 4. Test locally
pnpm dev

# 5. Deploy when ready
./deploy-complete.sh
```

---

## 📊 PROGRESS TRACKER

- **Foundation:** 100% ✅
- **Core Pages:** 0% ⏳
- **Payments:** 0% ⏳
- **PWA Setup:** 50% (basic config done, need icons)
- **Advanced Features:** 20% (realtime hooks done)

**Overall Completion:** ~45%

**Estimated Time to MVP:** 3-5 days of focused work

---

## ❓ QUESTIONS TO RESOLVE

1. **Venue data:** Do we seed test venues or create admin interface?
2. **Menu images:** Where hosted? (Supabase Storage vs CDN)
3. **MoMo API:** Do we have test credentials? Or USSD-only for MVP?
4. **Revolut API:** Do we have test account?
5. **Table management:** Static input or fetch from venues table?

---

**Next Action:** Start with database migration (PHASE 6), then build venue page (PHASE 2.1)
