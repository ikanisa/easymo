# Waiter AI PWA - Phase 3 Implementation Plan

## Overview
Phase 3 focuses on building the Progressive Web App frontend that provides a native-like mobile experience for the Waiter AI system.

## Tech Stack Decision

### Option 1: Next.js 15 (Recommended)
**Pros**:
- Built-in PWA support via next-pwa plugin
- Server-side rendering for fast initial load
- App Router with React Server Components
- Excellent TypeScript support
- Can deploy to Vercel easily

**Cons**:
- Slightly more complex setup
- Larger bundle size

### Option 2: Vite + React (Lighter)
**Pros**:
- Faster dev server
- Smaller bundle size
- Simple PWA setup with vite-plugin-pwa
- Already using Vite in main project

**Cons**:
- More manual configuration
- No built-in SSR

**Decision**: Use **Next.js 15** for production-grade PWA features

---

## Phase 3A: PWA Shell (Day 1-2)

### 1. Create Next.js App
```bash
npx create-next-app@latest waiter-pwa \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"
```

### 2. Install Dependencies
```bash
cd waiter-pwa
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
npm install next-pwa
npm install react-i18next i18next
npm install @headlessui/react @heroicons/react
npm install clsx tailwind-merge
npm install framer-motion (for animations)
```

### 3. Configure PWA
- Setup next-pwa in next.config.js
- Create manifest.json
- Configure service worker
- Add offline fallback page

### 4. Setup Supabase Client
- Create Supabase client utilities
- Setup anonymous auth
- Configure environment variables

### 5. Basic Layout
- App shell with header, main, footer
- Bottom navigation (Chat, Menu, Cart, Profile)
- Loading states
- Error boundaries

---

## Phase 3B: Chat Interface (Day 3-4)

### 1. Chat UI Components
```
components/chat/
  ├── ChatContainer.tsx        # Main chat wrapper
  ├── MessageList.tsx          # Scrollable message list
  ├── MessageBubble.tsx        # Individual message
  ├── MessageInput.tsx         # Text input + send button
  ├── TypingIndicator.tsx      # "AI is typing..."
  └── QuickActions.tsx         # Quick action buttons
```

### 2. Chat Features
- Message bubbles (user vs assistant)
- Typing indicator
- Auto-scroll to bottom
- Message timestamps
- Quick action buttons (View Menu, My Cart, etc.)
- Voice input (optional)

### 3. Agent Integration Stub
- Create API route for chat
- Mock responses for testing
- Prepare for OpenAI integration

---

## Phase 3C: Menu Browser (Day 5)

### 1. Menu Components
```
components/menu/
  ├── MenuCategories.tsx       # Category tabs/pills
  ├── MenuItemCard.tsx         # Item card with image
  ├── MenuItemDetail.tsx       # Modal with full details
  ├── DietaryFilters.tsx       # Veg, vegan, etc. filters
  └── SearchBar.tsx            # Search menu items
```

### 2. Features
- Category filtering
- Search functionality
- Dietary filters
- Item details modal
- "Add to Cart" from menu
- Image lazy loading

---

## Phase 3D: Cart & Checkout (Day 6-7)

### 1. Cart Components
```
components/cart/
  ├── CartDrawer.tsx           # Slide-in cart
  ├── CartItem.tsx             # Item in cart with qty controls
  ├── CartSummary.tsx          # Subtotal, tax, total
  └── CheckoutButton.tsx       # Proceed to checkout
```

### 2. Checkout Components
```
components/checkout/
  ├── CheckoutFlow.tsx         # Multi-step checkout
  ├── OrderSummary.tsx         # Review order
  ├── PaymentMethodPicker.tsx  # Choose payment method
  ├── PaymentInstructions.tsx  # USSD/Revolut instructions
  └── PaymentConfirm.tsx       # "I've Paid" button
```

### 3. Features
- Quantity controls (-, +)
- Remove items
- Special instructions
- Tip selection
- Payment method selection
- Payment instruction screens
- Confirmation flow

---

## Phase 3E: Multilingual Support (Day 8)

### 1. i18n Setup
```
locales/
  ├── en/
  │   ├── common.json
  │   ├── menu.json
  │   └── payment.json
  ├── fr/
  ├── es/
  ├── pt/
  └── de/
```

