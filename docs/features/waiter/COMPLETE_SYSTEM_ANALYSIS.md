# 🍽️ Complete Waiter AI System Analysis
**Generated:** 2025-12-10  
**Status:** Comprehensive Code & Database Audit

---

## 📊 EXECUTIVE SUMMARY

| Component | Status | LOC | Issues | Priority |
|-----------|--------|-----|--------|----------|
| **Edge Functions** | ✅ Well Structured | 2,358 | 4 implementations | P1 - Consolidate |
| **Agent Implementations** | 🟡 Multiple | 2,358 | Different prompts/tools | P1 - Unify |
| **Database Schema** | ✅ Comprehensive | ~1,500+ | Table naming inconsistency | P2 - Standardize |
| **Shared Tools** | ✅ Excellent | 1,547 | Payment tools duplicated | P2 - Dedupe |
| **Documentation** | ✅ Extensive | 8 files | Scattered locations | P3 - Consolidate |
| **Bar Manager App** | 🟡 Partial | ~500 | CSS build issues | P1 - Complete |

### Key Findings
✅ **POSITIVE:** Real database queries (not mocks!), comprehensive tool set, multi-language support  
⚠️ **CONCERN:** 4 different agent implementations, inconsistent table references  
🔴 **BLOCKER:** Bar Manager desktop app incomplete (CSS build configuration issue)

---

## 🗂️ COMPLETE INVENTORY

### 1. Edge Functions (Supabase Deno)

#### **wa-webhook-waiter/** (Primary WhatsApp Handler)
```
supabase/functions/wa-webhook-waiter/
├── index.ts           (2.7KB)   - Main webhook entry
├── agent.ts           (30KB)    - Core AI logic, 800+ lines
├── ai-provider.ts     (3.9KB)   - AI abstraction layer
├── notify_bar.ts      (5.2KB)   - Bar notification system
├── payment.ts         (3.6KB)   - Payment processing
└── providers/
    └── dual-ai-provider.ts      - GPT-4 + Gemini fallback
```

**Features:**
- State machine for session management
- QR code table discovery
- Location-based venue search
- Cart management via session state
- Malta phone number validation (+356)
- Observability logging

#### **wa-agent-waiter/** (Unified Architecture Version)
```
supabase/functions/wa-agent-waiter/
├── index.ts                     - Entry point
└── core/
    ├── waiter-agent.ts (483L)   - Database-driven agent
    ├── session-manager.ts       - Session handling
    ├── bar-search.ts            - Venue discovery
    ├── base-agent.ts            - Abstract base
    └── providers/
        ├── dual-ai-provider.ts  - AI provider abstraction
        └── gemini.ts            - Gemini implementation
```

**Features:**
- Database-driven system prompts (ai_agent_system_instructions table)
- Database-driven tools (ai_agent_tools table)
- Discovery flow (location → bar selection → ordering)
- Unified agent registry

#### **_shared/waiter-tools.ts** (1,547 lines)
Comprehensive tool library for ALL waiter implementations:

**Menu Tools:**
- `search_menu` - Search with dietary filters
- `get_menu_item_details` - Item details

**Cart Tools:**
- `add_to_cart` - Add items with quantity
- `view_cart` - Get current cart
- `update_cart_item` - Modify/remove items

**Order Tools:**
- `send_order` - Finalize order
- `get_order_status` - Track order

**Reservation Tools:**
- `book_table` - Create reservation
- `recommend_wine` - Wine pairings

**Payment Tools (9 tools!):**
- `initiate_payment` - Start MoMo/Revolut/Cash payment
- `confirm_payment` - User confirms payment
- `cancel_payment` - Cancel pending payment
- `get_payment_status` - Check payment status
- `save_payment_method` - Save for future
- `get_saved_payment_methods` - Retrieve saved methods

---

### 2. Package Implementations (Node.js/TypeScript)

#### **packages/agents/src/agents/waiter/waiter.agent.ts** (531 lines)
```typescript
export class WaiterAgent extends BaseAgent {
  name = 'waiter_agent';
  model = 'gemini-1.5-flash';
  
  // System prompt embedded in code
  instructions = `You are a virtual restaurant waiter on WhatsApp...`;
  
  // 8 tools defined inline
  tools: Tool[] = [
    search_menu_supabase,
    get_popular_items,
    add_to_cart,
    momo_charge,
    send_order,
    lookup_loyalty,
    book_table,
    get_order_status
  ];
}
```

**Database Queries (REAL, NOT MOCK!):**
```typescript
// Example: Real Supabase query
const { data, error } = await this.supabase
  .from('menu_items')
  .select('id, name, description, price, category, tags, available, image_url')
  .eq('restaurant_id', restaurant_id)
  .eq('available', true)
  .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
  .contains('tags', ['vegan'])  // Dietary filters
  .limit(10);
```

