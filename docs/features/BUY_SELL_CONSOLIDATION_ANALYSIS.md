# Buy & Sell AI Agent - Complete Consolidation Analysis

**Date**: December 10, 2025  
**Status**: 🔴 Critical - Multiple Implementations Detected  
**Priority**: P0 - Requires Immediate Consolidation

---

## 📊 Executive Summary

The Buy & Sell AI Agent currently has **3 separate implementations** across different parts of the
codebase, leading to:

- ❌ Code duplication (1,772 total lines across 3 files)
- ❌ Inconsistent behavior and tool definitions
- ❌ Maintenance overhead and bug risks
- ❌ Import confusion and dependency cycles

**Recommendation**: Consolidate to single source of truth in `packages/agents/` with Deno-compatible
wrappers for edge functions.

---

## 🗂️ Current State Inventory

### 1. Agent Implementations (3 Separate Files)

#### A. Primary Implementation: `packages/agents/src/agents/commerce/buy-and-sell.agent.ts`

- **Lines**: 547
- **Status**: ✅ Active
- **Base Class**: `BaseAgent`
- **Model**: `gemini-1.5-flash`
- **Tools**:
  - `search_businesses_ai` - AI-powered natural language search
  - `search_businesses` - Category-based search
  - `search_products` - Product search
  - `maps_geocode` - Location geocoding
  - `business_details` - Get business info
- **Dependencies**: `@easymo/commons`, `@supabase/supabase-js`, `axios`
- **RPC Functions**: `search_businesses_ai`, `find_nearby_businesses`

#### B. Admin Implementation: `admin-app/lib/ai/domain/marketplace-agent.ts`

- **Lines**: 139
- **Status**: 🟡 Deprecated wrapper (but still used)
- **Base Class**: `AgentExecutor`
- **Model**: `gpt-4o-mini`
- **Tools**: `['database_query', 'google_maps', 'search_grounding']`
- **Notes**:
  - Comment says "deprecated" but code is active
  - Different tools and model than primary
  - Exports both `BuyAndSellAgent` and `MarketplaceAgent` (alias)

#### C. Edge Function Implementation: `supabase/functions/wa-webhook-buy-sell/agent.ts`

- **Lines**: 1,086
- **Status**: ✅ Active
- **Base Class**: Standalone (no base class)
- **Model**: Gemini 2.5 Flash (via `DualAIProvider`)
- **Environment**: Deno runtime
- **Features**:
  - Category selection workflow
  - Vendor outreach
  - Pagination support
  - Proactive business matching
- **RPC Functions**: `search_businesses_nearby`

### 2. Edge Function Entrypoints

#### `agent-buy-sell` (API Endpoint)

- **Path**: `supabase/functions/agent-buy-sell/index.ts`
- **Lines**: 75
- **Purpose**: HTTP API for Buy & Sell agent
- **Issue**: ❌ Imports from `wa-webhook-buy-sell/agent.ts` creating dependency cycle

```typescript
import { MarketplaceAgent, type MarketplaceContext } from "../wa-webhook-buy-sell/agent.ts";
```

#### `wa-webhook-buy-sell` (WhatsApp Webhook)

- **Path**: `supabase/functions/wa-webhook-buy-sell/index.ts`
- **Purpose**: WhatsApp webhook handler
- **Uses**: Local `agent.ts` (MarketplaceAgent class)

### 3. Database State

#### Agent Registry (`ai_agents` table)

Based on `scripts/db/setup_buy_sell_agent.sql`:

- **Active Slug**: `buy_sell` ✅
- **Deactivated Slugs**: `business_broker`, `marketplace`, `buy_and_sell`

#### Menu Items (`whatsapp_home_menu_items` table)

From migration `20251210085100_split_buy_sell_and_chat_agent.sql`:

- **Menu Key 1**: `buy_sell_categories` - Category selection workflow
- **Menu Key 2**: `business_broker_agent` - AI chat interface
- **Deleted Key**: `business_broker_agent` (old combined item)

### 4. Agent Configurations

#### `supabase/functions/wa-webhook/shared/agent_configs.ts`

