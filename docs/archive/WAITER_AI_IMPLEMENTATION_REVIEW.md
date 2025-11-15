# Waiter AI PWA - Implementation Gap Analysis

## Executive Summary

**Date**: November 13, 2025 **Current Status**: Strong agent infrastructure exists, but Waiter AI
PWA-specific features missing **Priority**: HIGH - Complete PWA, payment integration, and
restaurant-specific features

---

## ✅ What's Already Implemented

### Agent Infrastructure (SOLID FOUNDATION)

- ✅ Agent registry system (`agent_registry` table)
- ✅ Agent runner Edge Function
- ✅ Agent chat infrastructure (`agent_chat_sessions`, `agent_chat_messages`)
- ✅ Agent tools catalog (`agent_tool_catalog`, `agent_tools`)
- ✅ OpenAI integration (via wa-webhook shared modules)
- ✅ Agent sessions and runs tracking
- ✅ Agent metrics and tracing
- ✅ Document embedding system for knowledge base
- ✅ Multiple specialized agents (property, quincaillerie, shops, schedule-trip)

### Database Schema (COMPREHENSIVE)

- ✅ service_categories table (6 categories)
- ✅ business table (889 businesses mapped)
- ✅ conversations table
- ✅ agent_conversations, agent_chat_sessions
- ✅ Auth system (Supabase Auth with anonymous support)
- ✅ RLS policies in place

### Backend Functions (PARTIAL)

- ✅ wa-webhook (WhatsApp integration with AI)
- ✅ agent-runner (orchestration)
- ✅ agent-chat (chat endpoint)
- ✅ business-lookup (search functionality)
- ✅ Admin APIs (users, stats, messages, health, settings, trips)

---

## ❌ What's Missing for Waiter AI PWA

### 1. PWA Frontend (CRITICAL - 0% Complete)

**Status**: NOT IMPLEMENTED

**Missing Components**:

- [ ] React/Next.js PWA application
- [ ] Web App Manifest (manifest.json)
- [ ] Service Worker for offline support
- [ ] PWA UI components (chat interface, menu browser, cart)
- [ ] Multilingual support (i18n: EN, FR, ES, PT, DE)
- [ ] Offline-first caching strategy
- [ ] Push notifications setup
- [ ] Install prompt (Add to Home Screen)
- [ ] Mobile-first responsive design
- [ ] Real-time WebSocket integration

**Required Files**:

```
waiter-pwa/
├── public/
│   ├── manifest.json
│   ├── sw.js (Service Worker)
│   └── icons/ (PWA icons)
├── src/
│   ├── components/
│   │   ├── Chat/
│   │   ├── Menu/
│   │   ├── Cart/
│   │   └── Checkout/
│   ├── hooks/
│   │   ├── useServiceWorker.ts
│   │   ├── useRealtime.ts
│   │   └── useOffline.ts
│   ├── i18n/
│   │   ├── en.json
│   │   ├── fr.json
│   │   ├── es.json
│   │   ├── pt.json
│   │   └── de.json
│   └── lib/
│       ├── supabase.ts
│       └── agent-client.ts
├── next.config.js (with PWA plugin)
└── package.json
```

### 2. Restaurant-Specific Tables (CRITICAL - 30% Complete)

**Status**: PARTIALLY IMPLEMENTED

**Missing Tables**:

- [ ] `restaurants` - Restaurant info (name, location, settings)
- [ ] `tables` - Table numbers and QR codes
- [ ] `menu_categories` - Menu organization
- [ ] `menu_items` - Full menu with prices, images, allergens
- [ ] `orders` - Customer orders
- [ ] `order_items` - Line items in orders
- [ ] `payments` - Payment transactions
- [ ] `reservations` - Table bookings (book_table tool)
- [ ] `wine_pairings` - Wine recommendations data

**Existing (Can Reuse)**:

- ✅ business table (can adapt for restaurants)
- ✅ service_categories (can extend for menu categories)

### 3. Payment Integration (CRITICAL - 0% Complete)

**Status**: NOT IMPLEMENTED

**Missing Edge Functions**:

- [ ] `momo-charge` - MTN Mobile Money payment initiation
- [ ] `momo-webhook` - MoMo payment confirmation
- [ ] `revolut-charge` - Card/Revolut payment
- [ ] `revolut-webhook` - Revolut payment confirmation

**Missing Configuration**:

- [ ] MTN MoMo API credentials (sandbox/production)
- [ ] Revolut Merchant API keys
- [ ] Webhook URLs setup
- [ ] Payment status polling/realtime updates