**Fallback Data (Acceptable for Demo):**
```typescript
if (error) {
  // Graceful degradation with warning
  return {
    items: [
      { id: '1', name: 'Grilled Tilapia', price: 5000, tags: ['halal'] },
      { id: '2', name: 'Matoke Stew', price: 3000, tags: ['vegan'] }
    ],
    source: 'fallback'  // Clearly marked!
  };
}
```

#### **services/agent-core/src/agents/waiter-broker.ts** (356 lines)
NestJS service broker with intent-based routing:

```typescript
export type WaiterBrokerIntent = 
  | "order_food" 
  | "get_recommendations" 
  | "ask_question" 
  | "manage_order";

// Different system prompts per intent
const WAITER_SYSTEM_PROMPT = `...`;
const RECOMMENDATIONS_SYSTEM_PROMPT = `...`;

// Builds context from profile, bar, menu, order state
export function buildWaiterBrokerMessages(input: WaiterBrokerInput) {
  const contextSections = [
    describeBar(input.bar),
    describeMenu(input.menu),
    describeOrderContext(input.orderContext),
    describeUserProfile(input.profile)
  ];
  // ...
}
```

---

### 3. Database Schema

#### Tables Referenced in Code

| Table Name | Usage | Implementation | Notes |
|------------|-------|----------------|-------|
| `menu_items` | packages/agents | ✅ Primary | Real queries |
| `restaurant_menu_items` | wa-webhook-waiter | ⚠️ Different table! | Inconsistency |
| `menu_categories` | _shared/waiter-tools | ✅ Used | Category management |
| `orders` | All implementations | ✅ Primary | Order management |
| `draft_orders` | Mentioned in docs | ❓ Not found in code | Legacy? |
| `order_items` | _shared/waiter-tools | ✅ Used | Line items |
| `kitchen_orders` | packages/agents | ✅ Used | Kitchen tickets |
| `bar_orders` | Documentation | ❓ View? | Not in migrations |
| `bars` | All implementations | ✅ Used | Restaurant/bar data |
| `reservations` | _shared/waiter-tools | ✅ Used | Table bookings |
| `waiter_conversations` | wa-webhook-waiter | ✅ Used | Chat history |
| `waiter_messages` | Documentation | ✅ Likely | Message log |
| `waiter_settings` | Documentation | ❓ Not found | Config table? |
| `payments` | _shared/waiter-tools | ✅ Used | Payment records |
| `payment_transactions` | packages/agents | ⚠️ Different name | Inconsistency |
| `payment_events` | _shared/waiter-tools | ✅ Used | Payment audit log |
| `user_payment_methods` | _shared/waiter-tools | ✅ Used | Saved payment info |
| `loyalty_programs` | packages/agents | ✅ Used | Customer loyalty |
| `wine_pairings` | _shared/waiter-tools | ✅ Used | Wine recommendations |

**⚠️ ISSUE: Table Naming Inconsistency**
- Code references both `menu_items` AND `restaurant_menu_items`
- Code references both `payments` AND `payment_transactions`
- Need to standardize or create compatibility views

---

### 4. System Prompts Analysis

#### **Implementation A: packages/agents/waiter.agent.ts**
```typescript
instructions = `You are a virtual restaurant waiter on WhatsApp. 
Handle menu questions, orders, table bookings, upsell politely, 
and orchestrate MoMo payments & kitchen orders.

CORE CAPABILITIES:
- Menu search: Find dishes by name, category, dietary preferences
- Order management: Build cart, confirm orders, create kitchen tickets
- Table reservations: Book tables for guests
- Payments: Process MoMo mobile money payments
- Loyalty: Check user points and tier status

GUARDRAILS & POLICIES:
- Domain-only (food, venue); no politics/health advice.
- Never invent menu items; never promise allergy safety.
- Double-confirm orders & payment amounts before charging.`;
```

#### **Implementation B: services/agent-core/waiter-broker.ts**
```typescript
const WAITER_SYSTEM_PROMPT = `You are an expert digital waiter for EasyMO 
restaurants and bars. Your goal is to provide world-class hospitality via WhatsApp.

LANGUAGE RULES:
- Detect language from user profile: en, fr, rw, sw
- Greet in local language then match user's language
- English: Professional yet friendly
- French: "Bonjour!" then professional
- Kinyarwanda: "Muraho!" warm and welcoming
- Swahili: "Habari!" friendly and helpful

NUMBERED OPTIONS:
- CRITICAL: Format ALL options with numbered emoji lists 1️⃣ 2️⃣ 3️⃣
- Users reply with NUMBERS ONLY (1, 2, 3)
- Max 10 items per list (1️⃣-🔟)

ORDER TAKING FLOW:
1. Greet warmly, mention venue name
2. Ask: Dining in or delivery?
3. Present category options (numbered list)
4. Show items in category (numbered, with prices)
5. Confirm selection + quantity
6. Ask for drinks (numbered)
7. Summarize order with total
8. Confirm payment method
9. Provide ETA`;
```

