# 🚀 CLIENT PWA - NEXT STEPS GUIDE

## 📊 Current Progress: 45% Complete

### ✅ What's Done (Foundation)
- Next.js 15 + React 19 + TypeScript
- Supabase integration
- Cart system (Zustand)
- Menu components
- Haptic feedback
- Real-time hooks
- Push notifications
- Error boundaries

### 🔨 What's Missing (Core Features)
- Venue page (`app/[venueSlug]/page.tsx`)
- Cart page (full view)
- Checkout page
- Order tracking page
- Payment integration (MoMo, Revolut)
- Missing UI components
- API routes

---

## 🎯 PHASE BREAKDOWN

### **Phase 1: Database Setup** ✅ READY

**Files Created:**
1. `supabase/migrations/20251127223000_client_pwa_schema.sql`
   - Creates: venues, menu_categories, menu_items, orders tables
   - RLS policies
   - Indexes for performance

2. `supabase/seed/client_pwa_seed.sql`  
   - Test venue: "Heaven Bar & Restaurant"
   - 6 categories, 50+ menu items
   - Ready to use immediately

**Action Required:**
```bash
cd /Users/jeanbosco/workspace/easymo-
supabase db push  # Apply migration
```

---

### **Phase 2: Core Pages** ⏳ NEXT

Need to create 4 critical pages:

#### 1. Venue Menu Page
**File:** `app/[venueSlug]/page.tsx`  
**URL:** `/heaven-bar?table=5`  
**Features:**
- Load venue data from Supabase
- Display menu grid with CategoryTabs
- Add items to cart
- Filter by category

**Dependencies (Need to Create):**
- `components/venue/VenueHeader.tsx` - Shows venue info + table#
- `components/layout/CartFab.tsx` - Floating cart button

#### 2. Cart Page
**File:** `app/[venueSlug]/cart/page.tsx`  
**URL:** `/heaven-bar/cart`  
**Features:**
- Full cart view (not just sheet)
- Edit quantities
- Remove items
- Show totals
- Navigate to checkout

**Dependencies (Already Built):**
- ✓ Cart store (stores/cart.store.ts)
- ✓ useCart hook

#### 3. Checkout Page
**File:** `app/[venueSlug]/checkout/page.tsx`  
**URL:** `/heaven-bar/checkout`  
**Features:**
- Table number (from QR or manual)
- Customer name/phone (optional)
- Special instructions
- Payment method selection
- Create order API call

**Dependencies (Need to Create):**
- `components/checkout/CheckoutForm.tsx`
- `components/payment/PaymentSelector.tsx`
- `app/api/order/create/route.ts`

#### 4. Order Tracking Page
**File:** `app/[venueSlug]/order/[orderId]/page.tsx`  
**URL:** `/heaven-bar/order/abc-123`  
**Features:**
- Real-time order status updates
- Progress bar (Pending → Preparing → Ready → Served)
- Order items list
- Call waiter button

**Dependencies (Already Built):**
- ✓ useOrderRealtime hook
- ✓ Supabase realtime configured

**Dependencies (Need to Create):**
- `components/order/OrderTracker.tsx`
- `components/order/OrderProgress.tsx`

---

### **Phase 3: Payment Integration** ⏳

#### MoMo Payment (Rwanda)
**Method:** USSD - No API needed  
**Flow:**
1. Show USSD code: `*182*7*1#`
2. Display bar code + amount
3. User dials manually on phone
4. Poll order status for payment confirmation

**Files Needed:**
- `components/payment/MoMoPayment.tsx` - Display instructions
- `lib/payment/momo.ts` - Helper functions

#### Revolut Payment (Malta)
**Method:** Payment Link  
**Flow:**
1. Generate payment link via Revolut API
2. Open in new tab
3. Handle webhook callback
4. Update order status

**Files Needed:**
- `components/payment/RevolutPayment.tsx`
- `lib/payment/revolut.ts`
- `app/api/payment/revolut/create/route.ts`
- `app/api/payment/revolut/webhook/route.ts`

---

### **Phase 4: PWA Polish** ⏳

**Tasks:**
1. Generate PWA icons (192x192, 512x512)
2. Create service worker
3. Add install prompt
4. Test on iOS/Android

**Script:** `./setup-pwa.sh` (already exists)

---

## 📝 DETAILED TASK LIST

### Priority 1: Core Functionality (MVP)

- [ ] **Database**
  - [ ] Apply migration: `supabase db push`
  - [ ] Verify tables created
  - [ ] Check seed data loaded

- [ ] **Venue Page**
  - [ ] Create `app/[venueSlug]/page.tsx`
  - [ ] Create `components/venue/VenueHeader.tsx`
  - [ ] Create `components/layout/CartFab.tsx`
  - [ ] Test: Visit `/heaven-bar?table=5`

- [ ] **Cart Flow**
  - [ ] Create `app/[venueSlug]/cart/page.tsx`
  - [ ] Add navigation from CartFab
  - [ ] Test add/remove items

