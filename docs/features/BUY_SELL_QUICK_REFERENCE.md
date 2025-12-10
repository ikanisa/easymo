# Buy & Sell Agent Consolidation - Quick Reference

**🎯 TL;DR**: We have 3 separate Buy & Sell agent implementations (1,772 lines). Consolidate to 1 source of truth.

---

## 📍 Current Issues

| Issue | Impact | Location |
|-------|--------|----------|
| 3 separate agents | Code duplication, inconsistent behavior | packages/agents/, wa-webhook-buy-sell/, admin-app/ |
| Import cycle | Maintenance nightmare | agent-buy-sell → wa-webhook-buy-sell |
| Slug mismatch | Config errors | DB: `buy_sell`, Config: `buy_and_sell` |
| Different models | Inconsistent AI responses | gemini-1.5-flash vs gpt-4o-mini vs gemini-2.5-flash |
| Different tools | Incompatible features | 6+ different tool implementations |

---

## 🎯 Target State

```
SINGLE SOURCE OF TRUTH
packages/agents/src/agents/commerce/buy-and-sell/
├── agent.ts           ← Core implementation
├── config.ts          ← Constants (slug, model, etc.)
├── tools/             ← Tool definitions
├── prompts/           ← System prompts
└── workflows/         ← Category selection, vendor outreach

ALL OTHER FILES → Re-export or wrap this
```

---

## 📋 Action Checklist

### Phase 1: Create Structure ✅
- [ ] Create `packages/agents/src/agents/commerce/buy-and-sell/` directory
- [ ] Create subdirectories: `tools/`, `prompts/`, `workflows/`
- [ ] Extract `config.ts` with constants:
  - `BUY_SELL_AGENT_SLUG = 'buy_sell'`
  - `BUY_SELL_DEFAULT_MODEL = 'gemini-1.5-flash'`
  - `BUSINESS_CATEGORIES`, `EMOJI_NUMBERS`, etc.

### Phase 2: Refactor Core ✅
- [ ] Extract system prompt to `prompts/system-prompt.ts`
- [ ] Modularize tools in `tools/`:
  - `search-businesses.ts` (search_businesses_ai + search_businesses)
  - `search-products.ts`
  - `maps-geocode.ts`
  - `business-details.ts`
- [ ] Update `agent.ts` to use modular structure
- [ ] Add JSDoc comments linking to consolidation docs

### Phase 3: Update Wrappers ✅
- [ ] Create Deno wrapper: `supabase/functions/_shared/agents/buy-and-sell.ts`
- [ ] Update `admin-app/lib/ai/domain/marketplace-agent.ts`:
  ```typescript
  export { BuyAndSellAgent, MarketplaceAgent } from '@easymo/agents/commerce';
  ```
- [ ] Update `agent-buy-sell/index.ts` import:
  ```typescript
  import { BuyAndSellAgent } from "../_shared/agents/buy-and-sell.ts";
  ```
- [ ] Update `wa-webhook-buy-sell/index.ts` import

### Phase 4: Fix Database ✅
- [ ] Create migration: `YYYYMMDDHHMMSS_consolidate_buy_sell_agent.sql`
- [ ] Delete old slugs: `buy_and_sell`, `business_broker`, `marketplace`
- [ ] Ensure `buy_sell` is the only active slug
- [ ] Verify menu keys: `buy_sell_categories`, `business_broker_agent`

### Phase 5: Update Config ✅
- [ ] Fix `agent_configs.ts`: `type: "buy_sell"` (not `buy_and_sell`)
- [ ] Use constants from `config.ts`:
  ```typescript
  import { BUY_SELL_AGENT_TYPE } from '../_shared/agents/buy-and-sell/config.ts';
  ```

### Phase 6: Migrate Features ⏳
- [ ] Move unique features from `wa-webhook-buy-sell/agent.ts` to core:
  - Category selection workflow → `workflows/category-selection.ts`
  - Vendor outreach → `workflows/vendor-outreach.ts`
  - Pagination support
  - Proactive business matching
- [ ] Keep WhatsApp-specific UI logic in `wa-webhook-buy-sell/`

### Phase 7: Testing ⏳
- [ ] Unit tests: `packages/agents/src/agents/commerce/buy-and-sell/__tests__/`
- [ ] Integration tests: Test all 3 entry points (admin, webhook, API)
- [ ] E2E tests: WhatsApp flows on staging

### Phase 8: Deploy ⏳
- [ ] Deploy database migration to staging
- [ ] Deploy edge functions to staging
- [ ] Deploy admin app to staging
- [ ] Test all flows on staging
- [ ] Deploy to production (low-traffic window)
- [ ] Monitor error logs