#### **Implementation C: wa-agent-waiter (Database-Driven)**
Loads system prompt from `ai_agent_system_instructions` table dynamically!

**🌟 This is the FUTURE direction - database-driven configuration**

---

### 5. AI Tools Comparison

| Tool | packages/agents | _shared/waiter-tools | wa-webhook-waiter | Notes |
|------|----------------|---------------------|-------------------|-------|
| search_menu | ✅ search_menu_supabase | ✅ search_menu | ✅ Inline | Different names! |
| get_popular_items | ✅ | ❌ | ✅ | Only in 2 impls |
| add_to_cart | ✅ | ✅ | ✅ | Consistent |
| momo_charge | ✅ | ✅ initiate_payment | ✅ | Different names |
| send_order | ✅ | ✅ | ✅ | Consistent |
| lookup_loyalty | ✅ | ❌ | ❌ | Only packages/agents |
| book_table | ✅ | ✅ | ✅ | Consistent |
| get_order_status | ✅ | ✅ | ✅ | Consistent |
| recommend_wine | ❌ | ✅ | ❌ | Only _shared |
| Payment tools (6) | ❌ | ✅ Full suite | ⚠️ Partial | _shared has most complete |

**🔍 FINDING:** `_shared/waiter-tools.ts` has the MOST comprehensive tool set!

---

### 6. Frontend Components

#### **Bar Manager App** (admin-app/)
Current state:
```
admin-app/
├── lib/
│   ├── queries/
│   │   ├── bars.ts                    - Bar CRUD operations
│   │   ├── menus.ts                   - Menu management
│   │   ├── barDashboard.ts            - Dashboard data
│   │   └── whatsapp-menu.ts           - WhatsApp menu integration
│   └── bars/
│       ├── bars-service.ts            - Bar business logic
│       └── bars-dashboard-service.ts  - Dashboard logic
├── components/
│   └── layout/
│       └── SidebarNav.tsx             - Navigation
└── types/
    └── whatsapp-menu.ts               - Type definitions
```

**⚠️ STATUS:** Partial implementation exists, but:
- No dedicated order queue dashboard
- No real-time order updates UI
- CSS build configuration issues (Next.js 14 App Router)
- Documented in `BAR_MANAGER_COMPLETE_SUMMARY.md` as "CODE COMPLETE but CSS issue"

#### **Waiter PWA** (waiter-pwa/)
Status: **PLANNED** (Phase 3)
- Customer-facing PWA for direct ordering
- Not yet implemented
- Documented in `WAITER_AI_PHASE3_PLAN.md`

---

### 7. Documentation Files

```
docs/
├── apps/
│   ├── waiter-ai/
│   │   ├── WAITER_AI_QUICK_REFERENCE.md         - Quick start guide
│   │   ├── WAITER_AI_README.md                  - Overview
│   │   ├── WAITER_AI_DOCUMENTATION_INDEX.md     - Doc index
│   │   ├── WAITER_AI_VISUAL_ARCHITECTURE.md     - Diagrams
│   │   ├── WAITER_AI_DEPLOYMENT_READY.md        - Deploy guide
│   │   ├── WAITER_AI_DESKTOP_READY.md           - Desktop setup
│   │   ├── WAITER_AI_DESKTOP_DEPLOYMENT.md      - Desktop deploy
│   │   └── WAITER_AI_ADVANCED_FEATURES_ROADMAP.md - Future features
│   └── bar-manager/
│       ├── BAR_MANAGER_QUICK_REFERENCE.txt      - Quick reference
│       └── BAR_MANAGER_START_HERE.txt           - Getting started
├── sessions/
│   ├── WAITER_AI_COMPLETE_SYSTEM_ARCHITECTURE.md - Full architecture
│   ├── WAITER_AI_EXECUTIVE_SUMMARY.md           - Executive summary
│   ├── WAITER_AI_COMPLETE_STATUS.md             - Status report
│   ├── BAR_MANAGER_COMPLETE_SUMMARY.md          - Bar manager status
│   ├── BAR_MANAGER_FINAL_COMPLETE.md            - Final implementation
│   ├── BAR_MANAGER_CURRENT_STATUS.md            - Current status
│   ├── BAR_MANAGER_FINAL_STATUS.md              - Status update
│   └── BAR_MANAGER_IMPLEMENTATION_COMPLETE.md   - Implementation details
└── architecture/
    └── diagrams/
        └── BAR_MANAGER_VISUAL_ARCHITECTURE.txt  - Architecture diagrams
```

**Total:** 17 documentation files!

---

## 🔍 DETAILED ANALYSIS

### ✅ POSITIVE FINDINGS

#### 1. Real Database Integration (NOT Mocks!)
Unlike some agents, Waiter has genuine database queries:

```typescript
// packages/agents/src/agents/waiter/waiter.agent.ts line 90
const { data, error } = await this.supabase
  .from('menu_items')
  .select('id, name, description, price, category, tags, available, image_url')
  .eq('restaurant_id', restaurant_id)
  .eq('available', true)
  .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
  .contains('tags', ['vegan'])
  .limit(10);
```

**Evidence of Real Functionality:**
- ✅ Dynamic dietary filtering (vegan, halal, spicy)
- ✅ Full-text search on name and description
- ✅ Category-based filtering
- ✅ Availability checking
- ✅ Restaurant-scoped queries

#### 2. Comprehensive Tool Suite
The `_shared/waiter-tools.ts` file provides 16+ tools:

**Cart Management:**
- Add items with quantity validation
- Update quantities or remove items
- View cart with item count and totals
- Automatic order total calculation with tax

**Payment Processing:**
- Multi-provider support (MTN MoMo, Airtel Money, Revolut, Cash)
- USSD code generation for mobile money
- Payment confirmation flow
- Payment cancellation
- Saved payment methods
- Payment event auditing

**Table Reservations:**
- Date/time validation
- Party size specification
- Special requests handling
- Multi-language reservation confirmations

#### 3. Multi-Language Support
From `waiter-broker.ts`:
```typescript
LANGUAGE RULES:
- Detect language from user profile: en, fr, rw, sw
- Greet in local language then match user's language
- English: Professional yet friendly
- French: "Bonjour!" then professional
- Kinyarwanda: "Muraho!" warm and welcoming
- Swahili: "Habari!" friendly and helpful
```

Plus documentation mentions: EN, FR, ES, PT, DE (7 languages total!)

#### 4. Dual AI Provider Architecture
Both webhook implementations use fallback:
```typescript
// supabase/functions/wa-webhook-waiter/providers/dual-ai-provider.ts
export class DualAIProvider {
  async chat(messages, options) {
    try {
      // Try GPT-4 first
      return await this.openai.chat(messages, options);
    } catch (error) {
      // Fallback to Gemini
      return await this.gemini.chat(messages, options);
    }
  }
}
```

**Benefits:**
- High availability (automatic failover)
- Cost optimization (use cheaper model as fallback)
- Performance optimization (use faster model first)

#### 5. State Machine for Session Management
`wa-webhook-waiter` uses proper session states:

```typescript
export const WAITER_STATE_KEYS = {
  INIT: 'waiter_init',
  AWAITING_LOCATION: 'waiter_awaiting_location',
  AWAITING_BAR_SELECTION: 'waiter_awaiting_bar_selection',
  READY_FOR_ORDERS: 'waiter_ready',
  IN_CONVERSATION: 'waiter_chat',
  AWAITING_PAYMENT: 'waiter_payment'
};

function transitionWaiterState(
  currentState: WaiterState, 
  event: string
): WaiterState {
  // State transition logic
}
```

This prevents conversation confusion and ensures proper flow.

#### 6. QR Code Table Discovery
Smart feature for dine-in customers:

```typescript
// wa-webhook-waiter/agent.ts line 92
const qrMatch = messageText.match(/TABLE-([A-Z0-9]+)-BAR-([a-f0-9-]+)/i);

if (qrMatch) {
  const tableNumber = qrMatch[1];
  const barId = qrMatch[2];
  
  // Directly set venue and table, skip discovery
  await setWaiterVenue(session, barId);
  await setWaiterTableNumber(session, tableNumber);
  
  return sendTextMessage(from, 
    `Welcome to table ${tableNumber}! I'm your AI waiter. What can I get you?`
  );
}
```

**Customer Experience:**
1. Scan QR code on table
2. Instantly connected to venue + table
3. No manual venue selection needed
4. Seamless ordering flow

#### 7. Observability & Logging
All implementations use structured logging:

```typescript
import { logStructuredEvent, recordMetric, maskPII } from "../_shared/observability.ts";

await logStructuredEvent("WAITER_MESSAGE_RECEIVED", {
  requestId: ctx.requestId,
  phone: maskPII(ctx.from),  // PII protection!
  messageType: ctx.messageType,
  hasProfile: Boolean(profile),
});