```typescript
{
  type: "buy_and_sell",  // ❌ Mismatch: DB uses "buy_sell"
  name: "Buy & Sell AI Agent",
  // ...
}
```

**Issue**: Config uses `buy_and_sell` but database uses `buy_sell`.

#### `supabase/functions/wa-webhook/domains/ai-agents/business_broker_agent.ts`

- **Class**: `BusinessBrokerAgent`
- **Model**: `gemini-2.5-pro-latest`
- **Status**: ✅ Active (separate from Buy & Sell implementations)
- **Purpose**: Business discovery via AI chat

---

## 🔴 Critical Issues

### Issue #1: Three Different Agent Classes

| Implementation         | Base Class      | Model            | Tools                                 | Dependencies          |
| ---------------------- | --------------- | ---------------- | ------------------------------------- | --------------------- |
| `packages/agents/`     | `BaseAgent`     | gemini-1.5-flash | search_businesses_ai, search_products | Node.js (axios)       |
| `admin-app/`           | `AgentExecutor` | gpt-4o-mini      | database_query, google_maps           | Different abstraction |
| `wa-webhook-buy-sell/` | None            | gemini-2.5-flash | Custom workflow                       | Deno runtime          |

**Impact**: Same "agent" behaves completely differently depending on where it's invoked.

### Issue #2: Import Dependency Cycle

```
agent-buy-sell/index.ts
  ↓ imports from
wa-webhook-buy-sell/agent.ts
  ↓ should use shared
packages/agents/ (but doesn't)
```

**Problem**: Edge functions importing from each other instead of shared source.

### Issue #3: Agent Slug Mismatch

- **Database**: `buy_sell`
- **Agent Config**: `buy_and_sell`
- **Menu Keys**: `buy_sell_categories`, `business_broker_agent`

### Issue #4: Duplicate Tool Definitions

Same functionality, different implementations:

| Tool Purpose    | packages/agents        | wa-webhook-buy-sell        | admin-app        |
| --------------- | ---------------------- | -------------------------- | ---------------- |
| Business search | `search_businesses_ai` | `searchMatches()`          | `database_query` |
| RPC function    | `search_businesses_ai` | `search_businesses_nearby` | N/A              |
| Location        | `maps_geocode`         | Built-in                   | `google_maps`    |

### Issue #5: Model Inconsistency

- Primary: `gemini-1.5-flash`
- Admin: `gpt-4o-mini`
- Edge: `gemini-2.5-flash`

Same agent, three different AI models.

---

## 📋 File Inventory

### ✅ Keep & Refactor

```
packages/agents/src/agents/commerce/buy-and-sell.agent.ts  (547 lines) - PRIMARY
supabase/functions/wa-webhook-buy-sell/
  ├── index.ts                                              - Webhook handler
  ├── agent.ts                                   (1,086 lines) - CONSOLIDATE
  └── (other files)                                         - Keep workflows
supabase/functions/agent-buy-sell/index.ts                  - UPDATE imports
admin-app/lib/ai/domain/marketplace-agent.ts                - REPLACE with re-export
```

### 📁 Already in Correct Location

```
scripts/db/
  ├── setup_buy_sell_agent.sql                              ✅ Correct
  ├── cleanup_ai_agents.sql                                 ✅ Correct
  └── cleanup_ai_agents_corrected.sql                       ✅ Correct
```

### 📁 Archived (OK)

```
supabase/migrations/.archive/
  ├── 20251205202500_add_buy_and_sell_agent.sql
  ├── 20251205214422_ensure_buy_sell_menu_item.sql
  ├── 20251205214913_force_cleanup_buy_sell_duplicates.sql
  └── (other buy-sell migrations)
```

### ❌ Issues to Address

```
supabase/functions/wa-webhook/shared/agent_configs.ts       - Fix slug: buy_and_sell → buy_sell
supabase/functions/agent-buy-sell/index.ts                  - Fix import cycle
```

---

## 🔧 Recommended Refactoring Plan

### Phase 1: Create Shared Agent Core (Day 1)

**Goal**: Single source of truth that works in both Node.js and Deno.

