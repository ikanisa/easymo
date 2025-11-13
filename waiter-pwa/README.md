# 🍽️ Waiter AI PWA - Frontend Implementation Guide

## 🎯 Status: Backend Complete, Frontend Pending Implementation

### What's Ready:
- ✅ Complete database schema (12 tables) deployed to Supabase
- ✅ AI agent edge function live and operational
- ✅ 7 AI tools implemented (search, cart, wine, reservations, feedback)
- ✅ Multi-language support (EN, FR, ES, PT, DE)
- ✅ Streaming responses via SSE
- ✅ PWA project structure with dependencies

### What's Needed:
- ⚠️ 50-60 React component/view files
- ⚠️ i18n translation files
- ⚠️ UI component library (shadcn/ui)
- ⚠️ Testing suite

**Estimated Time:** 6-8 hours for MVP, 15-20 hours for production

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Set Up Environment Variables
```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

Required variables:
```bash
VITE_SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_APP_URL=http://localhost:8083
```

### 3. Create Missing Source Files

The implementation guide provides complete code for all files. Create these in order:

#### Phase 1: Core Infrastructure (Must Have)
```bash
# Create these files first
touch src/index.html
touch src/main.tsx
touch src/App.tsx
touch src/index.css
mkdir -p src/contexts src/components src/views src/hooks src/lib src/locales
```

Copy code from the implementation guide for each file.

#### Phase 2: Core Features
- Chat interface
- Menu browser
- Shopping cart

#### Phase 3: Advanced Features
- Payment processing
- Order tracking
- Reservations
- Feedback

### 4. Development
```bash
pnpm dev    # Starts on port 8083
```

### 5. Build
```bash
pnpm build
```

---

## 📂 Project Structure

```
waiter-pwa/
├── public/
│   ├── icon-192x192.png        # PWA icons (generate these)
│   ├── icon-512x512.png
│   ├── apple-touch-icon.png
│   └── robots.txt
├── src/
│   ├── main.tsx               # App entry point
│   ├── App.tsx                # Main app with routing
│   ├── index.css              # Tailwind imports
│   ├── i18n.ts                # i18next config
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   ├── MessageBubble.tsx
│   │   ├── TypingIndicator.tsx
│   │   ├── QuickActions.tsx
│   │   ├── MenuItem.tsx
│   │   ├── CartItem.tsx
│   │   └── ...
│   ├── contexts/
│   │   ├── SupabaseContext.tsx
│   │   ├── ChatContext.tsx
│   │   ├── CartContext.tsx
│   │   ├── OrderContext.tsx
│   │   └── ...
│   ├── views/
│   │   ├── OnboardingView.tsx
│   │   ├── ChatView.tsx
│   │   ├── MenuView.tsx
│   │   ├── CartView.tsx
│   │   ├── PaymentView.tsx
│   │   ├── OrderStatusView.tsx
│   │   └── FeedbackView.tsx
│   ├── hooks/
│   │   ├── useOnlineStatus.ts
│   │   ├── useInstallPrompt.ts
│   │   ├── useNotifications.ts
│   │   └── ...
│   ├── lib/
│   │   ├── utils.ts
│   │   └── supabase.ts
│   └── locales/
│       ├── en.json
│       ├── fr.json
│       ├── es.json
│       ├── pt.json
│       └── de.json
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## 🛠️ Technology Stack

- **Framework:** React 18
- **Build Tool:** Vite 5
- **Language:** TypeScript 5.3
- **Styling:** Tailwind CSS 3.4
- **UI Components:** shadcn/ui (Radix UI)
- **State Management:** Zustand + React Query
- **Routing:** React Router 6
- **i18n:** react-i18next
- **PWA:** vite-plugin-pwa (Workbox)
- **Backend:** Supabase (Auth, Database, Edge Functions)
- **AI:** OpenAI GPT-4 (via edge function)

---

## 📋 Implementation Checklist

### Core Infrastructure
- [ ] `src/main.tsx` - Entry point with service worker
- [ ] `src/App.tsx` - Main app with routing
- [ ] `src/index.css` - Tailwind setup
- [ ] `src/contexts/SupabaseContext.tsx` - Supabase client
- [ ] `src/contexts/ChatContext.tsx` - Chat state
- [ ] `src/contexts/CartContext.tsx` - Cart management