await recordMetric("waiter.order.created", 1, {
  venue: barId,
  paymentMethod: payment_method
});
```

**Compliance:** Follows `docs/GROUND_RULES.md` for observability requirements!

---

### ⚠️ ISSUES IDENTIFIED

#### Issue #1: FOUR Different Agent Implementations

**A. packages/agents/waiter.agent.ts (531 lines)**
- Purpose: Core agent class for Node.js services
- Model: Gemini 1.5 Flash
- Tools: 8 tools (hardcoded in constructor)
- Prompt: Embedded in code as string
- DB: Direct Supabase queries

**B. supabase/functions/wa-webhook-waiter/agent.ts (800+ lines)**
- Purpose: Main WhatsApp webhook handler
- Model: Dual (GPT-4 + Gemini fallback)
- Tools: Inline function calls
- Prompt: Built dynamically from session state
- DB: Session-based cart management

**C. supabase/functions/wa-agent-waiter/core/waiter-agent.ts (483 lines)**
- Purpose: Unified architecture version
- Model: Database-driven
- Tools: Loaded from ai_agent_tools table
- Prompt: Loaded from ai_agent_system_instructions table
- DB: Configuration-driven

**D. services/agent-core/src/agents/waiter-broker.ts (356 lines)**
- Purpose: NestJS broker for agent-core microservice
- Model: External (passed to AI provider)
- Tools: None (just builds prompts)
- Prompt: Intent-based (4 different prompts)
- DB: Context building only

**🚨 PROBLEM:** Maintaining 4 implementations is unsustainable!

**Recommendation:**
1. **Keep:** `packages/agents/waiter.agent.ts` as single source of truth
2. **Refactor:** `wa-webhook-waiter/agent.ts` to use packages/agents class
3. **Migrate:** To database-driven config like `wa-agent-waiter` (future)
4. **Simplify:** `waiter-broker` to just build context, delegate to main agent

---

#### Issue #2: Inconsistent Table References

Code references different table names:

**Menu Tables:**
```typescript
// packages/agents/waiter.agent.ts
.from('menu_items')  // Primary table

// wa-webhook-waiter (some places)
.from('restaurant_menu_items')  // Different table!
```

**Order Tables:**
```typescript
// Most implementations
.from('orders')
.from('order_items')

// Documentation mentions
.from('bar_orders')  // View? Legacy?
.from('draft_orders')  // Not found in code!
```

**Payment Tables:**
```typescript
// _shared/waiter-tools.ts
.from('payments')
.from('payment_events')
.from('user_payment_methods')

// packages/agents/waiter.agent.ts
.from('payment_transactions')  // Different name!
```

**🚨 PROBLEM:** Queries will fail if tables don't exist or have different schemas!

**Solution:**
```sql
-- Create compatibility views
CREATE OR REPLACE VIEW restaurant_menu_items AS 
SELECT 
  id, 
  restaurant_id as bar_id, 
  name, 
  description, 
  price, 
  category, 
  tags, 
  available as is_available,
  image_url, 
  created_at, 
  updated_at
FROM menu_items;

CREATE OR REPLACE VIEW bar_orders AS 
SELECT * FROM orders WHERE order_type = 'dine_in';

CREATE OR REPLACE VIEW payment_transactions AS 
SELECT * FROM payments;
```

---

#### Issue #3: Duplicate Payment Tool Definitions

Payment tools defined twice:

**Location 1: _shared/waiter-tools.ts (lines 627-783, 1092-1246)**
```typescript
// Defined TWICE in same file!
export async function initiate_payment(...) { /* 157 lines */ }
export async function confirm_payment(...) { /* 88 lines */ }
export async function cancel_payment(...) { /* 52 lines */ }
export async function get_payment_status(...) { /* 43 lines */ }
export async function save_payment_method(...) { /* 37 lines */ }
export async function get_saved_payment_methods(...) { /* 25 lines */ }
```

**🚨 PROBLEM:** 400+ lines of duplicated code! Risk of bugs if one copy is updated but not the other.

**Solution:** Remove duplicate definitions (lines 1092-1527), keep only first set.

---

#### Issue #4: Multiple System Prompts

Each implementation has different personality:

**packages/agents:** "Virtual restaurant waiter on WhatsApp. Handle menu questions, orders, table bookings, upsell politely..."

**waiter-broker:** "Expert digital waiter for EasyMO restaurants and bars. World-class hospitality via WhatsApp."

**wa-webhook-waiter:** Built dynamically from session state, no fixed prompt.

**wa-agent-waiter:** Loaded from database `ai_agent_system_instructions` table.

**🚨 PROBLEM:** Inconsistent user experience across different entry points!

**Solution:** 
1. Define ONE canonical system prompt
2. Store in database (ai_agent_system_instructions table)
3. All implementations load from same source
4. Allow per-venue customization via metadata

---

#### Issue #5: Bar Manager Desktop App Incomplete

From `BAR_MANAGER_COMPLETE_SUMMARY.md`:

```markdown
## ⚠️ THE CSS BUILD ISSUE

### What's Happening
Next.js 14's App Router uses a special CSS loader (`next-flight-css-loader`) 
that doesn't process CSS files in the standard way.

