# Buy & Sell Agent Refactoring Guide

**Implementation Guide for Consolidating 3 Agent Implementations into 1**

---

## 🎯 Goal

Consolidate 3 separate Buy & Sell agent implementations (1,772 total lines) into a single,
maintainable source of truth while preserving all functionality.

---

## 📐 Architecture Overview

### Current State (Fragmented)

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENT REQUESTS                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Admin Panel          WhatsApp Webhook      API Endpoint   │
│       │                     │                    │          │
│       ▼                     ▼                    ▼          │
│  ┌─────────┐         ┌──────────┐        ┌──────────┐      │
│  │ admin-  │         │wa-webhook│        │agent-buy-│      │
│  │ app/    │         │-buy-sell/│        │  sell/   │      │
│  │marketplace│       │ agent.ts │        │ index.ts │      │
│  │-agent.ts│         │1,086 lines│       │ 75 lines │      │
│  │139 lines│         └──────────┘        └──────────┘      │
│  │         │               │                    │          │
│  │ Uses:   │               │                    │          │
│  │ gpt-4o- │               │         Imports from ←────────┘
│  │  mini   │               │         wa-webhook-buy-sell
│  │         │               │         (DEPENDENCY CYCLE!)
│  │ Tools:  │               │                               │
│  │ - database_query│       │                               │
│  │ - google_maps   │       │ Uses: gemini-2.5-flash       │
│  │ - search_grounding│     │ Tools: Custom workflow       │
│  └─────────┘               │ Features: Vendor outreach    │
│       │                    │                               │
│       │                    │                               │
│       └────────────────────┴───────────────────────────────┤
│                            │                               │
│                            ▼                               │
│                  ┌──────────────────┐                      │
│                  │  packages/agents │  ← Should be shared │
│                  │  buy-and-sell.ts │     but ISN'T used  │
│                  │   547 lines      │                      │
│                  │                  │                      │
│                  │ Uses: gemini-1.5 │                      │
│                  │ Tools:           │                      │
│                  │ - search_businesses_ai                  │
│                  │ - search_businesses                     │
│                  │ - search_products                       │
│                  │ - maps_geocode                          │
│                  └──────────────────┘                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘

PROBLEMS:
❌ 3 different implementations
❌ Import cycle (agent-buy-sell → wa-webhook-buy-sell)
❌ No code reuse
❌ Different models, tools, behaviors
```

### Target State (Unified)

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENT REQUESTS                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Admin Panel          WhatsApp Webhook      API Endpoint   │
│       │                     │                    │          │
│       ▼                     ▼                    ▼          │
│  ┌─────────┐         ┌──────────┐        ┌──────────┐      │
│  │Re-export│         │  Deno    │        │  Deno    │      │
│  │from     │         │ Wrapper  │        │ Wrapper  │      │
│  │@easymo/ │         │          │        │          │      │
│  │agents   │         │          │        │          │      │
│  └────┬────┘         └────┬─────┘        └────┬─────┘      │
│       │                   │                   │            │
│       │                   │                   │            │
│       └───────────────────┴───────────────────┘            │
│                           │                                │
│                           ▼                                │
│              ┌──────────────────────────┐                  │
│              │ SINGLE SOURCE OF TRUTH   │                  │
│              │ packages/agents/         │                  │
│              │ commerce/buy-and-sell/   │                  │
│              ├──────────────────────────┤                  │
│              │ agent.ts (Core logic)    │                  │
│              │ tools/                   │                  │
│              │   ├─ search-businesses.ts│                  │
│              │   ├─ search-products.ts  │                  │
│              │   ├─ maps-geocode.ts     │                  │
│              │   └─ business-details.ts │                  │
│              │ prompts/                 │                  │
│              │   └─ system-prompt.ts    │                  │
│              │ workflows/               │                  │
│              │   ├─ category-selection.ts                  │
│              │   └─ vendor-outreach.ts  │                  │
│              └──────────────────────────┘                  │
│                           │                                │
│                           ▼                                │
│              ┌──────────────────────────┐                  │
│              │ Shared RPC Functions     │                  │
│              │ - search_businesses_ai   │                  │
│              │ - find_nearby_businesses │                  │
│              └──────────────────────────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘

BENEFITS:
✅ Single implementation (easier to maintain)
✅ Consistent behavior across all entry points
✅ No dependency cycles
✅ Modular structure (tools, workflows, prompts)
✅ Runtime-agnostic (works in Node.js and Deno)
```

