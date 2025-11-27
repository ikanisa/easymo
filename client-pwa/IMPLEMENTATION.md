# EasyMO Client PWA - Implementation Guide

## Phase 1: Foundation ✅ COMPLETE

### Completed Items
- [x] Project structure created
- [x] Package.json with all dependencies
- [x] TypeScript configuration
- [x] Tailwind CSS setup
- [x] Next.js configuration with PWA
- [x] Design tokens (colors, spacing, animations)
- [x] Type definitions (Menu, Cart, Order, Venue)
- [x] Utility functions (cn, formatPrice, etc.)
- [x] Cart store (Zustand with persistence)
- [x] Custom hooks (useHaptics, usePWA)
- [x] Global CSS with mobile optimizations
- [x] PWA manifest
- [x] Root layout with metadata
- [x] Landing page

## Phase 2: Core Components (Next Steps)

### 2.1 Base UI Components

Create these in `components/ui/`:

```typescript
// Button.tsx - Touch-optimized button
// Card.tsx - Glass-morphism card
// Sheet.tsx - Bottom sheet (cart, filters)
// Badge.tsx - Category/status badges
// Skeleton.tsx - Loading states
// Toast.tsx - Notifications
```

**Priority**: HIGH - Needed for all other components

### 2.2 Supabase Integration

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

**Priority**: HIGH - Required for data fetching

### 2.3 Menu Components

1. **MenuItemCard** (from spec) - Display menu items
2. **CategoryTabs** (from spec) - Horizontal scrolling tabs
3. **SearchBar** - Search menu items
4. **FilterSheet** - Dietary filters

**Priority**: HIGH - Core user experience

## Phase 3: Cart & Checkout

### 3.1 Cart Components

1. **CartSheet** (from spec) - Bottom sheet with drag
2. **CartItem** - Individual cart item
3. **QuantitySelector** - +/- buttons
4. **CartSummary** - Totals display

**Priority**: HIGH - Critical for ordering

### 3.2 Checkout Flow

```
app/[venueSlug]/checkout/page.tsx

Sections:
1. Customer info (phone required for MoMo)
2. Table number confirmation
3. Payment method selection
4. Order summary
5. Submit button
```

**Priority**: MEDIUM - After cart works

## Phase 4: Payment Integration

### 4.1 MoMo Integration (Rwanda)

```typescript
// lib/payment/momo.ts

export async function initiateMoMoPayment(params: {
  amount: number;
  phone: string;
  orderId: string;
}) {
  // Call Supabase Edge Function
  const { data } = await supabase.functions.invoke('momo-collect', {
    body: params,
  });
  
  return data;
}
```

**Edge Function Required**: `supabase/functions/momo-collect/`

### 4.2 Revolut Link (Malta)

```typescript
// lib/payment/revolut.ts

export async function createRevolutPaymentLink(params: {
  amount: number;
  orderId: string;
}) {
  const { data } = await supabase.functions.invoke('revolut-link', {
    body: params,
  });
  
  return data.payment_url;
}
```

**Edge Function Required**: `supabase/functions/revolut-link/`

**Priority**: HIGH - Critical for going live

## Phase 5: Order Tracking

### 5.1 Order Status Page

```
app/[venueSlug]/order/[orderId]/page.tsx

Features:
- Real-time status updates
- Progress indicator
- Estimated ready time
- Order items list
- Receipt download
```

### 5.2 Realtime Subscriptions

```typescript
// hooks/useOrderTracking.ts

export function useOrderTracking(orderId: string) {
  useEffect(() => {
    const channel = supabase
      .channel(`order:${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      }, (payload) => {
        // Update order status
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);
}
```

**Priority**: MEDIUM - Nice to have for v1

## Phase 6: QR Code Scanner

### 6.1 Scanner Component

```typescript
// components/venue/QRScanner.tsx

import QrScanner from 'qr-scanner';

export function QRScanner({ onScan }: { onScan: (data: string) => void }) {
  // Use device camera to scan QR codes
  // Parse venue slug + table number
  // Redirect to /[venueSlug]?table=5
}
```

**Priority**: HIGH - Primary entry point

### 6.2 QR Code Format

```
https://order.easymo.app/heaven-bar?table=5
                         ^venue-slug  ^table
```

**Admin Panel Task**: Generate QR codes for each table

## Phase 7: Venue Page

### 7.1 Dynamic Route

```
app/[venueSlug]/page.tsx

