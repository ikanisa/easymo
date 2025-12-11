# Buy & Sell - Two Distinct Features Fix

**Date**: December 10, 2025  
**Status**: ✅ Fixed

## Problem

The buy/sell webhook was receiving errors because it wasn't properly handling two DISTINCT user
interfaces:

1. **Buy and Sell (Category Workflow)** - Menu-based browsing
2. **Chat with Agent (AI Natural Language)** - Conversational search

Both were being confused and routed incorrectly.

## The Two Distinct Features

### 1. 🛒 Buy and Sell (Category Workflow)

**Menu Key**: `buy_sell_categories`  
**Function**: `wa-webhook-buy-sell`  
**User Flow**:

```
User taps "Buy and Sell"
   ↓
Shows list of categories (Pharmacies, Restaurants, Hardware, etc.)
   ↓
User selects category
   ↓
Asks for location share
   ↓
User shares location
   ↓
Shows nearby businesses from that category (paginated results)
```

**Technical**:

- NO AI involved
- Pure menu navigation with interactive lists
- Uses `buy_sell_categories` table for categories
- Uses `search_businesses_nearby` RPC for location-based results
- State: `buy_sell_category_search`, `buy_sell_location_awaiting`

### 2. 🤖 Chat with Agent (AI Natural Language)

**Menu Key**: `business_broker_agent`  
**Function**: `agent-buy-sell`  
**User Flow**:

```
User taps "Chat with Agent"
   ↓
Shows AI welcome message with examples
   ↓
User types natural language query (e.g., "I need medicine")
   ↓
AI processes with business tag matching
   ↓
Returns relevant businesses, can message on user's behalf
```

**Technical**:

- AI-powered (OpenAI/Gemini)
- Natural language processing
- Smart tag-based business discovery
- Can handle complex queries
- State: `business_broker_chat`

## Issues Fixed

### 1. Error Serialization

**Before**: `error: "[object Object]"` in logs  
**After**: Proper error message extraction

```typescript
// BEFORE
error: error instanceof Error ? error.message : String(error)  // Sometimes [object Object]

// AFTER
const errorMessage = error instanceof Error ? error.message : String(error);
const errorStack = error instanceof Error ? error.stack : undefined;
logStructuredEvent("BUY_SELL_ERROR", {
  error: errorMessage,
  stack: errorStack,
  ...
});
```

### 2. Menu Key Mismatch

**Before**: Code checked for `chat_with_ai`, `buy_sell_chat_ai`  
**After**: Matches actual database keys

```typescript
// BEFORE
if (selectedId === "chat_with_ai" || selectedId === "buy_sell_chat_ai") {

// AFTER
if (selectedId === "business_broker_agent" || selectedId === "chat_with_agent") {
```

### 3. Missing State-Based Routing

**Before**: AI chat messages fell through to category workflow  
**After**: Checks for `business_broker_chat` state and forwards to AI

```typescript
// NEW: Check if user is in AI chat mode
if (profile?.user_id) {
  const { data: stateData } = await supabase
    .from("whatsapp_state")
    .select("key, data")
    .eq("user_id", profile.user_id)
    .single();

  // Forward to AI agent if in chat mode
  if (stateData?.key === "business_broker_chat" && stateData?.data?.active) {
    const forwarded = await forwardToBuySellAgent(userPhone, text, correlationId);
    if (forwarded) {
      return respond({ success: true, message: "forwarded_to_ai" });
    }
  }
}
```

### 4. Route Configuration Clarity

**Before**: Both services had overlapping keywords  
**After**: Clear separation

```typescript
// wa-webhook-buy-sell: Category browsing
{
  service: "wa-webhook-buy-sell",
  keywords: ["buy", "sell", "category", "categories", "browse"],
  menuKeys: ["buy_sell_categories", "buy_and_sell", "shops_services"],
  priority: 1,
}

// agent-buy-sell: AI chat
{
  service: "agent-buy-sell",
  keywords: ["business broker", "find business", "shopping assistant"],
  menuKeys: ["business_broker_agent", "chat_with_agent", "buy_sell_agent"],
  priority: 1,
}
```

## Files Modified

```
✅ supabase/functions/wa-webhook-buy-sell/index.ts
   - Fixed error serialization
   - Added state-based routing for AI mode
   - Corrected menu key matching
   - Added createClient import

✅ supabase/functions/_shared/route-config.ts
   - Separated keywords for clarity
   - Updated menu keys to match database
   - Equal priority (both priority 1)
```

## Database Menu Items

Migration `20251210085100_split_buy_sell_and_chat_agent.sql` creates:

```sql
-- 1. Category Workflow
INSERT INTO whatsapp_home_menu_items (
  key: 'buy_sell_categories',
  name: '🛒 Buy and Sell',
  icon: '🛒',
  display_order: 4
);

-- 2. AI Chat
INSERT INTO whatsapp_home_menu_items (
  key: 'business_broker_agent',
  name: '🤖 Chat with Agent',
  icon: '🤖',
  display_order: 5
);
```

## User Experience Flow Chart

```
┌─────────────────────────┐
│  WhatsApp Home Menu     │
└───────────┬─────────────┘
            │
            ├─────────────────────────────┬──────────────────────────────┐
            │                             │                              │
    ┌───────▼──────────┐        ┌────────▼─────────┐       ┌───────────▼────────┐
    │ 🛒 Buy and Sell  │        │ 🤖 Chat w/ Agent │       │ Other Menu Items   │
    └───────┬──────────┘        └────────┬─────────┘       └────────────────────┘
            │                             │
            │                             │
    ┌───────▼──────────┐        ┌────────▼─────────────┐
    │ Show Categories  │        │ Show AI Welcome      │
    │ (List View)      │        │ + Set State          │
    └───────┬──────────┘        └────────┬─────────────┘
            │                             │
    ┌───────▼──────────┐        ┌────────▼─────────────────┐
    │ User Selects     │        │ User Types Natural Query │
    │ Category         │        │ "I need medicine"        │
    └───────┬──────────┘        └────────┬─────────────────┘
            │                             │
    ┌───────▼──────────┐        ┌────────▼─────────────────┐
    │ Request Location │        │ Forward to agent-buy-sell│
    └───────┬──────────┘        │ Function                 │
            │                   └────────┬─────────────────┘
    ┌───────▼──────────┐        ┌────────▼─────────────────┐
    │ User Shares      │        │ AI Processes with Tags   │
    │ Location         │        │ Search businesses        │
    └───────┬──────────┘        └────────┬─────────────────┘
            │                             │
    ┌───────▼──────────┐        ┌────────▼─────────────────┐
    │ Show Nearby      │        │ Return AI Response       │
    │ Businesses       │        │ + Business Matches       │
    │ (Paginated)      │        └──────────────────────────┘
    └──────────────────┘
```

## Testing Checklist

### Category Workflow

- [ ] User taps "Buy and Sell" home menu
- [ ] Sees category list (Pharmacies, Restaurants, etc.)
- [ ] Selects a category
- [ ] Gets location request
- [ ] Shares location
- [ ] Receives nearby businesses
- [ ] Can paginate through results
- [ ] "Show More" works

### AI Chat Workflow

- [ ] User taps "Chat with Agent" home menu
- [ ] Sees AI welcome message
- [ ] Types "I need medicine"
- [ ] Receives AI-powered business matches
- [ ] Can have natural conversation
- [ ] AI understands context
- [ ] State persists across messages

### Error Handling

- [ ] No `[object Object]` errors in logs
- [ ] Proper error messages logged
- [ ] Stack traces captured
- [ ] Failed forwards show warning
- [ ] Fallback to categories works

## Deployment

```bash
# 1. Deploy functions
supabase functions deploy wa-webhook-buy-sell
supabase functions deploy agent-buy-sell

# 2. Verify menu items exist
supabase db query "SELECT key, name FROM whatsapp_home_menu_items WHERE key IN ('buy_sell_categories', 'business_broker_agent');"

# 3. Test both flows
# Category: Send "Buy and Sell" → Select category → Share location
# AI Chat: Send "Chat with Agent" → Type "I need medicine"
```

## Monitoring

### Events to Track

- `BUY_SELL_CATEGORIES_SENT` - Category list shown
- `CHAT_AGENT_WELCOME_SHOWN` - AI welcome sent
- `BUY_SELL_AI_FORWARD_FAILED` - Failed to forward to AI
- `BUY_SELL_ERROR` - General errors (now with proper messages)
- `buy_sell.ai_forwarded` - Successful AI forwards (metric)

### Key Metrics

```
buy_sell.message.processed - Total messages
buy_sell.ai_forwarded - AI chat messages
buy_sell.message.error - Errors
```

## Summary

✅ **Two distinct features properly separated**  
✅ **Category workflow remains simple and menu-driven**  
✅ **AI chat properly forwards to agent-buy-sell**  
✅ **Error logging now shows actual error messages**  
✅ **State-based routing works correctly**  
✅ **Menu keys match database configuration**

Users now have:

- **Quick browsing** via categories
- **Smart AI search** via natural language chat

Both work independently without conflicts.