---

## 🔧 Step-by-Step Implementation

### Step 1: Create Modular Structure

Create the following directory structure:

```bash
mkdir -p packages/agents/src/agents/commerce/buy-and-sell/{tools,prompts,workflows}
```

Files to create:

```
packages/agents/src/agents/commerce/buy-and-sell/
├── index.ts                      # Main export
├── agent.ts                      # Core BuyAndSellAgent class
├── config.ts                     # Constants and configuration
├── types.ts                      # TypeScript interfaces
├── tools/
│   ├── index.ts
│   ├── search-businesses.ts      # search_businesses_ai + search_businesses
│   ├── search-products.ts        # Product search tools
│   ├── maps-geocode.ts           # Location tools
│   └── business-details.ts       # Business info tools
├── prompts/
│   ├── index.ts
│   └── system-prompt.ts          # Agent instructions
└── workflows/
    ├── index.ts
    ├── category-selection.ts     # Category browsing flow
    └── vendor-outreach.ts        # Proactive vendor matching
```

### Step 2: Extract Configuration

**File**: `packages/agents/src/agents/commerce/buy-and-sell/config.ts`

```typescript
/**
 * Buy & Sell Agent Configuration
 * Canonical constants used across all implementations
 */

// Agent Identity
export const BUY_SELL_AGENT_SLUG = "buy_sell";
export const BUY_SELL_AGENT_NAME = "Buy & Sell AI Agent";
export const BUY_SELL_AGENT_TYPE = "buy_sell"; // For agent_configs.ts

// AI Model Configuration
export const BUY_SELL_DEFAULT_MODEL = "gemini-1.5-flash";
export const BUY_SELL_TEMPERATURE = 0.7;
export const BUY_SELL_MAX_TOKENS = 1024;

// Search Configuration
export const DEFAULT_SEARCH_RADIUS_KM = 10;
export const DEFAULT_SEARCH_LIMIT = 5;
export const MAX_SEARCH_LIMIT = 20;

// Business Categories
export const BUSINESS_CATEGORIES = [
  { code: "pharmacy", name: "Pharmacies", icon: "💊" },
  { code: "salon", name: "Salons & Barbers", icon: "💇" },
  { code: "restaurant", name: "Restaurants", icon: "🍽️" },
  { code: "supermarket", name: "Supermarkets", icon: "🛒" },
  { code: "hardware", name: "Hardware Stores", icon: "🔧" },
  { code: "bank", name: "Banks & Finance", icon: "🏦" },
  { code: "hospital", name: "Hospitals & Clinics", icon: "🏥" },
  { code: "hotel", name: "Hotels & Lodging", icon: "🏨" },
  { code: "transport", name: "Transport & Logistics", icon: "🚗" },
] as const;

export const EMOJI_NUMBERS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"] as const;

// RPC Function Names (for database)
export const RPC_SEARCH_BUSINESSES_AI = "search_businesses_ai";
export const RPC_FIND_NEARBY_BUSINESSES = "find_nearby_businesses";
export const RPC_SEARCH_BUSINESSES_NEARBY = "search_businesses_nearby";
```

### Step 3: Extract System Prompt

**File**: `packages/agents/src/agents/commerce/buy-and-sell/prompts/system-prompt.ts`

```typescript
import { BUY_SELL_AGENT_NAME } from "../config";

export const BUY_SELL_SYSTEM_PROMPT = `You are ${BUY_SELL_AGENT_NAME}, EasyMO's unified Buy & Sell assistant.

MARKETPLACE CAPABILITIES:
- Help users buy and sell products across all retail categories (pharmacy, hardware, grocery)
- Find shops and stores nearby
- Create and manage product listings
- Search for specific items
- Handle OTC pharmacy products; for RX items, request photo and escalate to pharmacist
- No medical advice, dosing, or contraindication information

BUSINESS DISCOVERY (ENHANCED WITH AI SEARCH):
- Use search_businesses_ai for natural language queries (e.g., "I need a computer", "print documents", "fix my phone")
- The AI search understands intent and finds relevant businesses based on tags, services, products, and keywords
- Returns ranked results with relevance scores, distance, and "open now" status
- Always prefer search_businesses_ai over search_businesses for better results
- Only recommend businesses from the database; respect opening hours