### 2. Features
- Language detector (browser locale)
- Language switcher
- RTL support (future)
- Dynamic content translation
- Menu item translations

---

## Phase 3F: Offline Support (Day 9)

### 1. Service Worker Strategy
- Cache static assets
- Cache menu data
- Queue mutations (IndexedDB)
- Background sync

### 2. Offline Features
- Offline fallback page
- Cached menu browsing
- Queue cart actions
- Sync when online

---

## Phase 3G: Polish & Testing (Day 10)

### 1. UI Polish
- Loading skeletons
- Empty states
- Error states
- Success animations
- Haptic feedback (mobile)

### 2. Performance
- Code splitting
- Image optimization
- Font optimization
- Lighthouse audit (target 90+)

### 3. Testing
- Manual testing all flows
- Mobile device testing
- PWA install testing
- Offline testing

---

## File Structure

```
waiter-pwa/
├── app/
│   ├── layout.tsx              # Root layout with providers
│   ├── page.tsx                # Home/Onboarding
│   ├── chat/
│   │   └── page.tsx            # Chat interface
│   ├── menu/
│   │   └── page.tsx            # Menu browser
│   ├── cart/
│   │   └── page.tsx            # Cart & checkout
│   ├── orders/
│   │   └── [id]/page.tsx       # Order status
│   └── api/
│       ├── chat/route.ts       # Chat API
│       └── auth/route.ts       # Auth API
├── components/
│   ├── chat/
│   ├── menu/
│   ├── cart/
│   ├── checkout/
│   ├── layout/
│   └── ui/                     # Reusable UI components
├── lib/
│   ├── supabase.ts             # Supabase client
│   ├── waiter-tools.ts         # Tool caller
│   └── utils.ts                # Utilities
├── locales/
│   └── [lang]/                 # Translation files
├── public/
│   ├── manifest.json
│   ├── icons/
│   └── images/
├── styles/
│   └── globals.css
└── next.config.js
```

---

## Environment Variables

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
NEXT_PUBLIC_RESTAURANT_ID=uuid
OPENAI_API_KEY=sk-xxx (server-side only)
```

---

## Success Criteria

### Phase 3A (PWA Shell)
- [ ] Next.js app created
- [ ] PWA configured (manifest, service worker)
- [ ] Installable on mobile
- [ ] Basic layout with navigation

### Phase 3B (Chat)
- [ ] Chat UI functional
- [ ] Messages display correctly
- [ ] Input field works
- [ ] Mock responses work

### Phase 3C (Menu)
- [ ] Menu items load from Supabase
- [ ] Category filtering works
- [ ] Search works
- [ ] Add to cart from menu

### Phase 3D (Cart & Checkout)
- [ ] Cart displays items
- [ ] Quantity controls work
- [ ] Checkout flow complete
- [ ] Payment instructions show
- [ ] Confirmation flow works

### Phase 3E (Multilingual)
- [ ] Language switcher works
- [ ] All UI text translated
- [ ] Menu items show in selected language

### Phase 3F (Offline)
- [ ] App works offline (cached menu)
- [ ] Service worker active
- [ ] Offline fallback page

### Phase 3G (Polish)
- [ ] Lighthouse PWA score 90+
- [ ] No console errors
- [ ] Smooth animations
- [ ] Tested on real devices

---

## Timeline

**Total: 10 days (80 hours)**

| Phase | Days | Tasks |
|-------|------|-------|
| 3A: PWA Shell | 2 | Setup, config, layout |
| 3B: Chat | 2 | Chat UI, integration |
| 3C: Menu | 1 | Menu browser |
| 3D: Cart | 2 | Cart, checkout, payment |
| 3E: i18n | 1 | Multilingual support |
| 3F: Offline | 1 | Service worker, caching |
| 3G: Polish | 1 | Testing, optimization |

**Start Date**: November 13, 2025
**Target Completion**: November 23, 2025

---

## Next Steps

**Immediate Actions**:
1. Create waiter-pwa directory
2. Initialize Next.js project
3. Install dependencies
4. Configure PWA
5. Setup Supabase client
6. Create basic layout

Let's begin! 🚀

