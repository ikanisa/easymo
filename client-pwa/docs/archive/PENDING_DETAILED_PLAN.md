# 🎯 CLIENT PWA - DETAILED PENDING IMPLEMENTATION

Generated: 2025-11-27

---

## 📊 PROGRESS OVERVIEW

**Current Completion:** 45%  
**Status:** Foundation Complete, Core Pages Pending  
**Estimated Time to MVP:** 3-4 days  
**Estimated Time to Production:** 5-7 days  

---

## ✅ COMPLETED FEATURES (45%)

### Infrastructure
- [x] Next.js 15.1.6 with App Router
- [x] React 19 + TypeScript 5.7
- [x] Tailwind CSS 3.4 with dark mode
- [x] Supabase SSR integration
- [x] Environment configuration
- [x] ESLint + PostCSS setup
- [x] Netlify deployment config

### State Management
- [x] Zustand cart store with persistence
- [x] Cart hooks (useCart)
- [x] Real-time hooks (useOrderRealtime)
- [x] Haptic feedback hook (useHaptics)
- [x] Swipe navigation hook

### Core Features
- [x] Haptic feedback system
- [x] View Transitions API
- [x] Push notifications
- [x] Error boundaries
- [x] Observability/logging
- [x] Recommendations engine

### Components
- [x] MenuItemCard (touch-optimized)
- [x] CategoryTabs (horizontal scroll)
- [x] CartSheet (bottom drawer)
- [x] VirtualizedMenuList
- [x] Button, Input components
- [x] LottieAnimation
- [x] PullToRefresh
- [x] ErrorBoundary

### Pages
- [x] Home page (app/page.tsx)
- [x] QR Scanner (app/scan/page.tsx)
- [x] Root layout with PWA metadata

---

## 🔨 PENDING IMPLEMENTATION (55%)

### PHASE 1: Database Schema ✅ READY

**Status:** Files created, needs migration applied

**Files:**
1. ✅ `supabase/migrations/20251127223000_client_pwa_schema.sql`
   - Tables: venues, menu_categories, menu_items, orders
   - RLS policies for security
   - Indexes for performance
   - Triggers for updated_at

2. ✅ `supabase/seed/client_pwa_seed.sql`
   - Test venue: "Heaven Bar & Restaurant"
   - 6 categories
   - 50+ menu items with prices

**Action Required:**
```bash
cd /Users/jeanbosco/workspace/easymo-
supabase db push
```

---

### PHASE 2: Core Pages (CRITICAL PATH)

#### 2.1 Venue Menu Page
**File:** `app/[venueSlug]/page.tsx`  
**URL:** `/heaven-bar?table=5`  
**Status:** ❌ Not created

**Features:**
- Server-side venue data fetching
- Menu grid display with MenuItemCard
- Category filtering
- Add to cart functionality
- Loading states
- Error handling

**Dependencies:**
- ✅ MenuItemCard (exists)
- ✅ CategoryTabs (exists)
- ❌ VenueHeader (missing)
- ❌ CartFab (missing)

**Estimated Time:** 2-3 hours

---

#### 2.2 Cart Page
**File:** `app/[venueSlug]/cart/page.tsx`  
**URL:** `/heaven-bar/cart`  
**Status:** ❌ Not created

**Features:**
- Full cart view (not just sheet)
- Edit item quantities
- Remove items
- Cart summary (subtotal, tax, total)
- Continue shopping button
- Proceed to checkout button
- Empty cart state

**Dependencies:**
- ✅ useCart hook (exists)
- ✅ cart.store.ts (exists)
- ❌ CartSummary component (missing)
- ❌ CartItem component (missing)
- ❌ EmptyCart component (missing)

**Estimated Time:** 1-2 hours

---

#### 2.3 Checkout Page
**File:** `app/[venueSlug]/checkout/page.tsx`  
**URL:** `/heaven-bar/checkout`  
**Status:** ❌ Not created

**Features:**
- Table number input/display
- Customer name (optional)
- Customer phone (optional)
- Special instructions textarea
- Order summary
- Payment method selection
- Submit order button
- Loading/error states
- Redirect to order tracking on success

**Dependencies:**
- ❌ CheckoutForm component (missing)
- ❌ TableSelector component (missing)
- ❌ OrderSummary component (missing)
- ❌ PaymentSelector component (missing)
- ❌ POST /api/order/create (missing)

**Estimated Time:** 3-4 hours

---

#### 2.4 Order Tracking Page
**File:** `app/[venueSlug]/order/[orderId]/page.tsx`  
**URL:** `/heaven-bar/order/abc-123-def`  
**Status:** ❌ Not created

**Features:**
- Real-time order status updates
- Progress bar (Pending → Preparing → Ready → Served)
- Estimated time remaining
- Order items list
- Order summary/receipt
- Call waiter button
- Confetti animation when ready
- Error handling

**Dependencies:**
- ✅ useOrderRealtime hook (exists)
- ❌ OrderTracker component (missing)
- ❌ OrderProgress component (missing)
- ❌ OrderItems component (missing)
- ❌ OrderReceipt component (missing)