**Required Implementation**:

```typescript
// supabase/functions/momo-charge/index.ts
// supabase/functions/momo-webhook/index.ts
// supabase/functions/revolut-charge/index.ts
// supabase/functions/revolut-webhook/index.ts
```

### 4. Waiter AI Agent Tools (MEDIUM - 20% Complete)

**Status**: BASIC STRUCTURE EXISTS, TOOLS MISSING

**Missing Tools**:

- [ ] `search_menu` - Query menu items (allergens, vegan, etc.)
- [ ] `add_to_cart` - Add items to order
- [ ] `send_order` - Finalize order for payment
- [ ] `recommend_wine` - Wine pairing suggestions
- [ ] `book_table` - Table reservation
- [ ] `momo_charge` - Trigger mobile money payment
- [ ] `revolut_charge` - Trigger card payment
- [ ] `sora_generate_video` - AI video generation (optional)

**Existing (Can Reuse)**:

- ✅ `search_supabase` - Generic DB search (can adapt)
- ✅ Agent orchestration framework

**Required Implementation**:

```typescript
// supabase/functions/_shared/waiter-tools.ts
export const waiterTools = {
  search_menu,
  add_to_cart,
  send_order,
  recommend_wine,
  book_table,
  momo_charge,
  revolut_charge,
};
```

### 5. Real-Time Features (MEDIUM - 40% Complete)

**Status**: INFRASTRUCTURE EXISTS, INTEGRATION NEEDED

**Missing Integration**:

- [ ] Order status updates (WebSocket subscription)
- [ ] Payment status polling
- [ ] Streaming AI responses (token-by-token)
- [ ] Cart synchronization
- [ ] Push notification triggers

**Existing**:

- ✅ Supabase Realtime infrastructure
- ✅ WebSocket support in wa-webhook

### 6. Multilingual Agent (HIGH - 0% Complete)

**Status**: NOT IMPLEMENTED

**Missing**:

- [ ] Language detection in conversation
- [ ] Dynamic system prompt with language
- [ ] Translation layer for agent responses
- [ ] UI language switcher integration
- [ ] Menu/content translations

**Required**:

- Language parameter in agent-chat function
- System prompt templates per language
- Translation files for static content

### 7. QR Code & Venue Context (HIGH - 0% Complete)

**Status**: NOT IMPLEMENTED

**Missing**:

- [ ] QR code generation for tables
- [ ] URL parameter parsing (restaurant_id, table_number)
- [ ] Venue-specific agent initialization
- [ ] Context injection (restaurant menu, location)

**Required**:

```typescript
// Parse QR: waiterai.app/?r=uuid&t=12
// Initialize agent with restaurant context
```

### 8. Offline Support (HIGH - 0% Complete)

**Status**: NOT IMPLEMENTED

**Missing**:

- [ ] Service Worker caching strategies
- [ ] Offline menu caching
- [ ] IndexedDB for pending orders
- [ ] Background Sync for queued actions
- [ ] Custom offline fallback page

---

## 📊 Implementation Priority Matrix

### Phase 1: MVP (Week 1-2) - CRITICAL

1. **PWA Frontend Shell** (3-4 days)
   - React app with Manifest + Service Worker
   - Basic chat UI
   - Menu browser
   - Cart functionality

2. **Restaurant Schema** (1-2 days)
   - Create restaurant, menu tables
   - Seed sample data
   - Orders & order_items tables

3. **Waiter Agent Tools** (2-3 days)
   - Implement search_menu
   - Implement add_to_cart
   - Implement send_order
   - Wire to agent-runner

4. **Basic Payment Flow** (2 days)
   - Mock payment for testing
   - Order status flow
   - Payment UI (placeholder)

### Phase 2: Payment Integration (Week 3)

1. **MoMo Integration** (2-3 days)
   - momo-charge function
   - momo-webhook function
   - Payment status realtime

2. **Revolut Integration** (2 days)
   - revolut-charge function
   - Card payment UI

3. **Testing & Sandbox** (1-2 days)
   - End-to-end payment testing
   - Error handling
   - Webhook verification

### Phase 3: PWA Features (Week 4)

1. **Multilingual** (2 days)
   - i18n setup (5 languages)
   - Agent language switching
   - Content translations

2. **Offline Support** (2 days)
   - Service Worker caching
   - Offline menu
   - Queue pending actions

3. **QR & Context** (1 day)
   - QR generation
   - Venue context parsing

4. **Polish & Optimization** (2 days)
   - Performance tuning
   - Lighthouse compliance
   - Push notifications

