# EasyMO Client PWA - Development Checklist

## ✅ Phase 1: Foundation (COMPLETE)

- [x] Project structure created
- [x] Package.json configured
- [x] TypeScript setup
- [x] Tailwind CSS configured
- [x] Next.js + PWA config
- [x] Type definitions (Menu, Cart, Venue, Order)
- [x] Cart store (Zustand)
- [x] Custom hooks (useHaptics, usePWA)
- [x] Design tokens
- [x] Global CSS
- [x] Root layout
- [x] Landing page
- [x] Documentation (README, IMPLEMENTATION, QUICKSTART)
- [x] Workspace integration (pnpm-workspace.yaml)

## 📋 Phase 2: Core Components (TODO)

### Supabase Integration
- [ ] Create `lib/supabase/client.ts`
- [ ] Create `lib/supabase/server.ts`
- [ ] Setup realtime subscriptions
- [ ] Test connection

### Base UI Components
- [ ] `components/ui/Button.tsx`
- [ ] `components/ui/Card.tsx`
- [ ] `components/ui/Sheet.tsx` (bottom sheet)
- [ ] `components/ui/Badge.tsx`
- [ ] `components/ui/Skeleton.tsx`
- [ ] `components/ui/Toast.tsx`
- [ ] `components/ui/Input.tsx`

### Menu Components
- [ ] `components/menu/MenuItemCard.tsx` (from spec)
- [ ] `components/menu/CategoryTabs.tsx` (from spec)
- [ ] `components/menu/MenuGrid.tsx`
- [ ] `components/menu/SearchBar.tsx`
- [ ] `components/menu/FilterSheet.tsx`

### Layout Components
- [ ] `components/layout/Header.tsx`
- [ ] `components/layout/BottomNav.tsx`
- [ ] `components/layout/CartFab.tsx` (floating action button)

## 📋 Phase 3: Cart & Checkout (TODO)

### Cart Components
- [ ] `components/cart/CartSheet.tsx` (from spec)
- [ ] `components/cart/CartItem.tsx`
- [ ] `components/cart/QuantitySelector.tsx`
- [ ] `components/cart/CartSummary.tsx`

### Checkout Flow
- [ ] `app/[venueSlug]/checkout/page.tsx`
- [ ] Customer info form
- [ ] Table number confirmation
- [ ] Payment method selection
- [ ] Order summary
- [ ] Submit logic

## 📋 Phase 4: Payment Integration (TODO)

### MoMo (Rwanda)
- [ ] Create Edge Function: `supabase/functions/momo-collect/`
- [ ] Implement `lib/payment/momo.ts`
- [ ] Create payment initiation flow
- [ ] Handle callback/webhook
- [ ] Test with sandbox

### Revolut (Malta)
- [ ] Create Edge Function: `supabase/functions/revolut-link/`
- [ ] Implement `lib/payment/revolut.ts`
- [ ] Generate payment links
- [ ] Handle redirects
- [ ] Test with sandbox

### Payment Components
- [ ] `components/payment/PaymentSelector.tsx`
- [ ] `components/payment/MoMoPayment.tsx`
- [ ] `components/payment/RevolutPayment.tsx`
- [ ] `components/payment/PaymentStatus.tsx`

## 📋 Phase 5: Order Tracking (TODO)

### Order Components
- [ ] `components/order/OrderStatus.tsx`
- [ ] `components/order/OrderProgress.tsx`
- [ ] `components/order/OrderItems.tsx`
- [ ] `components/order/OrderReceipt.tsx`

### Realtime Features
- [ ] Create `hooks/useOrderTracking.ts`
- [ ] Setup Supabase realtime channel
- [ ] Handle status updates
- [ ] Show notifications
- [ ] Estimated ready time

### Order Page
- [ ] `app/[venueSlug]/order/[orderId]/page.tsx`
- [ ] Real-time status display
- [ ] Order details
- [ ] Receipt download

## 📋 Phase 6: QR Scanner (TODO)

### Scanner Implementation
- [ ] `components/venue/QRScanner.tsx`
- [ ] Camera permission handling
- [ ] QR code parsing
- [ ] Redirect to venue page
- [ ] Error handling

### QR Code Format
- [ ] Define format: `https://order.easymo.app/[venue-slug]?table=[number]`
- [ ] Generate QR codes in Admin Panel
- [ ] Print QR codes for tables

