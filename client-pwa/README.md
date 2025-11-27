# EasyMO Client PWA

World-class, native-feeling Progressive Web Application for bar and restaurant customers.

## 🎯 Features

- **QR Code Scanning**: Scan table QR codes to access venue menus
- **Beautiful Menu Browsing**: Touch-optimized, categorized menu display
- **Smart Cart**: Persistent cart with quantity management
- **Multiple Payment Methods**: MoMo (Rwanda) and Revolut Link (Malta)
- **Real-time Order Tracking**: Live status updates via Supabase Realtime
- **Offline Support**: Service worker for offline menu viewing
- **Installable PWA**: Add to home screen for native app experience
- **Dark Mode Optimized**: Eye-friendly for bar/restaurant environments
- **Multi-language**: EN, FR, RW (Kinyarwanda)

## 🏗️ Architecture

```
Next.js 15 (App Router)
├── Framer Motion (animations)
├── Zustand (state management)
├── TanStack Query (server state)
├── Supabase (backend & realtime)
└── Tailwind CSS (styling)
```

## 📱 User Journey

1. **Scan QR Code** → Detects venue & table
2. **Browse Menu** → Category tabs, search, filters
3. **Add to Cart** → Persistent cart with quantity controls
4. **Checkout** → Payment method selection
5. **Track Order** → Real-time status updates
6. **Receive & Rate** → Order completion & feedback

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10.18.3+

### Installation

```bash
cd client-pwa
pnpm install
```

### Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Development

```bash
pnpm dev
# Open http://localhost:3002
```

### Build

```bash
pnpm build
pnpm start
```

## 📂 Project Structure

```
client-pwa/
├── app/                      # Next.js App Router
│   ├── [venueSlug]/         # Dynamic venue routes
│   │   ├── page.tsx         # Venue home/menu
│   │   ├── cart/            # Shopping cart
│   │   ├── checkout/        # Checkout flow
│   │   └── order/           # Order tracking
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout
│   └── manifest.ts          # PWA manifest
├── components/
│   ├── ui/                  # Base UI components
│   ├── menu/                # Menu components
│   ├── cart/                # Cart components
│   ├── order/               # Order components
│   └── payment/             # Payment components
├── hooks/                   # Custom React hooks
├── stores/                  # Zustand stores
├── lib/                     # Utilities
└── types/                   # TypeScript types
```

## 🎨 Design System

### Color Palette

- **Primary**: `#f9a825` (Gold) - Brand color
- **Background**: `#0a0a0a` (Dark) - Main background
- **Card**: `#141414` (Dark Secondary) - Elevated surfaces

### Typography

- **Font**: Inter Variable
- **Display**: Cal Sans (headings)

### Touch Targets

- Minimum: 44x44px (Apple HIG compliant)
- Buttons: 48x48px recommended

## 🔌 Integration Points

### Supabase Tables

```sql
-- Venues
venues (id, name, slug, logo_url, is_active...)

-- Menu Items
menu_items (id, venue_id, name, price, image_url...)

-- Categories
menu_categories (id, venue_id, name, slug, display_order...)

-- Orders
orders (id, venue_id, customer_phone, items, total, status...)

-- Payments
payments (id, order_id, method, status, transaction_id...)
```

### Realtime Subscriptions

```typescript
// Order status updates
supabase
  .channel(`order:${orderId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'orders',
    filter: `id=eq.${orderId}`,
  }, handleOrderUpdate)
  .subscribe();
```

## 🔐 Security

- **RLS Policies**: All tables protected by Row Level Security
- **Anon Key Only**: Client uses public anon key
- **Payment Webhooks**: Server-side verification
- **No Secrets**: Environment vars are NEXT_PUBLIC_* only

## 📊 Performance Targets

- **First Load**: < 2 seconds
- **Time to Interactive**: < 3 seconds
- **Lighthouse Score**: 90+ (all categories)
- **Bundle Size**: < 200KB gzipped
- **Animations**: 60fps target

## 🧪 Testing

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Type checking
pnpm type-check

# Lighthouse audit
pnpm lighthouse
```

## 📱 PWA Features

- **Installable**: Add to home screen prompt
- **Offline Menu**: Service worker caches menu
- **Push Notifications**: Order status updates (future)
- **Background Sync**: Retry failed orders (future)

## 🌍 Internationalization

Supported languages:
- 🇬🇧 English (default)
- 🇫🇷 French
- 🇷🇼 Kinyarwanda

## 🚢 Deployment

### Vercel (Recommended)

```bash
vercel --prod
```

### Manual

```bash
pnpm build
# Deploy .next directory + public/
```

## 📝 Implementation Status

### ✅ Completed
- [x] Project structure
- [x] Design tokens
- [x] Type definitions
- [x] Cart store
- [x] PWA manifest
- [x] Root layout
- [x] Landing page

### 🚧 In Progress
- [ ] Menu components (MenuItemCard, CategoryTabs)
- [ ] Cart sheet component
- [ ] Supabase client setup
- [ ] QR scanner integration

### 📋 Todo
- [ ] Venue page
- [ ] Checkout flow
- [ ] Payment integration (MoMo, Revolut)
- [ ] Order tracking
- [ ] Real-time subscriptions
- [ ] i18n setup
- [ ] E2E tests
- [ ] PWA install prompt

## 🤝 Integration with Existing System

This PWA integrates with:

- **Waiter AI Agent**: WhatsApp ordering backend
- **Bar Manager App**: Desktop order management
- **Admin Panel**: Business administration
- **Supabase**: Shared database & auth

## 📚 Documentation

- [Design Specification](./DESIGN_SPEC.md) - Full UI/UX details
- [API Integration](./API_INTEGRATION.md) - Backend endpoints
- [Component Library](./COMPONENTS.md) - Component docs

## 🐛 Troubleshooting

### Build Errors

```bash
# Clear cache
rm -rf .next node_modules
pnpm install
pnpm build
```

### PWA Not Installing

- Check HTTPS (required for PWA)
- Verify manifest.ts is correct
- Check browser console for errors

## 📄 License

Private - EasyMO Project

---

**Built with ❤️ for EasyMO**