Components:
- VenueHeader (logo, name, info)
- TableSelector (if not from QR)
- CategoryTabs
- MenuGrid (with MenuItemCard)
- CartFab (floating action button)
```

### 7.2 Data Fetching

```typescript
export default async function VenuePage({ 
  params: { venueSlug },
  searchParams: { table }
}) {
  const venue = await getVenue(venueSlug);
  const categories = await getCategories(venue.id);
  const menuItems = await getMenuItems(venue.id);
  
  return <VenueMenu venue={venue} table={table} />;
}
```

**Priority**: HIGH - Main app page

## Phase 8: Polish & Performance

### 8.1 Optimizations

- [ ] Image optimization (next/image)
- [ ] Route prefetching
- [ ] Bundle analysis
- [ ] Lighthouse audit (target: 90+)
- [ ] PWA install prompt timing

### 8.2 Animations

- [ ] Page transitions (Framer Motion)
- [ ] Cart add animation
- [ ] Loading skeletons
- [ ] Success/error toasts
- [ ] Haptic feedback (all interactions)

### 8.3 Accessibility

- [ ] WCAG 2.1 AA compliance
- [ ] Keyboard navigation
- [ ] Screen reader labels
- [ ] Color contrast (dark mode)
- [ ] Focus indicators

**Priority**: MEDIUM - Before production

## Phase 9: Internationalization

### 9.1 Setup next-intl

```typescript
// i18n/en.json
{
  "menu": {
    "title": "Menu",
    "search": "Search items...",
    "addToCart": "Add to Cart"
  },
  "cart": {
    "title": "Your Cart",
    "empty": "Cart is empty",
    "checkout": "Checkout"
  }
}
```

### 9.2 Language Files

- `i18n/en.json` - English
- `i18n/fr.json` - French
- `i18n/rw.json` - Kinyarwanda

**Priority**: LOW - Can launch with English only

## Phase 10: Testing & Deployment

### 10.1 Testing

```bash
# Unit tests (Vitest)
pnpm test

# E2E tests (Playwright)
pnpm test:e2e

# Type checking
pnpm type-check

# Lighthouse CI
pnpm lighthouse
```

### 10.2 Deployment Checklist

- [ ] Environment variables configured
- [ ] Supabase tables created
- [ ] RLS policies enabled
- [ ] Edge functions deployed
- [ ] Domain configured (order.easymo.app)
- [ ] SSL certificate
- [ ] PWA manifest verified
- [ ] Service worker tested
- [ ] Payment methods tested
- [ ] QR codes generated

**Priority**: HIGH - Before launch

## Database Schema Required

### Tables Needed

```sql
-- Venues
CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  cover_image_url TEXT,
  currency TEXT DEFAULT 'RWF',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu Categories
CREATE TABLE menu_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id UUID REFERENCES venues(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  emoji TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(venue_id, slug)
);

-- Menu Items
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id UUID REFERENCES venues(id),
  category_id UUID REFERENCES menu_categories(id),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  emoji TEXT,
  is_available BOOLEAN DEFAULT true,
  is_popular BOOLEAN DEFAULT false,
  is_vegetarian BOOLEAN DEFAULT false,
  prep_time_minutes INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id UUID REFERENCES venues(id),
  customer_phone TEXT,
  table_number TEXT,
  items JSONB NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) DEFAULT 0,
  service_fee DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  payment_status TEXT DEFAULT 'pending',
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id),
  method TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  transaction_id TEXT,
  provider_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## API Endpoints Needed

### Edge Functions

1. **momo-collect** - Initiate MoMo payment
2. **revolut-link** - Create Revolut payment link
3. **order-submit** - Create order with validation
4. **menu-sync** - Sync menu from Bar Manager

### REST Endpoints (via PostgREST)

- GET `/venues?slug=eq.{slug}`
- GET `/menu_categories?venue_id=eq.{id}`
- GET `/menu_items?venue_id=eq.{id}&is_available=eq.true`
- POST `/orders`
- GET `/orders?id=eq.{orderId}`

## Quick Start Commands

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Open http://localhost:3002

# Build for production
pnpm build

# Run production build locally
pnpm start

# Type checking
pnpm type-check

# Lint
pnpm lint
```

## Next Immediate Steps

1. **Install dependencies**: `cd client-pwa && pnpm install`
2. **Create .env.local** with Supabase credentials
3. **Create base UI components** (Button, Card, Sheet)
4. **Setup Supabase client**
5. **Create database tables** (see schema above)
6. **Implement MenuItemCard** (from your spec)
7. **Test on mobile device**

## Mobile Testing

```bash
# Get local IP
ipconfig getifaddr en0

# Start dev server
pnpm dev

# Access from phone:
# http://192.168.1.x:3002
```

---

**Status**: Foundation complete ✅
**Next**: Phase 2 - Core Components
**Timeline**: 2-3 weeks to MVP
