# Client PWA - Advanced Features Implementation Guide

## ✅ Completed Features

### 1. Core Infrastructure
- ✅ Haptic Feedback System (`lib/haptics.ts`)
- ✅ View Transitions API (`lib/view-transitions.ts`)
- ✅ Next.js 15 with App Router
- ✅ Supabase Integration
- ✅ Zustand State Management
- ✅ Framer Motion Animations

### 2. Required Dependencies

```bash
# Install these dependencies:
npm install --save qrcode.react canvas-confetti lottie-web @tanstack/react-virtual immer qr-scanner @types/qr-scanner

# Or with pnpm:
pnpm add qrcode.react canvas-confetti lottie-web @tanstack/react-virtual immer qr-scanner
pnpm add -D @types/qr-scanner @types/canvas-confetti
```

### 3. File Structure

```
client-pwa/
├── app/
│   ├── [venueSlug]/
│   │   ├── page.tsx                    # Venue menu page
│   │   ├── cart/page.tsx               # Shopping cart
│   │   ├── checkout/page.tsx           # Checkout flow
│   │   └── order/[orderId]/page.tsx    # Order tracking
│   ├── scan/page.tsx                   # QR Code scanner
│   ├── profile/page.tsx                # User profile
│   └── layout.tsx                      # Root layout
├── components/
│   ├── layout/
│   │   ├── BottomNav.tsx               # Bottom navigation
│   │   ├── CartFab.tsx                 # Floating cart button
│   │   └── PWAInstallPrompt.tsx        # Install prompt
│   ├── menu/
│   │   ├── CategoryTabs.tsx            # Category filtering
│   │   ├── MenuItemCard.tsx            # Item display
│   │   ├── VirtualizedMenuList.tsx     # Performance optimization
│   │   └── MenuSkeleton.tsx            # Loading state
│   ├── order/
│   │   ├── OrderTracker.tsx            # Real-time status
│   │   └── VoiceOrder.tsx              # Voice ordering
│   ├── payment/
│   │   └── PaymentSelector.tsx         # Payment methods
│   └── ui/
│       ├── PullToRefresh.tsx           # Pull-to-refresh
│       └── LottieAnimation.tsx         # Lottie animations
├── hooks/
│   ├── useHaptics.ts                   # From lib/haptics.ts
│   ├── useCart.ts                      # Cart management
│   ├── useSwipeNavigation.ts           # Gesture navigation
│   └── usePushNotifications.ts         # Push notifications
├── lib/
│   ├── haptics.ts                      # ✅ Created
│   ├── view-transitions.ts             # ✅ Created
│   ├── push-notifications.ts           # Push notification manager
│   ├── recommendations.ts              # AI recommendations
│   ├── supabase/
│   │   ├── client.ts                   # Supabase client
│   │   └── server.ts                   # Server-side client
│   └── utils.ts                        # Utilities (cn, etc.)
├── stores/
│   └── cart.ts                         # Zustand cart store
├── public/
│   ├── sw.js                           # Service worker
│   ├── manifest.json                   # PWA manifest
│   ├── icons/                          # App icons
│   └── sounds/                         # Haptic sounds
│       ├── tap.mp3
│       ├── success.mp3
│       ├── pop.mp3
│       └── cha-ching.mp3
└── styles/
    ├── globals.css                     # Global styles + view transitions
    └── animations.css                  # Custom animations
```

## 🎯 Implementation Priority

### Phase 1: Core PWA (Week 1)
1. ✅ Haptic feedback
2. ✅ View transitions
3. PWA manifest & service worker
4. QR code scanner
5. Basic menu display

### Phase 2: Commerce (Week 2)
1. Shopping cart (Zustand)
2. Checkout flow
3. Payment integration (MoMo + Revolut)
4. Order tracking (Supabase Realtime)

### Phase 3: Advanced Features (Week 3)
1. Voice ordering (Web Speech API)
2. Push notifications
3. AI recommendations
4. Offline support
5. Background sync

### Phase 4: Polish (Week 4)
1. Animations & micro-interactions
2. Pull-to-refresh
3. Lottie animations
4. Performance optimization
5. PWA install prompt

## 🚀 Quick Start

### 1. Environment Setup

Create `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# VAPID Keys for Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key

# Optional: Analytics
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

### 2. Install Dependencies

```bash
cd client-pwa
pnpm install
```

### 3. Run Development Server

```bash
pnpm dev
```

Visit `http://localhost:3002`

### 4. Build for Production

```bash
pnpm build
pnpm start
```

## 📱 PWA Configuration