BUSINESS BROKERAGE:
- For sellers: Collect business details, financials (sanitized), asking price, terms
- For buyers: Understand acquisition criteria, budget, industry preferences
- Match parties; facilitate introductions; schedule meetings
- Generate NDAs and LOIs via generate_pdf when parties proceed

GUARDRAILS:
- No medical advice beyond finding a pharmacy
- No legal, tax, or financial advice—only logistics and intake
- Protect user privacy and confidentiality
- Sensitive topics require handoff to staff

FLOW:
1) Identify intent: product search, business discovery, business sale/purchase, or legal intake
2) For products: search_products/inventory_check; present options; build basket
3) For business discovery: 
   - If user provides natural language need: use search_businesses_ai with their query
   - If user has location: include lat/lng for location-aware results
   - Format results with emoji numbers (1️⃣-5️⃣) for easy selection
   - Show distance, rating, and open/closed status
4) For business transactions: collect details; match parties; generate documents
5) For all orders: momo_charge; confirm after settlement; track via order_status_update
6) Notify fulfillment (notify_staff); escalate sensitive topics immediately

RESPONSE FORMATTING:
- Use emoji numbers (1️⃣-5️⃣) for listing options
- Show distance if available (e.g., "0.5km away")
- Show rating if available (e.g., "⭐ 4.8")
- Indicate if business is open now (🟢 Open / 🔴 Closed)
- Keep messages concise and actionable`;
```

### Step 4: Refactor Core Agent

**File**: `packages/agents/src/agents/commerce/buy-and-sell/agent.ts`

```typescript
import { childLogger } from "@easymo/commons";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { AgentInput, AgentResult, Tool } from "../../../types/agent.types";
import { BaseAgent } from "../../base/agent.base";
import { BUY_SELL_SYSTEM_PROMPT } from "./prompts/system-prompt";
import { BUY_SELL_AGENT_SLUG, BUY_SELL_DEFAULT_MODEL, BUY_SELL_TEMPERATURE } from "./config";
import { defineTools } from "./tools";

const log = childLogger({ service: "agents", agent: "buy-and-sell" });

/**
 * Buy & Sell Agent
 *
 * SINGLE SOURCE OF TRUTH for Buy & Sell AI agent.
 * Used by:
 * - Node.js packages (via direct import)
 * - Deno edge functions (via runtime-compatible wrapper)
 * - Admin app (via re-export)
 *
 * @see docs/features/BUY_SELL_CONSOLIDATION_ANALYSIS.md
 */
export class BuyAndSellAgent extends BaseAgent {
  static readonly SLUG = BUY_SELL_AGENT_SLUG;

  name = "buy_and_sell_agent";
  instructions = BUY_SELL_SYSTEM_PROMPT;
  tools: Tool[];

  private supabase: SupabaseClient;

  constructor(supabaseClient?: SupabaseClient) {
    super();

    // Use provided client or create new one
    if (supabaseClient) {
      this.supabase = supabaseClient;
    } else {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        log.warn("Supabase credentials missing for BuyAndSellAgent");
      }

      this.supabase = createClient(supabaseUrl || "", supabaseKey || "", {
        auth: { persistSession: false },
      });
    }

    // Initialize tools with supabase client
    this.tools = defineTools(this.supabase);

    // Set default model
    this.model = BUY_SELL_DEFAULT_MODEL;
  }

  /**
   * Runtime-agnostic execution method
   * Can be called from Node.js or Deno
   */
  async execute(input: AgentInput): Promise<AgentResult> {
    return super.execute(input);
  }
}

/**
 * Backward compatibility alias
 * @deprecated Use BuyAndSellAgent instead
 */
export class MarketplaceAgent extends BuyAndSellAgent {
  constructor(supabaseClient?: SupabaseClient) {
    super(supabaseClient);
    log.warn("MarketplaceAgent is deprecated. Use BuyAndSellAgent instead.");
  }
}

// Helper function for quick invocation
export async function runBuyAndSellAgent(
  message: string,
  context?: Record<string, any>
): Promise<string> {
  const agent = new BuyAndSellAgent();
  const result = await agent.execute({ message, context });
  return result.response;
}
```

### Step 5: Modularize Tools

