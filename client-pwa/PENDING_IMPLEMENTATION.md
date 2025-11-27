# 📋 Client PWA - Detailed Pending Implementation Plan

**Last Updated**: 2025-11-27  
**Current Status**: 16% Complete (11/68 core tasks)  
**Target Completion**: 4 weeks

---

## 📊 Executive Summary

Based on analysis of existing code and the CHECKLIST.md, here's what's **actually implemented** vs what's **pending**:

### ✅ COMPLETED (16%)
- Next.js 15 + TypeScript + Tailwind setup
- Supabase client configuration
- Basic PWA manifest
- Haptic feedback system (`lib/haptics.ts`)
- View transitions (`lib/view-transitions.ts`)
- Cart store (`stores/cart.store.ts`)
- Cart hook (`hooks/useCart.ts`)
- QR Scanner (`app/scan/page.tsx`, `components/venue/QRScanner.tsx`)
- Error Boundary (`components/ErrorBoundary.tsx`)
- PWA Install Prompt (`components/layout/PWAInstallPrompt.tsx`)
- Payment components (MoMo, Revolut - `components/payment/`)
- Order tracking components (`components/order/`)
- Menu components (MenuItemCard, CategoryTabs, VirtualizedMenuList)
- Cart sheet (`components/cart/CartSheet.tsx`)
- Base UI components (Button, Input, LottieAnimation, PullToRefresh)
- Utility functions (`lib/format.ts`, `lib/utils.ts`)
- Realtime integration (`lib/realtime.ts`, `hooks/useOrderRealtime.ts`)

### ❌ PENDING (84%)

---

## 🚨 CRITICAL MISSING: Dynamic Routes (BLOCKER)

**Problem**: No dynamic routing implemented yet. The PWA spec requires:
```
/[venueSlug]/page.tsx          - Venue home/menu
/[venueSlug]/cart/page.tsx     - Cart page
/[venueSlug]/checkout/page.tsx - Checkout
/[venueSlug]/order/[orderId]/page.tsx - Order tracking
```

**Current**: Only have `/app/page.tsx` (landing) and `/app/scan/page.tsx`

### 🔴 PHASE 1: Core Pages (HIGHEST PRIORITY) - Week 1

#### 1.1 Venue Landing Page
**File**: `app/[venueSlug]/page.tsx`

**Requirements**:
- [ ] Extract `venueSlug` from URL params
- [ ] Fetch venue data from Supabase (`venues` table)
- [ ] Display venue header (name, logo, address, hours)
- [ ] Show category tabs (from `menu_categories` table)
- [ ] Render menu items grid (from `menu_items` table)
- [ ] Filter by category on tab click
- [ ] Extract `?table=X` from URL params
- [ ] Store table number in localStorage
- [ ] Floating cart FAB (bottom right)
- [ ] Loading states (skeleton)
- [ ] Error states (venue not found)

**Dependencies**:
```sql
-- Need these Supabase tables:
CREATE TABLE venues (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE,
  name TEXT,
  logo_url TEXT,
  address TEXT,
  hours JSONB,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE menu_categories (
  id UUID PRIMARY KEY,
  venue_id UUID REFERENCES venues(id),
  name TEXT,
  emoji TEXT,
  sort_order INT
);

CREATE TABLE menu_items (
  id UUID PRIMARY KEY,
  venue_id UUID REFERENCES venues(id),
  category_id UUID REFERENCES menu_categories(id),
  name TEXT,
  description TEXT,
  price DECIMAL,
  currency TEXT DEFAULT 'RWF',
  image_url TEXT,
  emoji TEXT,
  is_available BOOLEAN DEFAULT true,
  is_popular BOOLEAN DEFAULT false,
  is_vegetarian BOOLEAN DEFAULT false,
  prep_time_minutes INT
);
```

**Estimated Time**: 6 hours

---

#### 1.2 Cart Page
**File**: `app/[venueSlug]/cart/page.tsx`