- [ ] **Checkout**
  - [ ] Create `app/[venueSlug]/checkout/page.tsx`
  - [ ] Create `components/checkout/CheckoutForm.tsx`
  - [ ] Create `components/payment/PaymentSelector.tsx`
  - [ ] Create `app/api/order/create/route.ts`
  - [ ] Test order creation

- [ ] **Order Tracking**
  - [ ] Create `app/[venueSlug]/order/[orderId]/page.tsx`
  - [ ] Create `components/order/OrderTracker.tsx`
  - [ ] Test real-time updates

### Priority 2: Payments

- [ ] **MoMo**
  - [ ] Create `components/payment/MoMoPayment.tsx`
  - [ ] Display USSD instructions
  - [ ] Poll payment status

- [ ] **Revolut**
  - [ ] Create `components/payment/RevolutPayment.tsx`
  - [ ] Integrate Revolut API
  - [ ] Handle webhook

### Priority 3: Polish

- [ ] **UI Components**
  - [ ] Card, Sheet, Toast, Badge
  - [ ] Dialog, Tabs, Select

- [ ] **PWA**
  - [ ] Generate icons
  - [ ] Service worker
  - [ ] Install prompt

- [ ] **Testing**
  - [ ] Mobile devices (iOS/Android)
  - [ ] QR scanner
  - [ ] Offline mode

---

## 🚀 QUICK START (Do This Now)

### Step 1: Apply Database Migration
```bash
cd /Users/jeanbosco/workspace/easymo-
supabase db push
```

Expected output:
```
✓ Applying migration 20251127223000_client_pwa_schema.sql
✓ Tables created: venues, menu_categories, menu_items, orders
```

### Step 2: Verify Data
```bash
# Check if seed data loaded
supabase db psql

# Run in psql:
SELECT * FROM venues WHERE slug = 'heaven-bar';
SELECT COUNT(*) FROM menu_items;
# Should see 1 venue, 50+ items
```

### Step 3: Start Dev Server
```bash
cd /Users/jeanbosco/workspace/easymo-/client-pwa
pnpm dev
```

### Step 4: Test Current State
Visit: `http://localhost:3002/scan`

This works ✅ Shows QR scanner

**Next:** Build venue page to display menu

---

## 📂 FILE CREATION ORDER

Create in this sequence to minimize dependencies:

### Round 1: Types & Utils
1. `types/venue.ts`
2. `types/order.ts`
3. `lib/payment/momo.ts` (stub)
4. `lib/payment/revolut.ts` (stub)

### Round 2: UI Components
5. `components/ui/Card.tsx`
6. `components/ui/Badge.tsx`
7. `components/ui/Sheet.tsx`
8. `components/ui/Dialog.tsx`

### Round 3: Feature Components
9. `components/venue/VenueHeader.tsx`
10. `components/layout/CartFab.tsx`
11. `components/checkout/CheckoutForm.tsx`
12. `components/payment/PaymentSelector.tsx`
13. `components/order/OrderTracker.tsx`

### Round 4: Pages
14. `app/[venueSlug]/page.tsx`
15. `app/[venueSlug]/cart/page.tsx`
16. `app/[venueSlug]/checkout/page.tsx`
17. `app/[venueSlug]/order/[orderId]/page.tsx`

### Round 5: API Routes
18. `app/api/venue/[slug]/route.ts`
19. `app/api/order/create/route.ts`
20. `app/api/payment/momo/initiate/route.ts`
21. `app/api/payment/revolut/create/route.ts`

---

## 🎯 SUCCESS CRITERIA (MVP)

When these work, you're ready to deploy:

- [ ] User scans QR → sees menu
- [ ] User adds items → cart updates
- [ ] User checks out → order created
- [ ] User selects payment → sees instructions
- [ ] User tracks order → real-time status
- [ ] PWA installs on mobile
- [ ] Works offline (cached menu)

---

## ⏱️ TIME ESTIMATE

- **Phase 1** (Database): 0.5 hours ✅
- **Phase 2** (Core Pages): 8-12 hours
- **Phase 3** (Payments): 4-6 hours
- **Phase 4** (PWA Polish): 2-4 hours

**Total to MVP:** 2-3 days of focused work

---

## 📚 REFERENCE FILES

- **Full Implementation Plan:** `IMPLEMENTATION_PLAN_DETAILED.md`
- **Checklist:** `CHECKLIST.md`
- **Database Schema:** `supabase/migrations/20251127223000_client_pwa_schema.sql`
- **Seed Data:** `supabase/seed/client_pwa_seed.sql`

---

## ❓ QUESTIONS BEFORE PROCEEDING

1. **Should I auto-apply the migration or let you review first?**
2. **Want me to create all files in one go, or step-by-step?**
3. **Any specific payment integration requirements (test vs production)?**
4. **Deploy target: Netlify only, or also want Vercel config?**

---

**Current State:** Foundation complete, ready for core pages  
**Next Action:** Apply database migration → Create venue page  
**Goal:** Working order flow in 2-3 days
