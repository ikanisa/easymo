# AI Agent Cleanup Summary

**Date**: 2025-12-15  
**Status**: In Progress

## ✅ Completed

1. **Agent Collaboration** (`_shared/ai-agents/agent-collaboration.ts`)
   - ✅ Removed `mobility` and `insurance` agents from registry
   - ✅ Kept only `buy_sell` agent
   - ✅ Removed console.error

2. **AI Agent Orchestrator** (`_shared/ai-agent-orchestrator.ts`)
   - ✅ Updated `AgentConfig` type to only include `buy_sell` and `marketplace`
   - ✅ Removed all other agent configs (waiter, real_estate, job_board, mobility, wallet)
   - ✅ Updated default config to use `buy_sell`

3. **Buy and Sell Files**
   - ✅ Updated `show_ai_welcome.ts` to use `buy_sell` agent type instead of `business_broker`
   - ✅ Updated `my-business/list.ts` to reference "Buy & Sell AI" instead of "Business Broker AI Agent"

4. **Button IDs**
   - ✅ Removed `FARMER_AGENT`, `FARMER_AGENT_SUPPLY`, `FARMER_AGENT_DEMAND`, `GENERAL_BROKER` from `wa-webhook-mobility/wa/ids.ts`
   - ✅ Removed all agent IDs except `BUSINESS_BROKER_AGENT` (aliased to `buy_sell`) from `_shared/wa-webhook-shared/wa/ids.ts`
   - ✅ Removed waiter agent IDs

5. **Menu Configuration**
   - ✅ Updated `dynamic_home_menu.ts` to reflect only `buy_sell` as AI agent
   - ✅ Updated `HOME_MENU_KEY_ALIASES` to route all legacy agent keys to appropriate services
   - ✅ Updated menu key mappings

6. **LLM Router**
   - ✅ Updated `general-broker` reference to also match `buy_sell`

## ⏳ Remaining Tasks

1. **i18n Messages** - Remove agent-specific messages
   - Files in `wa-webhook-mobility/i18n/messages/`
   - Files in `_shared/wa-webhook-shared/i18n/messages/`
   - Remove: `farmerAgent`, `generalBroker`, `waiterAgent`, `realEstateAgent`, `jobsAgent`, etc.

2. **Route Configs** - Verify all routes point correctly
   - `_shared/route-config.ts` - Already correct (only buy_sell references)

3. **Agent Orchestrator** (`_shared/agent-orchestrator.ts`)
   - Review and clean up if needed

4. **Other Files**
   - Check for any remaining agent references in other files

## ✅ Only Agent Remaining

**Buy & Sell AI Agent**
- Location: `supabase/functions/wa-webhook-buy-sell/core/agent.ts`
- Class: `MarketplaceAgent`
- Aliases: `buy_sell`, `buy_and_sell`, `business_broker_agent`, `buy_and_sell_agent`