**Estimated Time:** 2-3 hours

---

### PHASE 3: Components (35 files missing)

#### Venue Components (2 files)
- [ ] `components/venue/VenueHeader.tsx` - Logo, name, hours, table badge
- [ ] `components/venue/VenueInfo.tsx` - Detailed venue info dialog

#### Layout Components (3 files)
- [ ] `components/layout/CartFab.tsx` - Floating cart button with badge
- [ ] `components/layout/Header.tsx` - Top navigation bar
- [ ] `components/layout/BottomNav.tsx` - Bottom navigation (optional)

#### Checkout Components (3 files)
- [ ] `components/checkout/CheckoutForm.tsx` - Main checkout form
- [ ] `components/checkout/TableSelector.tsx` - Table number input
- [ ] `components/checkout/OrderSummary.tsx` - Price breakdown

#### Order Components (4 files)
- [ ] `components/order/OrderTracker.tsx` - Status display
- [ ] `components/order/OrderProgress.tsx` - Progress bar
- [ ] `components/order/OrderItems.tsx` - Items list
- [ ] `components/order/OrderReceipt.tsx` - Final receipt

#### Payment Components (4 files)
- [ ] `components/payment/PaymentSelector.tsx` - Choose MoMo/Revolut
- [ ] `components/payment/MoMoPayment.tsx` - MoMo USSD instructions
- [ ] `components/payment/RevolutPayment.tsx` - Revolut link handler
- [ ] `components/payment/PaymentStatus.tsx` - Payment confirmation

#### UI Components (6 files)
- [ ] `components/ui/Card.tsx` - Card container
- [ ] `components/ui/Sheet.tsx` - Bottom sheet/drawer
- [ ] `components/ui/Toast.tsx` - Toast notifications
- [ ] `components/ui/Badge.tsx` - Badge component
- [ ] `components/ui/Skeleton.tsx` - Loading skeleton
- [ ] `components/ui/Dialog.tsx` - Modal dialog

#### Cart Components (3 files)
- [ ] `components/cart/CartSummary.tsx` - Cart totals
- [ ] `components/cart/CartItem.tsx` - Single cart item
- [ ] `components/cart/EmptyCart.tsx` - Empty state

**Estimated Time:** 8-10 hours total

---

### PHASE 4: API Routes (7 files)

#### Venue API
- [ ] `app/api/venue/[slug]/route.ts` - GET venue data
  ```typescript
  GET /api/venue/heaven-bar
  Returns: { venue, categories, items }
  ```

- [ ] `app/api/venue/[slug]/menu/route.ts` - GET menu items
  ```typescript
  GET /api/venue/heaven-bar/menu?category=appetizers
  Returns: MenuItem[]
  ```

#### Order API
- [ ] `app/api/order/create/route.ts` - POST create order
  ```typescript
  POST /api/order/create
  Body: { venueId, tableNumber, items, paymentMethod, ... }
  Returns: { orderId, status }
  ```

- [ ] `app/api/order/[orderId]/route.ts` - GET order status
  ```typescript
  GET /api/order/abc-123-def
  Returns: Order (with real-time status)
  ```

#### Payment API
- [ ] `app/api/payment/momo/initiate/route.ts` - Initiate MoMo payment
  ```typescript
  POST /api/payment/momo/initiate
  Body: { orderId, amount }
  Returns: { ussdCode, instructions }
  ```

- [ ] `app/api/payment/revolut/create/route.ts` - Generate Revolut link
  ```typescript
  POST /api/payment/revolut/create
  Body: { orderId, amount }
  Returns: { paymentLink }
  ```

- [ ] `app/api/payment/revolut/webhook/route.ts` - Handle payment confirmation
  ```typescript
  POST /api/payment/revolut/webhook
  Body: Revolut webhook payload
  Returns: { success }
  ```

**Estimated Time:** 4-5 hours

---

### PHASE 5: Payment Integration

#### MoMo (Rwanda)
**Method:** USSD - User self-serves  
**No API integration needed**

**Implementation:**
1. Display USSD code: `*182*7*1#`
2. Show bar code + amount
3. User dials manually
4. Poll order status for payment confirmation

**Files:**
- [ ] `lib/payment/momo.ts`
- [ ] `components/payment/MoMoPayment.tsx`

**Estimated Time:** 2 hours

---

#### Revolut (Malta)
**Method:** Payment Link  
**Requires:** Revolut API credentials

**Implementation:**
1. Generate payment link via API
2. Open link in new tab/window
3. Listen for webhook callback
4. Update order status on confirmation

**Files:**
- [ ] `lib/payment/revolut.ts`
- [ ] `components/payment/RevolutPayment.tsx`
- [ ] `app/api/payment/revolut/create/route.ts`
- [ ] `app/api/payment/revolut/webhook/route.ts`

**Estimated Time:** 4 hours

---

### PHASE 6: PWA Enhancements

#### PWA Assets
- [ ] Generate icons (192x192, 512x512)
- [ ] Create maskable icons
- [ ] Generate splash screens (iOS)
- [ ] Update manifest.json