```
packages/agents/src/agents/commerce/buy-and-sell/
├── index.ts                      # Re-exports
├── agent.ts                      # Core BuyAndSellAgent class
├── config.ts                     # Agent metadata (slug, name, model)
├── tools/
│   ├── index.ts
│   ├── search-businesses.ts      # search_businesses_ai + search_businesses
│   ├── search-products.ts
│   ├── business-details.ts
│   └── maps-geocode.ts
├── prompts/
│   └── system-prompt.ts
└── types.ts
```

**Key Changes**:

1. Move tools to separate files for clarity
2. Extract prompts to dedicated file
3. Make runtime-agnostic (works in Node.js and Deno)
4. Export canonical constants:
   ```typescript
   export const BUY_SELL_AGENT_SLUG = "buy_sell";
   export const BUY_SELL_AGENT_NAME = "Buy & Sell AI Agent";
   export const BUY_SELL_DEFAULT_MODEL = "gemini-1.5-flash";
   ```

### Phase 2: Update Edge Functions (Day 2)

#### A. Create Deno-Compatible Wrapper

```typescript
// supabase/functions/_shared/agents/buy-and-sell.ts
import { BuyAndSellAgent } from "@easymo/agents/commerce";
// OR copy core logic for Deno runtime

export { BuyAndSellAgent };
export type { AgentInput, AgentResult } from "@easymo/agents";
```

#### B. Update `agent-buy-sell/index.ts`

```typescript
// BEFORE
import { MarketplaceAgent } from "../wa-webhook-buy-sell/agent.ts";

// AFTER
import { BuyAndSellAgent } from "../_shared/agents/buy-and-sell.ts";
```

#### C. Consolidate `wa-webhook-buy-sell/agent.ts`

**Options**:

1. **Replace with wrapper** (if core agent has all features)
2. **Keep workflow logic** (category selection, pagination) + use shared tools
3. **Migrate unique features** to core agent (vendor outreach, proactive matching)

**Recommendation**: Option 3 - Migrate unique features to core, then use shared agent.

### Phase 3: Fix Database & Config (Day 3)

#### A. Standardize Agent Slug

```sql
-- Migration: standardize_buy_sell_agent_slug.sql
BEGIN;

-- Ensure canonical slug
UPDATE ai_agents
SET slug = 'buy_sell', is_active = true
WHERE slug IN ('buy_and_sell', 'business_broker', 'marketplace');

-- Delete duplicates
DELETE FROM ai_agents
WHERE slug IN ('buy_and_sell', 'business_broker', 'marketplace')
  AND slug != 'buy_sell';

COMMIT;
```

#### B. Update Agent Config

```typescript
// supabase/functions/wa-webhook/shared/agent_configs.ts
{
  type: "buy_sell",  // Changed from "buy_and_sell"
  name: "Buy & Sell AI Agent",
  // ...
}
```

#### C. Consolidate Menu Keys

Current state (from migration):

- `buy_sell_categories` - Category workflow
- `business_broker_agent` - AI chat

**Decision**: Keep both (they serve different UX flows) or consolidate?

### Phase 4: Update Admin App (Day 4)

```typescript
// admin-app/lib/ai/domain/marketplace-agent.ts
/**
 * @deprecated Import from @easymo/agents instead
 */
export { BuyAndSellAgent, MarketplaceAgent } from "@easymo/agents/commerce";

// For backward compatibility
export const buyAndSellAgent = new BuyAndSellAgent();
export const marketplaceAgent = buyAndSellAgent;
```

### Phase 5: Update All Imports (Day 5)

Search and replace:

```bash
# Find all imports
rg "from ['\"].*marketplace-agent|from ['\"].*buy-and-sell" --type ts

# Standard import pattern:
import { BuyAndSellAgent } from '@easymo/agents/commerce';

# Deno edge functions:
import { BuyAndSellAgent } from '../_shared/agents/buy-and-sell.ts';
```

---

## 🎯 Final Target State

### Single Source of Truth

```
packages/agents/src/agents/commerce/buy-and-sell/
└── agent.ts  ← THE ONLY implementation
```