## 📋 Phase 7: Venue Page (TODO)

### Venue Components
- [ ] `components/venue/VenueHeader.tsx`
- [ ] `components/venue/VenueInfo.tsx`
- [ ] `components/venue/TableSelector.tsx`

### Venue Page
- [ ] `app/[venueSlug]/page.tsx`
- [ ] Fetch venue data
- [ ] Display menu
- [ ] Category filtering
- [ ] Search functionality
- [ ] Cart integration

### Data Fetching
- [ ] `lib/api/venue.ts` - Get venue by slug
- [ ] `lib/api/menu.ts` - Get menu items
- [ ] Error handling
- [ ] Loading states

## 📋 Phase 8: Database (TODO)

### Supabase Tables
- [ ] Create `venues` table
- [ ] Create `menu_categories` table
- [ ] Create `menu_items` table
- [ ] Create `orders` table
- [ ] Create `payments` table

### RLS Policies
- [ ] Venue read policies
- [ ] Menu read policies
- [ ] Order write policies
- [ ] Payment security

### Seed Data
- [ ] Sample venue
- [ ] Sample categories
- [ ] Sample menu items
- [ ] Test data

## 📋 Phase 9: Polish & Performance (TODO)

### Optimizations
- [ ] Image optimization (next/image)
- [ ] Route prefetching
- [ ] Code splitting
- [ ] Bundle analysis
- [ ] Lighthouse audit (target 90+)

### Animations
- [ ] Page transitions
- [ ] Cart add animation
- [ ] Loading skeletons
- [ ] Toast notifications
- [ ] Haptic feedback (all buttons)

### Accessibility
- [ ] WCAG 2.1 AA compliance
- [ ] Keyboard navigation
- [ ] Screen reader labels
- [ ] Focus indicators
- [ ] Color contrast

### PWA Features
- [ ] Install prompt timing
- [ ] Offline menu caching
- [ ] Add to home screen
- [ ] Splash screens
- [ ] App shortcuts

## 📋 Phase 10: Internationalization (TODO)

### Setup
- [ ] Configure next-intl
- [ ] Create language files
  - [ ] `i18n/en.json`
  - [ ] `i18n/fr.json`
  - [ ] `i18n/rw.json`
- [ ] Language switcher UI
- [ ] Format numbers/currency
- [ ] RTL support (if needed)

## 📋 Phase 11: Testing (TODO)

### Unit Tests
- [ ] Cart store tests
- [ ] Utility function tests
- [ ] Component tests (React Testing Library)
- [ ] Hook tests

### E2E Tests
- [ ] Landing page flow
- [ ] Menu browsing
- [ ] Add to cart
- [ ] Checkout flow
- [ ] Payment (mock)
- [ ] Order tracking

### Manual Testing
- [ ] iOS Safari
- [ ] Android Chrome
- [ ] Desktop browsers
- [ ] Offline mode
- [ ] PWA install

## 📋 Phase 12: Deployment (TODO)

### Pre-deployment
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] Edge Functions deployed
- [ ] RLS policies enabled
- [ ] Payment webhooks configured

### Deployment
- [ ] Deploy to Vercel/Netlify
- [ ] Configure domain (order.easymo.app)
- [ ] SSL certificate
- [ ] Test production build
- [ ] Verify PWA works

### Post-deployment
- [ ] Monitor errors (Sentry)
- [ ] Analytics setup
- [ ] Performance monitoring
- [ ] User feedback collection

## 📊 Progress Tracking

**Overall Progress**: 8% (Phase 1 complete)

- Phase 1: ✅ 100%
- Phase 2: ⬜ 0%
- Phase 3: ⬜ 0%
- Phase 4: ⬜ 0%
- Phase 5: ⬜ 0%
- Phase 6: ⬜ 0%
- Phase 7: ⬜ 0%
- Phase 8: ⬜ 0%
- Phase 9: ⬜ 0%
- Phase 10: ⬜ 0%
- Phase 11: ⬜ 0%
- Phase 12: ⬜ 0%

**Estimated Time to MVP**: 2-3 weeks

## 🎯 Current Focus

**Next Task**: Install dependencies and start Phase 2

```bash
pnpm install
pnpm dev
```

Then create Supabase client and base UI components.

---

Last updated: 2025-11-27