**File**: `packages/agents/src/agents/commerce/buy-and-sell/tools/index.ts`

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tool } from "../../../../types/agent.types";
import { searchBusinessesAI, searchBusinesses } from "./search-businesses";
import { searchProducts, inventoryCheck } from "./search-products";
import { mapsGeocode } from "./maps-geocode";
import { getBusinessDetails } from "./business-details";

/**
 * Define all tools for Buy & Sell agent
 */
export function defineTools(supabase: SupabaseClient): Tool[] {
  return [
    // Business Discovery
    searchBusinessesAI(supabase),
    searchBusinesses(supabase),
    getBusinessDetails(supabase),

    // Location
    mapsGeocode(),

    // Marketplace
    searchProducts(supabase),
    inventoryCheck(supabase),
  ];
}

export * from "./search-businesses";
export * from "./search-products";
export * from "./maps-geocode";
export * from "./business-details";
```

**File**: `packages/agents/src/agents/commerce/buy-and-sell/tools/search-businesses.ts`

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import { childLogger } from "@easymo/commons";
import type { Tool } from "../../../../types/agent.types";
import {
  RPC_SEARCH_BUSINESSES_AI,
  RPC_FIND_NEARBY_BUSINESSES,
  DEFAULT_SEARCH_RADIUS_KM,
  DEFAULT_SEARCH_LIMIT,
} from "../config";

const log = childLogger({ service: "agents", tool: "search-businesses" });

/**
 * AI-powered business search tool
 */
export function searchBusinessesAI(supabase: SupabaseClient): Tool {
  return {
    name: "search_businesses_ai",
    description:
      'Natural language search for businesses. Finds businesses based on user query like "I need a computer" or "pharmacy nearby". Uses AI-powered relevance ranking.',
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            'Natural language query (e.g., "computer shop", "print documents", "fix phone")',
        },
        lat: {
          type: "number",
          description: "User latitude (optional, for location-aware results)",
        },
        lng: {
          type: "number",
          description: "User longitude (optional, for location-aware results)",
        },
        radius_km: {
          type: "number",
          description: `Search radius in km (default ${DEFAULT_SEARCH_RADIUS_KM})`,
        },
        limit: {
          type: "number",
          description: `Max results (default ${DEFAULT_SEARCH_LIMIT})`,
        },
      },
      required: ["query"],
    },
    execute: async (params, context) => {
      const {
        query,
        lat = null,
        lng = null,
        radius_km = DEFAULT_SEARCH_RADIUS_KM,
        limit = DEFAULT_SEARCH_LIMIT,
      } = params;

      log.info({ query, lat, lng }, "Executing AI business search");

      const { data, error } = await supabase.rpc(RPC_SEARCH_BUSINESSES_AI, {
        p_query: query,
        p_lat: lat,
        p_lng: lng,
        p_radius_km: radius_km,
        p_limit: limit,
      });

      if (error) {
        log.error({ error }, "AI business search failed");
        throw new Error(`AI search failed: ${error.message}`);
      }

      log.info({ count: data?.length || 0 }, "AI search returned results");
      return {
        businesses: data,
        source: "ai_search",
      };
    },
  };
}

/**
 * Category-based business search tool
 */
export function searchBusinesses(supabase: SupabaseClient): Tool {
  return {
    name: "search_businesses",
    description:
      "Find businesses by category and location. Use search_businesses_ai for natural language queries.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Business category (e.g., pharmacy, restaurant, hardware)",
        },
        lat: { type: "number", description: "Latitude" },
        lng: { type: "number", description: "Longitude" },
        radius_km: {
          type: "number",
          description: `Search radius in km (default ${DEFAULT_SEARCH_RADIUS_KM})`,
        },
        limit: { type: "number", description: `Max results (default ${DEFAULT_SEARCH_LIMIT})` },
      },
      required: ["category", "lat", "lng"],
    },
    execute: async (params, context) => {
      const {
        category,
        lat,
        lng,
        radius_km = DEFAULT_SEARCH_RADIUS_KM,
        limit = DEFAULT_SEARCH_LIMIT,
      } = params;

      const { data, error } = await supabase.rpc(RPC_FIND_NEARBY_BUSINESSES, {
        p_lat: lat,
        p_lng: lng,
        p_radius_km: radius_km,
        p_category: category,
        p_limit: limit,
      });

      if (error) {
        log.error({ error }, "Nearby business search failed");
        throw new Error(`Business search failed: ${error.message}`);
      }

      return { businesses: data };
    },
  };
}
```