### Database

```sql
SELECT slug, name, is_active FROM ai_agents;
-- buy_sell | Buy & Sell AI Agent | true
```

### Menu Items

```sql
SELECT key, name FROM whatsapp_home_menu_items WHERE is_active = true;
-- buy_sell_categories    | 🛒 Buy and Sell
-- business_broker_agent  | 🤖 Chat with Agent
```

### Agent Config

```typescript
{
  type: "buy_sell",  // ✅ Matches DB
  name: "Buy & Sell AI Agent",
  // ...
}
```

### Imports (Standardized)

```typescript
// Node.js packages
import { BuyAndSellAgent } from "@easymo/agents/commerce";

// Deno edge functions
import { BuyAndSellAgent } from "../_shared/agents/buy-and-sell.ts";
```

---

## ✅ Action Items

| Priority | Task                                              | Effort  | Impact   | Owner |
| -------- | ------------------------------------------------- | ------- | -------- | ----- |
| 🔴 P0    | Create consolidated agent in packages/agents      | 4 hours | Critical | TBD   |
| 🔴 P0    | Fix agent slug mismatch (buy_and_sell → buy_sell) | 1 hour  | Critical | TBD   |
| 🔴 P0    | Break import cycle (agent-buy-sell → wa-webhook)  | 2 hours | Critical | TBD   |
| 🟡 P1    | Migrate unique features from wa-webhook-buy-sell  | 4 hours | High     | TBD   |
| 🟡 P1    | Update admin-app to re-export from shared         | 1 hour  | High     | TBD   |
| 🟡 P1    | Update all import statements                      | 2 hours | High     | TBD   |
| 🟢 P2    | Consolidate RPC functions (search*businesses*\*)  | 2 hours | Medium   | TBD   |
| 🟢 P2    | Add integration tests for consolidated agent      | 3 hours | Medium   | TBD   |
| 🟢 P2    | Update documentation                              | 1 hour  | Medium   | TBD   |

**Total Estimated Effort**: 20 hours (~2.5 developer days)

---

## 🚨 Risks & Mitigation

### Risk 1: Breaking Active WhatsApp Workflows

- **Impact**: High - Users lose access to Buy & Sell
- **Mitigation**:
  - Deploy during low-traffic window
  - Keep wa-webhook-buy-sell workflow intact initially
  - Gradual migration with feature flags

### Risk 2: Database Migration Issues

- **Impact**: Medium - Agent not found errors
- **Mitigation**:
  - Test migration on staging first
  - Keep old slugs as aliases temporarily
  - Monitor error logs post-deployment

### Risk 3: Import Breaking Changes

- **Impact**: Medium - Build failures
- **Mitigation**:
  - Update all imports in single PR
  - Run full build + test suite
  - Deploy admin-app + edge functions together

---

## 📝 Notes

### Business Context

- **Users**: 8,232+ businesses across 17 categories
- **Features**: Category browsing, AI chat, vendor outreach, proactive matching
- **Workflows**: Two distinct UX flows (category selection vs. chat)

### Technical Debt

- Accumulated over 5+ migrations (see `.archive/`)
- Multiple renames: business_broker → marketplace → buy_and_sell → buy_sell
- Root cause: Rapid iteration without refactoring

### Dependencies

- **Node.js**: `@easymo/commons`, `@supabase/supabase-js`, `axios`
- **Deno**: `@supabase/supabase-js@2`, `@google/generative-ai`
- **Shared**: Supabase RPC functions, database schema

---

## 🔗 References

- **Ground Rules**: `docs/GROUND_RULES.md`
- **Architecture**: `docs/ARCHITECTURE.md`
- **Agent Setup**: `scripts/db/setup_buy_sell_agent.sql`
- **Recent Migration**: `supabase/migrations/20251210085100_split_buy_sell_and_chat_agent.sql`
- **Primary Agent**: `packages/agents/src/agents/commerce/buy-and-sell.agent.ts`

---

**Last Updated**: 2025-12-10  
**Prepared By**: GitHub Copilot CLI  
**Status**: 🔴 Awaiting Decision & Implementation