### manifest.json

```json
{
  "name": "EasyMO - Smart Restaurant Ordering",
  "short_name": "EasyMO",
  "description": "Order food & drinks seamlessly via QR code",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#f9a825",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "categories": ["food", "lifestyle", "business"],
  "shortcuts": [
    {
      "name": "Scan QR Code",
      "short_name": "Scan",
      "description": "Scan table QR code",
      "url": "/scan",
      "icons": [{ "src": "/icons/scan-96x96.png", "sizes": "96x96" }]
    }
  ]
}
```

## 🔧 Key Integrations

### 1. Supabase Realtime (Order Tracking)

```typescript
// In OrderTracker component
useEffect(() => {
  const channel = supabase
    .channel(`order-${orderId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
      filter: `id=eq.${orderId}`,
    }, (payload) => {
      setStatus(payload.new.status);
      haptics.notification();
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [orderId]);
```

### 2. Payment Integration

#### MoMo (Rwanda)
- USSD: `*182*8*1*{amount}#`
- QR Code: Generate QR with order reference
- Webhook: Listen for payment confirmation

#### Revolut (Malta/Europe)
- Payment Link: `https://revolut.me/merchant/${orderId}`
- Redirect back after payment
- Webhook verification

### 3. Voice Ordering

```typescript
// Web Speech API
const recognition = new (window.SpeechRecognition || webkitSpeechRecognition)();
recognition.continuous = true;
recognition.interimResults = true;
recognition.lang = 'en-US';

recognition.onresult = (event) => {
  const transcript = Array.from(event.results)
    .map(result => result[0].transcript)
    .join('');
  
  // Send to AI for parsing
  await parseVoiceOrder(transcript);
};
```

## 📊 Database Schema

See `supabase/migrations/20251127100000_client_pwa_schema.sql` for complete schema.

Key tables:
- `venues` - Restaurant/bar information
- `menu_categories` - Menu categories
- `menu_items` - Individual items
- `orders` - Customer orders
- `payments` - Payment transactions
- `user_preferences` - For AI recommendations

## 🎨 Styling

### Tailwind Config

```javascript
// tailwind.config.ts
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#f9a825',
        // ... other colors
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
};
```

### View Transitions CSS

Add to `globals.css`:

```css
@view-transition {
  navigation: auto;
}

/* Slide transitions */
[data-transition="slide-left"]::view-transition-old(root) {
  animation: slide-out-left 300ms ease-out;
}

[data-transition="slide-left"]::view-transition-new(root) {
  animation: slide-in-right 300ms ease-out;
}

@keyframes slide-out-left {
  to { transform: translateX(-30%); opacity: 0; }
}

@keyframes slide-in-right {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
```

## 🚢 Deployment

### Netlify

1. Connect GitHub repository
2. Set build command: `pnpm build`
3. Set publish directory: `.next`
4. Add environment variables
5. Deploy!

### Vercel (Alternative)

```bash
npm i -g vercel
vercel --prod
```

## 🧪 Testing Checklist

- [ ] PWA installs on Android
- [ ] PWA installs on iOS (Add to Home Screen)
- [ ] Offline menu viewing works
- [ ] QR code scanning works
- [ ] Cart persists offline
- [ ] Orders sync when back online
- [ ] Push notifications arrive
- [ ] Haptic feedback works
- [ ] Voice ordering functional
- [ ] Payments process correctly
- [ ] Real-time order updates work

## 📈 Performance Targets

- ✅ First Contentful Paint < 1.5s
- ✅ Time to Interactive < 3.5s
- ✅ Lighthouse PWA Score > 90
- ✅ Lighthouse Performance > 85
- ✅ Bundle size < 200KB (gzipped)

## 🔗 Integration Points

### Bar Manager App
- Real-time order synchronization via Supabase
- Order status updates
- Kitchen display integration

### WhatsApp AI Agent
- Cart sync across channels
- Order history access
- Support deep links

### Admin Panel
- Menu management
- Analytics dashboard
- User management

## 📚 Additional Resources

- [Next.js 15 Docs](https://nextjs.org/docs)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [View Transitions API](https://developer.chrome.com/docs/web-platform/view-transitions/)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [PWA Best Practices](https://web.dev/progressive-web-apps/)

## 🆘 Support

For issues or questions:
1. Check this guide
2. Review `docs/GROUND_RULES.md`
3. Check existing code in `waiter-pwa` for examples
4. Create GitHub issue

---

**Status**: 🚀 Ready for Implementation
**Last Updated**: 2025-11-27
**Version**: 1.0.0