**Requirements**:
- [ ] Import `useCart()` hook
- [ ] Display cart items (name, price, quantity, image)
- [ ] Quantity controls (+/- buttons)
- [ ] Remove item button
- [ ] Special instructions textarea
- [ ] Cart summary (subtotal, tax, service fee, total)
- [ ] "Proceed to Checkout" button
- [ ] Empty cart state (with "Browse Menu" CTA)
- [ ] Navigate to `/[venueSlug]/checkout` on proceed

**Data Flow**:
```
Cart Store (Zustand) → Cart Page → Display
                     ↓
              LocalStorage persistence
```

**Estimated Time**: 4 hours

---

#### 1.3 Checkout Page
**File**: `app/[venueSlug]/checkout/page.tsx`

**Requirements**:
- [ ] Display order summary (items, total)
- [ ] Table number display (from URL params)
- [ ] Customer name input (optional)
- [ ] Phone number input (for order updates)
- [ ] Special instructions (pre-filled from cart)
- [ ] Payment method selector (MoMo/Revolut)
- [ ] "Place Order" button
- [ ] Create order in Supabase (`orders` table)
- [ ] Initiate payment flow
- [ ] Navigate to `/[venueSlug]/order/[orderId]` after success

**Supabase Integration**:
```typescript
// POST to Supabase
const { data: order, error } = await supabase
  .from('orders')
  .insert({
    venue_id: venueId,
    table_number: tableNumber,
    customer_name: name,
    customer_phone: phone,
    items: cartItems,
    total_amount: totalAmount,
    currency: 'RWF',
    payment_method: 'momo', // or 'revolut'
    status: 'pending_payment',
  })
  .select()
  .single();
```

**Estimated Time**: 5 hours

---

#### 1.4 Order Tracking Page
**File**: `app/[venueSlug]/order/[orderId]/page.tsx`

**Requirements**:
- [ ] Extract `orderId` from URL params
- [ ] Fetch order from Supabase (`orders` table)
- [ ] Subscribe to real-time updates (Supabase Realtime)
- [ ] Display order status (pending → preparing → ready → served)
- [ ] Progress bar (visual timeline)
- [ ] Estimated time remaining
- [ ] Order items list
- [ ] Payment status
- [ ] Confetti animation when status = 'ready'
- [ ] "Call Waiter" button (optional)
- [ ] "Rate Experience" (after served)

**Realtime Subscription**:
```typescript
useEffect(() => {
  const channel = supabase
    .channel(`order:${orderId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
      filter: `id=eq.${orderId}`,
    }, (payload) => {
      setOrder(payload.new);
      if (payload.new.status === 'ready') {
        triggerConfetti();
        sendNotification('Your order is ready!');
      }
    })
    .subscribe();

  return () => { channel.unsubscribe(); };
}, [orderId]);
```

**Estimated Time**: 6 hours

---

### 🔴 PHASE 2: Database Setup - Week 1

#### 2.1 Supabase Tables
**File**: `supabase/migrations/XXXXXX_client_pwa_tables.sql`

**Tables to Create**:
```sql
-- 1. Venues
CREATE TABLE public.venues (
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

-- 2. Menu Categories
CREATE TABLE public.menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Menu Items
CREATE TABLE public.menu_items (
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

-- 4. Orders
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES venues(id),
  table_number TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  items JSONB NOT NULL, -- Array of {item_id, name, price, quantity}
  total_amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'RWF',
  payment_method TEXT CHECK (payment_method IN ('momo', 'revolut', 'cash')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed')),
  payment_tx_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'pending_payment', 'paid', 'preparing', 'ready', 'served', 'cancelled')),
  special_instructions TEXT,
  estimated_prep_time INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  ready_at TIMESTAMPTZ,
  served_at TIMESTAMPTZ
);

-- 5. Order Status Log (for timeline)
CREATE TABLE public.order_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Payment Transactions
CREATE TABLE public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  provider TEXT CHECK (provider IN ('momo', 'revolut')),
  tx_id TEXT UNIQUE,
  amount DECIMAL(10,2),
  currency TEXT,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_menu_items_venue ON menu_items(venue_id);
CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_orders_venue ON orders(venue_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- RLS Policies (public read for menu, authenticated write for orders)
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Allow public read for active venues & menu
CREATE POLICY "Public venues" ON venues FOR SELECT USING (is_active = true);
CREATE POLICY "Public categories" ON menu_categories FOR SELECT USING (is_active = true);
CREATE POLICY "Public menu items" ON menu_items FOR SELECT USING (is_available = true);

-- Allow public insert for orders (anonymous ordering)
CREATE POLICY "Anyone can create orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view their orders" ON orders FOR SELECT USING (true);
```

**Estimated Time**: 3 hours

---

#### 2.2 Seed Data
**File**: `supabase/seed/client-pwa-seed.sql`

**Sample Data**:
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

  -- Insert categories
  INSERT INTO menu_categories (venue_id, name, emoji, sort_order) VALUES
  (venue_id, 'Appetizers', '🍟', 1) RETURNING id INTO appetizers_id;
  
  INSERT INTO menu_categories (venue_id, name, emoji, sort_order) VALUES
  (venue_id, 'Main Courses', '🍕', 2) RETURNING id INTO mains_id;
  
  INSERT INTO menu_categories (venue_id, name, emoji, sort_order) VALUES
  (venue_id, 'Drinks', '🍺', 3) RETURNING id INTO drinks_id;

  -- Insert menu items
  INSERT INTO menu_items (venue_id, category_id, name, description, price, image_url, is_popular, prep_time_minutes) VALUES
  (venue_id, appetizers_id, 'French Fries', 'Crispy golden fries with special sauce', 3000, '/menu/fries.jpg', true, 10),
  (venue_id, appetizers_id, 'Chicken Wings', 'Spicy buffalo wings (6 pcs)', 5000, '/menu/wings.jpg', true, 15),
  (venue_id, mains_id, 'Margherita Pizza', 'Classic tomato & mozzarella', 12000, '/menu/pizza.jpg', true, 20),
  (venue_id, mains_id, 'Beef Burger', 'Angus beef with cheese & bacon', 8000, '/menu/burger.jpg', true, 18),
  (venue_id, drinks_id, 'Primus Beer', 'Local beer (330ml)', 1500, '/menu/primus.jpg', false, 2),
  (venue_id, drinks_id, 'Coca-Cola', 'Soft drink (330ml)', 1000, '/menu/coke.jpg', false, 1);
END $$;
```

**Estimated Time**: 2 hours

---

### 🟡 PHASE 3: Search & Filters - Week 2

#### 3.1 Search Bar Component
**File**: `components/menu/SearchBar.tsx`

**Requirements**:
- [ ] Input field with magnifying glass icon
- [ ] Debounced search (300ms)
- [ ] Filter menu items by name/description
- [ ] Clear button (X icon)
- [ ] Mobile optimized (sticky top)

**Estimated Time**: 3 hours

---

#### 3.2 Filter Sheet
**File**: `components/menu/FilterSheet.tsx`

**Requirements**:
- [ ] Bottom sheet UI
- [ ] Dietary filters (vegetarian, vegan, gluten-free)
- [ ] Price range slider
- [ ] Category multi-select
- [ ] "Apply Filters" button
- [ ] Active filter count badge

**Estimated Time**: 4 hours

---

### 🟡 PHASE 4: Payment Integration - Week 2

#### 4.1 MoMo Payment API Routes
**File**: `app/api/payment/momo/route.ts`

**Endpoints**:
```typescript
// POST /api/payment/momo/initiate
export async function POST(req: Request) {
  const { orderId, phone, amount } = await req.json();
  
  // 1. Validate order exists
  // 2. Generate MoMo USSD push
  // 3. Update payment_transactions table
  // 4. Return { success, tx_id, ussd_code }
}

// GET /api/payment/momo/status/[txId]
export async function GET(req: Request, { params }: { params: { txId: string } }) {
  // 1. Query MoMo API for transaction status
  // 2. Update payment_transactions & orders tables
  // 3. Return { status, order_status }
}

// POST /api/payment/momo/callback (webhook)
export async function POST(req: Request) {
  // 1. Verify MoMo signature
  // 2. Update payment status
  // 3. Update order status to 'paid'
  // 4. Trigger Supabase realtime event
}
```

**External API**: MoMo Rwanda Merchant API
```bash
# Test credentials needed:
MOMO_API_URL=https://sandbox.momodeveloper.mtn.com
MOMO_SUBSCRIPTION_KEY=your_key
MOMO_API_USER=your_user
MOMO_API_KEY=your_key
```

**Estimated Time**: 8 hours

---

#### 4.2 Revolut Payment API Routes
**File**: `app/api/payment/revolut/route.ts`

**Endpoints**:
```typescript
// POST /api/payment/revolut/create
export async function POST(req: Request) {
  const { orderId, amount, currency } = await req.json();
  
  // 1. Create Revolut payment link
  // 2. Store payment_id in payment_transactions
  // 3. Return { payment_url, payment_id }
}

// GET /api/payment/revolut/status/[paymentId]
export async function GET(req: Request, { params }: { params: { paymentId: string } }) {
  // 1. Check Revolut API for payment status
  // 2. Update tables
  // 3. Return { status }
}

// POST /api/payment/revolut/webhook
export async function POST(req: Request) {
  // 1. Verify webhook signature
  // 2. Update payment & order status
  // 3. Trigger realtime event
}
```

**External API**: Revolut Business API
```bash
REVOLUT_API_URL=https://sandbox-b2b.revolut.com
REVOLUT_API_KEY=your_api_key
REVOLUT_WEBHOOK_SECRET=your_secret
```

**Estimated Time**: 6 hours

---

#### 4.3 Payment Status Polling
**Hook**: `hooks/usePaymentStatus.ts`

**Requirements**:
```typescript
export function usePaymentStatus(txId: string, provider: 'momo' | 'revolut') {
  // Poll /api/payment/{provider}/status/{txId} every 3 seconds
  // Stop polling when status = 'completed' or 'failed'
  // Return { status, isLoading, error }
}
```

**Estimated Time**: 3 hours

---

### 🟢 PHASE 5: PWA Features - Week 3

#### 5.1 Service Worker Enhancement
**File**: `public/sw.js` (custom service worker)

**Features to Add**:
- [ ] Background sync for offline orders
- [ ] Push notification handling
- [ ] Advanced caching (API responses)
- [ ] Offline queue

**Estimated Time**: 5 hours

---

#### 5.2 Push Notifications
**File**: `lib/push-notifications.ts`

**Requirements**:
- [ ] Request notification permission
- [ ] Subscribe to push notifications
- [ ] Store subscription in Supabase (`push_subscriptions` table)
- [ ] Send test notification
- [ ] Handle notification clicks (navigate to order)

**Server**: Edge Function (`supabase/functions/send-push-notification`)
```typescript
import webpush from 'web-push';

Deno.serve(async (req) => {
  const { orderId, userId, message } = await req.json();
  
  // Get user's push subscriptions
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId);
  
  // Send push to all devices
  await Promise.all(subs.map(sub => 
    webpush.sendNotification(sub.subscription, JSON.stringify({
      title: 'Order Update',
      body: message,
      data: { orderId }
    }))
  ));
});
```

**Estimated Time**: 6 hours

---

#### 5.3 Offline Mode
**Features**:
- [ ] Detect online/offline status
- [ ] Show offline banner
- [ ] Cache menu data in IndexedDB
- [ ] Queue orders when offline
- [ ] Sync when back online (Background Sync API)

**Estimated Time**: 5 hours

---

### 🟢 PHASE 6: Analytics & Monitoring - Week 3

#### 6.1 Analytics Events
**File**: `lib/analytics.ts`

**Events to Track**:
```typescript
// User actions
trackEvent('menu_view', { venueSlug, category });
trackEvent('item_view', { itemId, itemName });
trackEvent('add_to_cart', { itemId, quantity });
trackEvent('checkout_start', { cartValue });
trackEvent('payment_method_selected', { method });
trackEvent('order_placed', { orderId, totalAmount });

// Performance
trackEvent('page_load_time', { page, duration });
trackEvent('api_call_time', { endpoint, duration });

// Errors
trackEvent('error', { page, message, stack });
```

**Estimated Time**: 4 hours

---

#### 6.2 Error Tracking
**Integration**: Sentry or similar

**Setup**:
```typescript
// lib/sentry.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

**Estimated Time**: 2 hours

---

### 🔵 PHASE 7: Testing & Polish - Week 4

#### 7.1 Unit Tests
**Framework**: Vitest + React Testing Library

**Files to Test**:
```
components/menu/MenuItemCard.test.tsx
components/cart/CartSheet.test.tsx
hooks/useCart.test.ts
stores/cart.store.test.ts
lib/format.test.ts
```

**Estimated Time**: 8 hours

---

#### 7.2 E2E Tests
**Framework**: Playwright

**Test Scenarios**:
```typescript
// tests/e2e/ordering-flow.spec.ts
test('complete order flow', async ({ page }) => {
  // 1. Scan QR code
  await page.goto('/heaven-bar?table=5');
  
  // 2. Browse menu
  await page.click('[data-testid="category-mains"]');
  
  // 3. Add items to cart
  await page.click('[data-testid="add-item-pizza"]');
  
  // 4. Go to checkout
  await page.click('[data-testid="cart-fab"]');
  await page.click('[data-testid="checkout-btn"]');
  
  // 5. Complete payment
  await page.fill('[name="phone"]', '+250788123456');
  await page.click('[data-testid="pay-momo"]');
  
  // 6. Verify order created
  await expect(page.locator('[data-testid="order-status"]')).toBeVisible();
});
```

**Estimated Time**: 10 hours

---

#### 7.3 Performance Optimization
**Tasks**:
- [ ] Run Lighthouse audit
- [ ] Optimize images (WebP, AVIF)
- [ ] Lazy load routes
- [ ] Code splitting analysis
- [ ] Bundle size optimization
- [ ] Prefetch critical data

**Target Metrics**:
- Performance: 95+
- FCP: <1.5s
- LCP: <2.5s
- TTI: <3.5s

**Estimated Time**: 6 hours

---

#### 7.4 Cross-browser Testing
**Browsers**:
- [ ] Chrome Android
- [ ] Safari iOS
- [ ] Samsung Internet
- [ ] Firefox Android
- [ ] Edge Mobile

**Test Checklist per Browser**:
- [ ] PWA installable
- [ ] Add to home screen works
- [ ] Service worker registers
- [ ] Offline mode functional
- [ ] Camera (QR scanner) works
- [ ] Payment flows work
- [ ] Push notifications work

**Estimated Time**: 8 hours

---

## 📦 Additional Components Needed

### UI Components
- [ ] `components/ui/Badge.tsx`
- [ ] `components/ui/Card.tsx`
- [ ] `components/ui/Dialog.tsx`
- [ ] `components/ui/Sheet.tsx`
- [ ] `components/ui/Skeleton.tsx`
- [ ] `components/ui/Toast.tsx`
- [ ] `components/ui/Tabs.tsx`

### Layout Components
- [ ] `components/layout/BottomNav.tsx`
- [ ] `components/layout/CartFab.tsx`
- [ ] `components/layout/Header.tsx`

### Menu Components
- [ ] `components/menu/MenuSkeleton.tsx`
- [ ] `components/menu/ItemDetail.tsx` (modal)
- [ ] `components/menu/SearchBar.tsx`
- [ ] `components/menu/FilterSheet.tsx`

### Order Components
- [ ] `components/order/OrderProgress.tsx`
- [ ] `components/order/OrderItems.tsx`
- [ ] `components/order/OrderReceipt.tsx`
- [ ] `components/order/RatingDialog.tsx`

---

## 🔐 Environment Variables Needed

```bash
# .env.local (DO NOT COMMIT)

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# MoMo Rwanda
MOMO_API_URL=https://sandbox.momodeveloper.mtn.com
MOMO_SUBSCRIPTION_KEY=your_key
MOMO_API_USER=your_user
MOMO_API_KEY=your_key

# Revolut Business
REVOLUT_API_URL=https://sandbox-b2b.revolut.com
REVOLUT_API_KEY=your_api_key
REVOLUT_WEBHOOK_SECRET=your_secret

# Analytics (Optional)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx

# Push Notifications (VAPID keys)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3002
```

---

## 📅 Implementation Timeline

### Week 1: Core Functionality (40 hours)
- **Days 1-2**: Dynamic routes ([venueSlug], cart, checkout, order)
- **Day 3**: Database setup (migrations + seed)
- **Days 4-5**: Integration testing & bug fixes

### Week 2: Payments & Search (40 hours)
- **Days 1-2**: MoMo integration
- **Day 3**: Revolut integration
- **Days 4-5**: Search, filters, polish

### Week 3: Advanced Features (40 hours)
- **Days 1-2**: Push notifications
- **Day 3**: Offline mode
- **Days 4-5**: Analytics & monitoring

### Week 4: Testing & Deployment (40 hours)
- **Days 1-2**: Unit + E2E tests
- **Day 3**: Performance optimization
- **Day 4**: Cross-browser testing
- **Day 5**: Production deployment

**Total Effort**: 160 hours (4 weeks full-time)

---

## 🚀 Quick Start (For Developer)

### 1. Setup Environment
```bash
cd /Users/jeanbosco/workspace/easymo-/client-pwa
pnpm install --frozen-lockfile
cp .env.example .env.local
# Add credentials to .env.local
```

### 2. Database Setup
```bash
# Apply migrations
cd ../supabase
supabase db push

# Or manually:
psql postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres < migrations/client_pwa_tables.sql
```

### 3. Start Development
```bash
cd ../client-pwa
pnpm dev
# Visit http://localhost:3002
```

### 4. Test QR Scan
```bash
# Generate test QR code (or use online generator)
# URL: http://localhost:3002/heaven-bar?table=5
```

### 5. Test Full Flow
1. Scan QR → lands on `/heaven-bar?table=5`
2. Browse menu → add items
3. Open cart → proceed to checkout
4. Enter phone → select payment
5. Complete payment → track order

---

## 📊 Success Criteria

### Functionality
- [ ] QR scan redirects to venue page
- [ ] Menu loads and displays correctly
- [ ] Cart persists across page reloads
- [ ] Checkout creates order in Supabase
- [ ] MoMo payment flow completes
- [ ] Revolut payment flow completes
- [ ] Order status updates in real-time
- [ ] Push notifications received

### Performance
- [ ] Lighthouse Performance: 95+
- [ ] PWA Score: 100
- [ ] Load time: <2s
- [ ] Bundle size: <200KB gzipped

### Quality
- [ ] Zero TypeScript errors
- [ ] Zero ESLint errors
- [ ] 80%+ test coverage
- [ ] All E2E tests pass

### User Experience
- [ ] Installable on iOS & Android
- [ ] Offline mode functional
- [ ] Smooth animations (60fps)
- [ ] Touch targets ≥44px
- [ ] WCAG 2.1 AA compliant

---

## 🆘 Critical Blockers to Address First

### 1. No Dynamic Routes (CRITICAL)
**Impact**: Can't navigate to venue pages  
**Action**: Create `app/[venueSlug]/page.tsx` immediately

### 2. No Database Tables (CRITICAL)
**Impact**: No data to display  
**Action**: Run migrations to create tables

### 3. No Payment Integration (HIGH)
**Impact**: Can't complete orders  
**Action**: Implement MoMo API routes

### 4. No Order Creation (HIGH)
**Impact**: Orders don't persist  
**Action**: Create order submission logic

### 5. Missing UI Components (MEDIUM)
**Impact**: Inconsistent UI  
**Action**: Build remaining base components

---

## 📞 Support

**Questions?** Check:
- `IMPLEMENTATION_GUIDE.md` - Detailed implementation steps
- `FEATURES_SUMMARY.md` - Feature specifications
- `CHECKLIST.md` - Task tracking

**Stuck?** Ask for help with specific task number (e.g., "Help with 1.1 Venue Landing Page")

---

**Last Updated**: 2025-11-27  
**Next Review**: Weekly during implementation  
**Completion Target**: 4 weeks from start