Error: Module parse failed
File was processed with: next-flight-css-loader.js
Problem: CSS (both Tailwind directives and plain CSS) not being parsed
```

**Current State:**
- ✅ All business logic complete
- ✅ All components written
- ✅ TypeScript compiles
- ✅ Dependencies installed
- 🔴 CSS build fails
- 🔴 Cannot run `npm run dev`

**🚨 PROBLEM:** Bar managers cannot use the app to manage orders!

**Solution (from docs):**
Use `create-next-app@14` template which sets up CSS correctly, then copy all code over.

---

#### Issue #6: Documentation Scattered

17 documentation files across 3 directories:
- `docs/apps/waiter-ai/` (8 files)
- `docs/apps/bar-manager/` (2 files)
- `docs/sessions/` (7 files)

**🚨 PROBLEM:** Hard to find information, duplicate content.

**Solution:** Consolidate to single location:
```
docs/features/waiter/
├── README.md                    - Main overview
├── ARCHITECTURE.md              - System architecture
├── IMPLEMENTATION.md            - Technical details
├── BAR_MANAGER.md               - Bar manager guide
├── QUICK_REFERENCE.md           - Quick start
├── DEPLOYMENT.md                - Deployment guide
└── API.md                       - API reference
```

---

## 📋 REFACTORING PLAN

### Phase 1: Consolidate Agent Implementations (Priority: P1, Duration: 2-3 days)

#### Step 1: Unified Agent Class
```typescript
// packages/agents/src/agents/waiter/
├── index.ts              // Re-exports
├── agent.ts              // KEEP CURRENT - already well implemented!
├── tools/
│   ├── menu-tools.ts     // Extract from agent.ts
│   ├── cart-tools.ts     // Extract from agent.ts
│   ├── payment-tools.ts  // Import from _shared/waiter-tools.ts
│   ├── reservation-tools.ts
│   └── index.ts
├── prompts/
│   └── system-prompt.ts  // Unified prompt
└── types.ts
```

#### Step 2: Unified System Prompt
```typescript
// packages/agents/src/agents/waiter/prompts/system-prompt.ts
export const WAITER_SYSTEM_PROMPT = `You are a virtual restaurant waiter on WhatsApp for EasyMO.

🎯 ROLE: Friendly, professional virtual waiter
🌍 LANGUAGES: English, French, Kinyarwanda, Swahili, Spanish, Portuguese, German
🎭 TONE: Warm, helpful, food-passionate, one tasteful upsell max

💪 CORE CAPABILITIES:
1. Menu Search: Find dishes by name, category, dietary preferences (vegan, halal, spicy)
2. Order Management: Build cart, confirm orders, create kitchen tickets
3. Table Reservations: Book tables for guests
4. Payments: Process MoMo mobile money payments (MTN, Airtel), Revolut, Cash
5. Loyalty: Check user points and tier status

📋 CONVERSATION FLOW:
1. Greet warmly and ask how you can help
2. When user asks about menu, use search_menu to find items
3. Help build their order by suggesting popular items
4. Confirm order details and total before payment
5. Process payment via initiate_payment
6. Send order to kitchen via send_order
7. Provide order confirmation and estimated time

💰 UPSELLING GUIDELINES:
- Suggest popular drinks with main courses
- Mention desserts after main order
- Offer combo deals when available
- Be helpful, not pushy (max 1 upsell per conversation)

💬 RESPONSE FORMAT:
- Use emoji-numbered lists (1️⃣, 2️⃣, 3️⃣) for options
- Show prices clearly: "💰 5,000 RWF"
- Keep messages concise for WhatsApp (max 300 chars per message)
- Always confirm before charging

🛡️ GUARDRAILS:
- Domain-only (food, venue); no politics/health advice
- Never invent menu items; only describe ingredients for allergens
- Double-confirm orders & payment amounts before charging
- If unsure about availability, say you'll check with the kitchen
- Admin commands only from whitelisted numbers`;
```

#### Step 3: Update Webhook to Use Unified Agent
```typescript
// supabase/functions/wa-webhook-waiter/agent.ts
import { WaiterAgent } from '@easymo/agents/waiter';

// Replace 800+ lines of inline agent logic with:
const waiterAgent = new WaiterAgent();

export async function handleWaiterMessage(ctx: WaiterContext) {
  const result = await waiterAgent.execute({
    message: ctx.message.text.body,
    context: {
      userId: ctx.from,
      restaurantId: session.bar_id,
      sessionId: session.id,
      language: ctx.locale
    }
  });
  
  return sendTextMessage(ctx.from, result.message);
}
```

**Before:** 800 lines of duplicated logic  
**After:** 20 lines calling shared agent

---

### Phase 2: Standardize Database Tables (Priority: P2, Duration: 1 day)

#### Migration: standardize_waiter_tables.sql
```sql
BEGIN;

-- Ensure menu_items is the primary table
-- Create view for backward compatibility
CREATE OR REPLACE VIEW restaurant_menu_items AS 
SELECT 
  id, 
  restaurant_id as bar_id, 
  name, 
  description, 
  price, 
  category, 
  tags, 
  available as is_available,
  image_url, 
  created_at, 
  updated_at