---

## 🔍 Files to Change

### Create New Files
```
packages/agents/src/agents/commerce/buy-and-sell/
├── config.ts                    (NEW)
├── tools/index.ts               (NEW)
├── tools/search-businesses.ts   (NEW)
├── tools/search-products.ts     (NEW)
├── tools/maps-geocode.ts        (NEW)
├── tools/business-details.ts    (NEW)
├── prompts/index.ts             (NEW)
├── prompts/system-prompt.ts     (NEW)
└── workflows/                   (NEW DIR)

supabase/functions/_shared/agents/
└── buy-and-sell.ts              (NEW)
```

### Modify Existing Files
```
packages/agents/src/agents/commerce/buy-and-sell.agent.ts  (REFACTOR)
admin-app/lib/ai/domain/marketplace-agent.ts               (REPLACE with re-export)
supabase/functions/agent-buy-sell/index.ts                 (UPDATE imports)
supabase/functions/wa-webhook-buy-sell/index.ts            (UPDATE imports)
supabase/functions/wa-webhook/shared/agent_configs.ts      (FIX type)
```

### Delete After Consolidation
```
# After confirming everything works:
supabase/functions/wa-webhook-buy-sell/agent.ts            (DELETE or archive)
# Keep only if it has WhatsApp-specific workflow logic
```

---

## 🚨 Common Pitfalls

### ❌ Don't Do This
```typescript
// Import cycle - BAD
import { MarketplaceAgent } from "../wa-webhook-buy-sell/agent.ts";
```

### ✅ Do This Instead
```typescript
// Use shared source - GOOD
import { BuyAndSellAgent } from "../_shared/agents/buy-and-sell.ts";
```

---

### ❌ Don't Do This
```typescript
// Hardcoded slug - BAD
const agentType = "buy_and_sell";
```

### ✅ Do This Instead
```typescript
// Use constant - GOOD
import { BUY_SELL_AGENT_SLUG } from '../config';
const agentType = BUY_SELL_AGENT_SLUG;
```

---

### ❌ Don't Do This
```sql
-- Wrong slug - BAD
UPDATE ai_agents SET is_active = true WHERE slug = 'buy_and_sell';
```

### ✅ Do This Instead
```sql
-- Correct slug - GOOD
UPDATE ai_agents SET is_active = true WHERE slug = 'buy_sell';
```

---

## 📊 Success Metrics

After consolidation:

- ✅ Only 1 agent implementation (not 3)
- ✅ 0 import cycles
- ✅ Consistent slug: `buy_sell` everywhere
- ✅ Consistent model: `gemini-1.5-flash` (or configurable)
- ✅ All tools use same RPC functions
- ✅ Tests pass: `pnpm exec vitest run` (84 tests)
- ✅ Build passes: `pnpm build`
- ✅ Lint passes: `pnpm lint` (2 warnings OK)
- ✅ All 4 entry points work:
  1. Admin panel (via @easymo/agents)
  2. WhatsApp category selection (via wa-webhook-buy-sell)
  3. WhatsApp AI chat (via agent-buy-sell)
  4. API endpoint (via agent-buy-sell)

---

## 🔗 Quick Links

- **Full Analysis**: [BUY_SELL_CONSOLIDATION_ANALYSIS.md](./BUY_SELL_CONSOLIDATION_ANALYSIS.md)
- **Implementation Guide**: [BUY_SELL_REFACTORING_GUIDE.md](./BUY_SELL_REFACTORING_GUIDE.md)
- **Ground Rules**: [../../GROUND_RULES.md](../../GROUND_RULES.md)

---

## 🆘 Need Help?

### Question: Which file is the "source of truth"?
**Answer**: `packages/agents/src/agents/commerce/buy-and-sell/agent.ts`

### Question: Can I modify `wa-webhook-buy-sell/agent.ts`?
**Answer**: No, extract logic to shared agent first, then delete or make it a thin wrapper.

### Question: What slug should I use in the database?
**Answer**: `buy_sell` (no underscore in "and")

### Question: What about the menu keys?
**Answer**: Two keys:
- `buy_sell_categories` - Category selection workflow
- `business_broker_agent` - AI chat interface

### Question: Which model should I use?
**Answer**: Use constant from `config.ts`: `BUY_SELL_DEFAULT_MODEL = 'gemini-1.5-flash'`

### Question: How do I test locally?
**Answer**:
```bash
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build
pnpm build
pnpm exec vitest run
```

---

**Last Updated**: 2025-12-10  
**Status**: 🔴 Awaiting Implementation