### Chat Feature (MVP)
- [ ] `src/views/ChatView.tsx` - Main chat interface
- [ ] `src/components/MessageBubble.tsx` - Chat messages
- [ ] `src/components/TypingIndicator.tsx` - AI typing animation
- [ ] `src/components/QuickActions.tsx` - Quick reply buttons

### Menu & Cart
- [ ] `src/views/MenuView.tsx` - Browse menu
- [ ] `src/views/CartView.tsx` - Shopping cart
- [ ] `src/components/MenuItem.tsx` - Menu item card
- [ ] `src/components/CartItem.tsx` - Cart line item

### Payment & Orders
- [ ] `src/views/PaymentView.tsx` - Payment methods
- [ ] `src/views/OrderStatusView.tsx` - Order tracking
- [ ] `src/components/PaymentMethodSelector.tsx`

### PWA Features
- [ ] `src/i18n.ts` - Multi-language setup
- [ ] `src/locales/*.json` - Translation files (5 languages)
- [ ] `src/hooks/useOnlineStatus.ts` - Network detection
- [ ] `src/hooks/useInstallPrompt.ts` - PWA install prompt
- [ ] `public/manifest.json` - PWA manifest (auto-generated by Vite PWA)

### UI Components (shadcn/ui)
- [ ] Button
- [ ] Input
- [ ] Select
- [ ] Textarea
- [ ] Dialog
- [ ] Tabs
- [ ] Badge
- [ ] Card
- [ ] Toast
- [ ] Label
- [ ] Radio Group

---

## 🎨 Design Guidelines

### Color Palette
- Primary: `#10b981` (Emerald Green)
- Background: `#ffffff` (White)
- Surface: `#f9fafb` (Gray 50)
- Text: `#111827` (Gray 900)
- Secondary: `#6b7280` (Gray 500)

### Typography
- Font Family: System fonts (`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`)
- Sizes: xs (12px), sm (14px), md (16px), lg (18px), xl (20px)

### Layout
- Mobile-first design
- Max content width: 480px
- Padding: 16px (1rem)
- Border radius: 8px (0.5rem)

---

## 🧪 Testing

### Unit Tests
```bash
pnpm test
```

### E2E Tests
```bash
# Install Playwright
pnpm dlx playwright install
pnpm test:e2e
```

### Manual Testing
1. Test offline mode (Chrome DevTools → Network → Offline)
2. Test on real mobile devices
3. Test PWA installation
4. Test multi-language switching
5. Test all AI tools (menu search, cart, wine, reservations)

---

## 📦 Deployment

### Option 1: Vercel (Recommended)
```bash
pnpm build
vercel --prod
```

### Option 2: Netlify
```bash
pnpm build
netlify deploy --prod --dir=dist
```

### Option 3: Cloudflare Pages
```bash
pnpm build
npx wrangler pages deploy dist
```

---

## 🔗 Resources

### Backend
- Edge Function: https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/waiter-ai-agent
- Database Schema: `/supabase/migrations/20260413000000_waiter_ai_complete_schema.sql`
- Supabase Dashboard: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt

### Documentation
- Implementation Status: `/WAITER_AI_IMPLEMENTATION_STATUS.md`
- Complete Summary: `/WAITER_AI_PWA_COMPLETE_SUMMARY.md`
- GitHub Repo: https://github.com/ikanisa/easymo-

### Libraries
- React: https://react.dev
- Vite: https://vitejs.dev
- Tailwind CSS: https://tailwindcss.com
- shadcn/ui: https://ui.shadcn.com
- React Query: https://tanstack.com/query/latest
- Supabase: https://supabase.com/docs

---

## 🐛 Troubleshooting

### Build Errors
```bash
# Clear cache and reinstall
rm -rf node_modules .next dist
pnpm install --frozen-lockfile

# Build shared packages first
cd ../packages/shared && pnpm build
cd ../packages/commons && pnpm build
cd ../../waiter-pwa
```

### Type Errors
```bash
# Regenerate types from Supabase
supabase gen types typescript --project-id lhbowpbcpwoiparwnwgt > src/types/supabase.ts
```

### Service Worker Issues
```bash
# Clear service worker cache
# Chrome DevTools → Application → Service Workers → Unregister
# Then refresh
```

---

## 📝 License

Part of the EasyMO monorepo. See root LICENSE file.

---

**Last Updated:** 2025-11-13
**Status:** Ready for implementation
**Backend:** ✅ Complete
**Frontend:** ⚠️ Pending