**Script:** Run `./setup-pwa.sh`

#### Service Worker
- [ ] `public/sw.js` - Offline caching
- [ ] Cache menu data
- [ ] Background sync
- [ ] Push notification handler

#### Install Prompt
- [ ] `components/layout/PWAInstallPrompt.tsx`
- [ ] Detect if installable
- [ ] Show install button
- [ ] Track installation

**Estimated Time:** 3-4 hours

---

## 📋 COMPLETE FILE CHECKLIST

### To Create (54 files total)

**Database (2 files)** ✅
- [x] supabase/migrations/20251127223000_client_pwa_schema.sql
- [x] supabase/seed/client_pwa_seed.sql

**Pages (4 files)** ❌
- [ ] app/[venueSlug]/page.tsx
- [ ] app/[venueSlug]/cart/page.tsx
- [ ] app/[venueSlug]/checkout/page.tsx
- [ ] app/[venueSlug]/order/[orderId]/page.tsx

**API Routes (7 files)** ❌
- [ ] app/api/venue/[slug]/route.ts
- [ ] app/api/venue/[slug]/menu/route.ts
- [ ] app/api/order/create/route.ts
- [ ] app/api/order/[orderId]/route.ts
- [ ] app/api/payment/momo/initiate/route.ts
- [ ] app/api/payment/revolut/create/route.ts
- [ ] app/api/payment/revolut/webhook/route.ts

**Components (28 files)** ❌
- [ ] components/venue/VenueHeader.tsx
- [ ] components/venue/VenueInfo.tsx
- [ ] components/layout/CartFab.tsx
- [ ] components/layout/Header.tsx
- [ ] components/layout/BottomNav.tsx
- [ ] components/checkout/CheckoutForm.tsx
- [ ] components/checkout/TableSelector.tsx
- [ ] components/checkout/OrderSummary.tsx
- [ ] components/order/OrderTracker.tsx
- [ ] components/order/OrderProgress.tsx
- [ ] components/order/OrderItems.tsx
- [ ] components/order/OrderReceipt.tsx
- [ ] components/payment/PaymentSelector.tsx
- [ ] components/payment/MoMoPayment.tsx
- [ ] components/payment/RevolutPayment.tsx
- [ ] components/payment/PaymentStatus.tsx
- [ ] components/ui/Card.tsx
- [ ] components/ui/Sheet.tsx
- [ ] components/ui/Toast.tsx
- [ ] components/ui/Badge.tsx
- [ ] components/ui/Skeleton.tsx
- [ ] components/ui/Dialog.tsx
- [ ] components/cart/CartSummary.tsx
- [ ] components/cart/CartItem.tsx
- [ ] components/cart/EmptyCart.tsx

**Types (2 files)** ❌
- [ ] types/venue.ts
- [ ] types/order.ts

**Libraries (2 files)** ❌
- [ ] lib/payment/momo.ts
- [ ] lib/payment/revolut.ts

**PWA (3 files)** ❌
- [ ] public/sw.js
- [ ] public/icons/* (multiple)
- [ ] components/layout/PWAInstallPrompt.tsx

---

## ⏱️ TIME ESTIMATES

### By Phase
- **Phase 1:** Database - 0.5 hours ✅ (migration created, needs apply)
- **Phase 2:** Core Pages - 8-12 hours
- **Phase 3:** Components - 8-10 hours
- **Phase 4:** API Routes - 4-5 hours
- **Phase 5:** Payments - 6 hours
- **Phase 6:** PWA - 3-4 hours

### Total Estimates
- **To MVP** (Phases 1-4): 20-27 hours (2.5-3.5 days)
- **To Production** (All Phases): 30-37 hours (4-5 days)

---

## 🎯 CRITICAL PATH (MVP)

These must be completed for basic functionality:

1. ✅ Database migration applied
2. ❌ Venue page created
3. ❌ Cart page created
4. ❌ Checkout page created
5. ❌ Order tracking page created
6. ❌ Order creation API
7. ❌ Payment selector component
8. ❌ MoMo payment instructions

**Once these work:** User can browse menu → add to cart → checkout → track order

---

## 📚 REFERENCE DOCUMENTS

1. **IMPLEMENTATION_PLAN_DETAILED.md** - Full roadmap with code examples
2. **NEXT_STEPS_GUIDE.md** - Step-by-step actionable tasks
3. **EXECUTIVE_SUMMARY.md** - High-level overview
4. **CHECKLIST.md** - Implementation checklist
5. **This file** - Detailed pending features

---

## 🚀 READY TO START?

**Option 1:** Step-by-step
- I create files one phase at a time
- Test after each phase
- Catch issues early

**Option 2:** Batch creation
- I create all 54 files at once
- You test everything together
- Faster but harder to debug

**Option 3:** You implement
- Use the guides I created
- Follow the checklists
- Ask questions as needed

**Just say:** "proceed step-by-step" or "create all files" or "I'll take it from here"

---

**Status:** Detailed plan complete, ready to implement  
**Next Action:** Your choice - proceed or review  
**Goal:** Working MVP in 3-4 days