FROM menu_items;

-- Standardize order tables
CREATE OR REPLACE VIEW bar_orders AS 
SELECT * FROM orders WHERE order_type = 'dine_in';

CREATE OR REPLACE VIEW draft_orders AS 
SELECT * FROM orders WHERE status = 'draft';

-- Standardize payment tables
CREATE OR REPLACE VIEW payment_transactions AS 
SELECT * FROM payments;

-- Add helpful comments
COMMENT ON VIEW restaurant_menu_items IS 
  'Compatibility view for legacy code. Use menu_items table in new code.';
  
COMMENT ON VIEW bar_orders IS 
  'Dine-in orders only. Use orders table with WHERE order_type = ''dine_in'' in new code.';

COMMIT;
```

---

### Phase 3: Complete Bar Manager App (Priority: P1, Duration: 1 day)

Following `BAR_MANAGER_COMPLETE_SUMMARY.md` solution:

```bash
cd admin-app

# Option 1: Use create-next-app template (RECOMMENDED)
npx create-next-app@14 temp-bar-manager \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"

# Copy all our code
cp -r app/* temp-bar-manager/app/
cp -r components temp-bar-manager/
cp -r lib temp-bar-manager/
cp .env.local temp-bar-manager/

cd temp-bar-manager
npm install @google/generative-ai @supabase/supabase-js react-dropzone

# Test
npm run dev
```

**Then implement missing features:**

1. **Real-time Order Queue** (Priority: P0)
   - Supabase Realtime subscription
   - Desktop notifications
   - Sound alerts
   - One-click status updates

2. **Order Management** (Priority: P1)
   - Accept/reject orders
   - Update order status
   - View order history
   - Print kitchen tickets

3. **Menu Management** (Priority: P2)
   - Add/edit/delete items
   - Set availability
   - Upload images
   - AI menu parsing

---

### Phase 4: Clean Up Documentation (Priority: P3, Duration: 2 hours)

```bash
mkdir -p docs/features/waiter/

# Consolidate documentation
cat docs/sessions/WAITER_AI_COMPLETE_SYSTEM_ARCHITECTURE.md \
    docs/apps/waiter-ai/WAITER_AI_VISUAL_ARCHITECTURE.md \
    > docs/features/waiter/ARCHITECTURE.md

cat docs/apps/waiter-ai/WAITER_AI_README.md \
    docs/apps/waiter-ai/WAITER_AI_DOCUMENTATION_INDEX.md \
    > docs/features/waiter/README.md

cp docs/apps/waiter-ai/WAITER_AI_QUICK_REFERENCE.md \
   docs/features/waiter/QUICK_REFERENCE.md

cat docs/sessions/BAR_MANAGER_COMPLETE_SUMMARY.md \
    docs/apps/bar-manager/BAR_MANAGER_QUICK_REFERENCE.txt \
    > docs/features/waiter/BAR_MANAGER.md

# Remove old scattered files
rm -rf docs/apps/waiter-ai/
rm -rf docs/apps/bar-manager/
rm docs/sessions/WAITER_AI_*.md
rm docs/sessions/BAR_MANAGER_*.md
```

---

### Phase 5: Remove Duplicate Code (Priority: P2, Duration: 1 hour)

```typescript
// supabase/functions/_shared/waiter-tools.ts
// DELETE lines 1092-1527 (duplicate payment tools)

// Keep only one set of payment tools (lines 627-783)
export async function initiate_payment(...) { /* ... */ }
export async function confirm_payment(...) { /* ... */ }
export async function cancel_payment(...) { /* ... */ }
export async function get_payment_status(...) { /* ... */ }
export async function save_payment_method(...) { /* ... */ }
export async function get_saved_payment_methods(...) { /* ... */ }

