# AI Agent Cleanup Plan

**Date**: 2025-12-15  
**Goal**: Remove all references to AI agents except "Buy and Sell AI Agent"

## ✅ Only Agent: Buy and Sell AI Agent
- **Location**: `supabase/functions/wa-webhook-buy-sell/core/agent.ts`
- **Class**: `MarketplaceAgent`
- **Aliases**: `buy_sell`, `buy_and_sell`, `business_broker_agent`, `buy_and_sell_agent`

## ❌ Agents to Remove References:
1. Farmer Agent (`farmer_agent`)
2. Waiter Agent (`waiter_agent`)
3. Real Estate Agent (`real_estate_agent`)
4. General Broker Agent (`general_broker`)
5. Business Broker Agent (`business_broker_agent`) - merge into Buy and Sell
6. Jobs Agent (`jobs_agent`)
7. Sales Agent (`sales_agent`)
8. Insurance Agent (`insurance_agent`) - not an AI agent, it's a workflow
9. Rides Agent (`rides_agent`) - not an AI agent, it's a workflow

## Files to Clean Up:

### 1. Route Configs
- `supabase/functions/_shared/route-config.ts` - Remove agent references
- `supabase/functions/_shared/wa-webhook-shared/domains/menu/dynamic_home_menu.ts` - Remove agent menu keys

### 2. Button IDs
- `supabase/functions/wa-webhook-mobility/wa/ids.ts` - Remove farmer, general_broker IDs
- `supabase/functions/_shared/wa-webhook-shared/wa/ids.ts` - Remove all agent IDs except buy_sell

### 3. Agent Orchestrators
- `supabase/functions/_shared/ai-agents/agent-collaboration.ts` - Remove all agents except buy_sell
- `supabase/functions/_shared/ai-agent-orchestrator.ts` - Remove agent type references
- `supabase/functions/_shared/agent-orchestrator.ts` - Review and clean

### 4. Buy and Sell Files
- `supabase/functions/wa-webhook-buy-sell/show_ai_welcome.ts` - Update to use buy_sell agent type
- `supabase/functions/wa-webhook-buy-sell/my-business/list.ts` - Update references

### 5. i18n Messages
- Remove all agent-specific messages except buy_sell
- Files in `supabase/functions/wa-webhook-mobility/i18n/messages/`
- Files in `supabase/functions/_shared/wa-webhook-shared/i18n/messages/`

### 6. Other Files
- `supabase/functions/_shared/llm-router.ts` - Remove agent routing
- Any other files referencing agents

## Action Plan:
1. ✅ Review Buy and Sell agent implementation
2. ⏳ Remove agent references from route configs
3. ⏳ Remove agent button IDs
4. ⏳ Clean up agent orchestrators
5. ⏳ Update Buy and Sell files
6. ⏳ Clean up i18n messages
7. ⏳ Verify only Buy and Sell agent remains