### Step 6: Create Deno Wrapper

**File**: `supabase/functions/_shared/agents/buy-and-sell.ts`

```typescript
/**
 * Deno-compatible wrapper for Buy & Sell Agent
 *
 * This is a lightweight adapter that makes the core agent
 * work in the Deno runtime without modifications.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Import core types (create Deno-compatible versions if needed)
interface AgentInput {
  message: string;
  context?: Record<string, any>;
}

interface AgentResult {
  response: string;
  action?: string;
  data?: Record<string, any>;
}

/**
 * BuyAndSellAgent for Deno runtime
 *
 * Implements same interface as Node.js version but optimized for edge functions.
 * Core logic should match packages/agents/src/agents/commerce/buy-and-sell/agent.ts
 */
export class BuyAndSellAgent {
  private supabase: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  async execute(input: AgentInput): Promise<AgentResult> {
    // Core execution logic
    // Either:
    // A) Copy from Node.js version (ensure compatibility)
    // B) Import and adapt from shared location
    // C) Use API call to Node.js agent service

    // For now, delegate to existing implementation
    throw new Error("Not implemented - migrate logic from wa-webhook-buy-sell/agent.ts");
  }
}

// Backward compatibility
export { BuyAndSellAgent as MarketplaceAgent };

// Helper for quick setup
export function createBuyAndSellAgent(): BuyAndSellAgent {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
  return new BuyAndSellAgent(supabase);
}
```

### Step 7: Update Edge Functions

**File**: `supabase/functions/agent-buy-sell/index.ts`

```typescript
// BEFORE
import { MarketplaceAgent, type MarketplaceContext } from "../wa-webhook-buy-sell/agent.ts";

// AFTER
import { BuyAndSellAgent, createBuyAndSellAgent } from "../_shared/agents/buy-and-sell.ts";

const agent = createBuyAndSellAgent();

serve(async (req: Request): Promise<Response> => {
  // ... rest of code stays same, just use BuyAndSellAgent
});
```

**File**: `supabase/functions/wa-webhook-buy-sell/index.ts`

```typescript
// BEFORE
import { MarketplaceAgent } from "./agent.ts";
const agent = new MarketplaceAgent(supabase);

// AFTER
import { BuyAndSellAgent } from "../_shared/agents/buy-and-sell.ts";
const agent = new BuyAndSellAgent(supabase);
```

### Step 8: Update Admin App

**File**: `admin-app/lib/ai/domain/marketplace-agent.ts`

```typescript
/**
 * Buy & Sell Agent - Admin App Re-export
 *
 * @deprecated Import from @easymo/agents/commerce instead
 * This file exists only for backward compatibility.
 */

export { BuyAndSellAgent, MarketplaceAgent, runBuyAndSellAgent } from "@easymo/agents/commerce";

// Singleton instances for convenience
import { BuyAndSellAgent } from "@easymo/agents/commerce";

export const buyAndSellAgent = new BuyAndSellAgent();

/**
 * @deprecated Use buyAndSellAgent
 */
export const marketplaceAgent = buyAndSellAgent;
```

### Step 9: Fix Agent Config

**File**: `supabase/functions/wa-webhook/shared/agent_configs.ts`

```typescript
// BEFORE
{
  type: "buy_and_sell",  // ❌ Wrong
  name: "Buy & Sell AI Agent",
  // ...
}

// AFTER
import { BUY_SELL_AGENT_TYPE, BUY_SELL_AGENT_NAME } from '../_shared/agents/buy-and-sell/config.ts';

{
  type: BUY_SELL_AGENT_TYPE,  // ✅ "buy_sell" from config
  name: BUY_SELL_AGENT_NAME,
  // ...
}
```

### Step 10: Database Migration

**File**: `supabase/migrations/YYYYMMDDHHMMSS_consolidate_buy_sell_agent.sql`