---

## 🛠️ Technical Gaps

### Missing Dependencies

```json
{
  "frontend": [
    "next-pwa",
    "react-i18next",
    "workbox-*",
    "@supabase/ssr",
    "idb" // IndexedDB
  ],
  "backend": [
    "axios", // For MTN/Revolut APIs
    "crypto" // For webhook verification
  ]
}
```

### Missing Environment Variables

```env
# MTN MoMo
MTN_MOMO_API_KEY=
MTN_MOMO_USER_ID=
MTN_MOMO_SUBSCRIPTION_KEY=
MTN_MOMO_CALLBACK_URL=

# Revolut
REVOLUT_API_KEY=
REVOLUT_MERCHANT_ID=
REVOLUT_WEBHOOK_SECRET=

# Sora (optional)
SORA_API_KEY=
SORA_API_URL=

# PWA
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

### Missing Configuration Files

```
- waiter-pwa/next.config.js (with PWA plugin)
- waiter-pwa/public/manifest.json
- waiter-pwa/public/sw.js
- config/waiter-agent-config.yaml
- config/menu-schema.json
```

---

## 🎯 Recommended Implementation Approach

### Strategy: Additive Implementation

1. **Don't touch**: Existing agent infrastructure, wa-webhook, admin panel
2. **Add new**: PWA app (separate directory), waiter-specific tools, payment functions
3. **Extend**: Database schema with restaurant tables
4. **Integrate**: Connect PWA → agent-runner → tools → DB

### Directory Structure

```
easymo-/
├── waiter-pwa/              # NEW - PWA frontend
│   ├── src/
│   ├── public/
│   └── package.json
├── supabase/
│   ├── functions/
│   │   ├── momo-charge/     # NEW
│   │   ├── momo-webhook/    # NEW
│   │   ├── revolut-charge/  # NEW
│   │   ├── revolut-webhook/ # NEW
│   │   └── _shared/
│   │       └── waiter-tools.ts  # NEW
│   └── migrations/
│       └── YYYYMMDD_waiter_restaurant_schema.sql  # NEW
└── docs/
    └── WAITER_AI_GUIDE.md   # NEW
```

---

## 🚀 Quick Start Commands

### Create PWA

```bash
cd /Users/jeanbosco/workspace/easymo-
npx create-next-app@latest waiter-pwa --typescript --tailwind --app
cd waiter-pwa
npm install @supabase/ssr next-pwa workbox-webpack-plugin react-i18next
```

### Create Payment Functions

```bash
cd supabase/functions
supabase functions new momo-charge
supabase functions new momo-webhook
supabase functions new revolut-charge
supabase functions new revolut-webhook
```

### Deploy

```bash
# Deploy payment functions
supabase functions deploy momo-charge
supabase functions deploy momo-webhook

# Deploy PWA (to Vercel)
cd waiter-pwa
vercel --prod
```

---

## 📈 Success Metrics

### Technical KPIs

- [ ] Lighthouse PWA score: 100/100
- [ ] Offline functionality: Works without network
- [ ] Install rate: >20% of users
- [ ] Payment success rate: >95%
- [ ] Agent response time: <2s
- [ ] Cart-to-order conversion: >60%

### Feature Completeness

- [ ] 5 languages supported
- [ ] 2 payment methods (MoMo + Card)
- [ ] Menu browsing offline
- [ ] Real-time order status
- [ ] Push notifications working
- [ ] QR code scanning functional

---

## 🔴 Blocking Issues

### Critical Blockers (Must Resolve Before Launch)

1. **No PWA Frontend** - Blocks all user-facing features
2. **No Payment Integration** - Blocks monetization
3. **No Restaurant Schema** - Blocks menu/ordering

### High Priority

4. **No Waiter Tools** - Blocks agent functionality
5. **No Multilingual** - Blocks international usage
6. **No QR System** - Blocks in-restaurant deployment

---

## ✅ Next Steps

### Immediate Actions (Today)

1. Create PWA frontend skeleton
2. Define restaurant database schema
3. Implement core waiter tools (search_menu, add_to_cart)

### This Week

4. Build chat UI and menu browser
5. Wire agent tools to agent-runner
6. Create mock payment flow

### Next Week

7. Integrate MoMo payment
8. Integrate Revolut payment
9. Add multilingual support

---

**Status**: 📊 **~15% Complete** **Estimated Time to MVP**: 🕐 **2-3 weeks** (with focused effort)
**Recommendation**: 🚀 **Start with Phase 1 MVP immediately**