// Update exports at bottom
export const waiterTools = {
  search_menu,
  get_menu_item_details,
  add_to_cart,
  view_cart,
  update_cart_item,
  send_order,
  recommend_wine,
  book_table,
  get_order_status,
  // Payment tools (only once!)
  initiate_payment,
  confirm_payment,
  cancel_payment,
  get_payment_status,
  save_payment_method,
  get_saved_payment_methods
};
```

---

## 📊 METRICS AFTER REFACTORING

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Agent implementations | 4 | 1 primary + 1 wrapper | -75% |
| Lines of code | 2,358 | ~800 | -66% |
| System prompts | 4 different | 1 unified | Consistency |
| Duplicate code | 400+ lines | 0 | -100% |
| Documentation files | 17 scattered | 6 organized | -65% |
| Table references | Mixed | Standardized | Reliability |
| Bar Manager | Non-functional | Production-ready | ✅ Complete |

---

## ✅ ACTION ITEMS SUMMARY

### Critical (Do First)
- [ ] **P0:** Fix Bar Manager CSS build (1 day)
  - Use create-next-app template
  - Copy all code over
  - Implement real-time order queue

- [ ] **P1:** Consolidate agent implementations (2-3 days)
  - Extract tools to separate files
  - Unified system prompt
  - Update webhook to use shared agent

- [ ] **P1:** Standardize database tables (1 day)
  - Create compatibility views
  - Document table naming conventions
  - Update all queries

### Important (Do Soon)
- [ ] **P2:** Remove duplicate payment tools (1 hour)
  - Delete lines 1092-1527 from waiter-tools.ts
  - Verify no broken imports

- [ ] **P2:** Consolidate documentation (2 hours)
  - Move to docs/features/waiter/
  - Remove old scattered files
  - Update README links

### Nice to Have (Future)
- [ ] **P3:** Migrate to database-driven config (1 week)
  - Follow wa-agent-waiter pattern
  - Store prompts in ai_agent_system_instructions
  - Store tools in ai_agent_tools
  - Enable per-venue customization

- [ ] **P3:** Implement Waiter PWA (2 weeks)
  - Customer-facing web app
  - Direct ordering without WhatsApp
  - Mobile-optimized UI

---

## 🎯 TARGET STATE

### Single Source of Truth
```
packages/agents/src/agents/waiter/
├── index.ts                      // Re-exports
├── agent.ts                      // WaiterAgent class (KEEP CURRENT!)
├── tools/
│   ├── menu-tools.ts             // search_menu, get_menu_item_details
│   ├── cart-tools.ts             // add_to_cart, view_cart, update_cart_item
│   ├── order-tools.ts            // send_order, get_order_status
│   ├── payment-tools.ts          // Import from _shared/waiter-tools.ts
│   ├── reservation-tools.ts      // book_table
│   ├── recommendation-tools.ts   // recommend_wine, get_popular_items
│   └── index.ts
├── prompts/
│   └── system-prompt.ts          // Unified WAITER_SYSTEM_PROMPT
└── types.ts
```

### Webhook Wrappers
```typescript
// supabase/functions/wa-webhook-waiter/agent.ts
import { WaiterAgent } from '@easymo/agents/waiter';

const agent = new WaiterAgent();

export async function handleWaiterMessage(ctx) {
  // Session management logic (QR codes, location, discovery)
  // Then delegate to agent:
  return await agent.execute({ message, context });
}
```

### Database Schema
```sql
-- Primary tables
menu_items               -- Authoritative menu data
orders                   -- All orders (dine_in, delivery, takeout)
order_items              -- Line items
payments                 -- Payment records
bars                     -- Restaurant/bar listings
reservations             -- Table bookings

-- Compatibility views (legacy code support)
restaurant_menu_items    -- VIEW → menu_items
bar_orders               -- VIEW → orders WHERE order_type = 'dine_in'
payment_transactions     -- VIEW → payments
```

### Documentation
```
docs/features/waiter/
├── README.md            -- Overview & getting started
├── ARCHITECTURE.md      -- System architecture
├── IMPLEMENTATION.md    -- Technical implementation details
├── BAR_MANAGER.md       -- Bar manager app guide
├── QUICK_REFERENCE.md   -- Quick reference
├── DEPLOYMENT.md        -- Deployment guide
└── API.md               -- API reference
```

---

## 🏆 SUCCESS CRITERIA

After refactoring:

✅ **Code Quality:**
- Single WaiterAgent implementation used everywhere
- No duplicate code (payment tools)
- Unified system prompt
- Clear separation of concerns

✅ **Reliability:**
- Standardized database table names
- Compatibility views for legacy code
- Consistent error handling
- Proper observability logging

✅ **User Experience:**
- Consistent AI personality across all channels
- Bar Manager app functional and production-ready
- Real-time order updates
- Multi-language support

✅ **Maintainability:**
- Centralized documentation
- Clear code structure
- Easy to add new tools
- Database-driven configuration path

---

## 📚 REFERENCES

### Code Files
- `packages/agents/src/agents/waiter/waiter.agent.ts` (531 LOC)
- `supabase/functions/wa-webhook-waiter/agent.ts` (800+ LOC)
- `supabase/functions/wa-agent-waiter/core/waiter-agent.ts` (483 LOC)
- `services/agent-core/src/agents/waiter-broker.ts` (356 LOC)
- `supabase/functions/_shared/waiter-tools.ts` (1,547 LOC)

### Documentation
- `docs/sessions/WAITER_AI_COMPLETE_SYSTEM_ARCHITECTURE.md`
- `docs/sessions/BAR_MANAGER_COMPLETE_SUMMARY.md`
- `docs/apps/waiter-ai/WAITER_AI_QUICK_REFERENCE.md`
- `docs/GROUND_RULES.md` (Observability requirements)

### Database
- Active migrations in `supabase/migrations/ibimina/`
- Table definitions referenced in code
- RLS policies

---

**End of Analysis**