```sql
-- Consolidate Buy & Sell Agent slugs and menu keys
BEGIN;

-- 1. Ensure only 'buy_sell' slug exists
DELETE FROM ai_agents
WHERE slug IN ('buy_and_sell', 'business_broker', 'marketplace');

-- Ensure buy_sell is active
UPDATE ai_agents
SET is_active = true
WHERE slug = 'buy_sell';

-- If buy_sell doesn't exist, create it (shouldn't happen if setup script ran)
INSERT INTO ai_agents (slug, name, is_active)
VALUES ('buy_sell', 'Buy & Sell AI Agent', true)
ON CONFLICT (slug) DO UPDATE SET is_active = true;

-- 2. Menu items already correct from 20251210085100_split_buy_sell_and_chat_agent.sql
-- Verify they exist:
SELECT key, name FROM whatsapp_home_menu_items
WHERE key IN ('buy_sell_categories', 'business_broker_agent');

-- 3. Add comment for future reference
COMMENT ON TABLE ai_agents IS 'AI agent registry. Buy & Sell agent uses slug=buy_sell (not buy_and_sell)';

COMMIT;
```

---

## ✅ Testing Plan

### Unit Tests

```typescript
// packages/agents/src/agents/commerce/buy-and-sell/__tests__/agent.test.ts

import { BuyAndSellAgent } from "../agent";
import { BUY_SELL_AGENT_SLUG } from "../config";

describe("BuyAndSellAgent", () => {
  it("should have correct slug", () => {
    expect(BuyAndSellAgent.SLUG).toBe("buy_sell");
  });

  it("should initialize with tools", () => {
    const agent = new BuyAndSellAgent();
    expect(agent.tools.length).toBeGreaterThan(0);
  });

  it("should execute search_businesses_ai", async () => {
    const agent = new BuyAndSellAgent();
    // Mock supabase.rpc()
    // ... test logic
  });
});
```

### Integration Tests

1. **Test Admin App**: Verify import works from @easymo/agents
2. **Test Edge Functions**: Deploy to staging, test WhatsApp flow
3. **Test API Endpoint**: Call agent-buy-sell, verify response

### E2E Tests

1. Send WhatsApp message → Category selection → Location → Results
2. Send chat message → AI search → Business details
3. Admin panel → Create product → Search → Find product

---

## 📊 Validation Checklist

- [ ] All 3 implementations deleted/redirected
- [ ] Single source of truth in packages/agents/commerce/buy-and-sell/
- [ ] No import cycles
- [ ] Agent slug is `buy_sell` everywhere
- [ ] Agent config type is `buy_sell`
- [ ] Menu keys are `buy_sell_categories` and `business_broker_agent`
- [ ] All tools use same RPC functions
- [ ] Tests pass (unit + integration + e2e)
- [ ] Build succeeds (pnpm build)
- [ ] Linter happy (pnpm lint)
- [ ] Documentation updated

---

## 🚀 Deployment Strategy

### Phase 1: Preparation (No deploy)

1. Create new structure in packages/agents/
2. Extract tools, prompts, config
3. Update tests
4. Verify build locally

### Phase 2: Backend (Deploy to staging)

1. Deploy database migration
2. Update agent_configs.ts
3. Deploy edge functions with new imports
4. Test WhatsApp flows on staging

### Phase 3: Frontend (Deploy admin app)

1. Update admin-app imports
2. Build and test locally
3. Deploy to staging
4. Test admin panel flows

### Phase 4: Production

1. Deploy during low-traffic window
2. Monitor error logs
3. Test all entry points:
   - WhatsApp category selection
   - WhatsApp AI chat
   - Admin panel
   - API endpoint
4. Rollback plan: Revert git commits, redeploy previous version

---

## 📝 Rollback Plan

If issues arise:

```bash
# Revert database migration
supabase db reset

# Revert code changes
git revert <consolidation-commit-sha>

# Redeploy edge functions
supabase functions deploy agent-buy-sell
supabase functions deploy wa-webhook-buy-sell

# Redeploy admin app
cd admin-app && npm run build && npm run deploy
```

---

## 📚 References

- **Analysis**: `docs/features/BUY_SELL_CONSOLIDATION_ANALYSIS.md`
- **Ground Rules**: `docs/GROUND_RULES.md`
- **Current Primary**: `packages/agents/src/agents/commerce/buy-and-sell.agent.ts`
- **Current Edge**: `supabase/functions/wa-webhook-buy-sell/agent.ts`
- **Current Admin**: `admin-app/lib/ai/domain/marketplace-agent.ts`

---

**Last Updated**: 2025-12-10  
**Prepared By**: GitHub Copilot CLI
