# Waiter AI Implementation - Gap Analysis & Action Plan

## Current Status Review

### ✅ Already Implemented

#### Database Tables

- ✅ **conversations** - Chat sessions (RLS enabled)
- ✅ **messages** - Chat history (RLS enabled)
- ✅ **draft_orders** - Cart management (RLS enabled)
- ✅ **draft_order_items** - Cart items (RLS enabled)
- ✅ **wine_pairings** - Wine recommendations (RLS enabled)
- ✅ **reservations** - Table bookings (RLS enabled)

#### Edge Functions

- ✅ **agent-chat** - Exists but designed for admin panel (broker/support/sales agents)
  - NOT designed for Waiter AI specifically
  - Uses different schema (agent_chat_sessions, agent_chat_messages)
  - Integrates with Agent-Core service
  - Has admin authentication

#### Frontend (waiter-pwa/)

- ✅ Complete PWA with 7 views (~2,078 LOC)
- ✅ All UI components built
- ✅ Contexts for Chat, Cart, Supabase
- ✅ Real-time subscriptions
- ✅ Multi-language (EN, FR)

---

## ❌ Missing Critical Components

### 1. Database Tables

#### Missing Core Tables:

```sql
-- ❌ users table (referenced in spec but missing)
-- ❌ menu_items table (may exist but need to verify structure)
-- ❌ orders table (for completed orders)
-- ❌ order_items table (for order line items)
-- ❌ feedback table (for post-order feedback)
```

#### Missing Payment Tables:

```sql
-- ❌ payments table (for payment tracking)
-- ❌ payment_methods table (user saved payment methods)
```

### 2. Edge Functions

#### Missing Waiter-Specific Functions:

```typescript
// ❌ waiter-ai-agent/index.ts - Dedicated Waiter AI function
//    - Should handle: menu search, cart, orders, wine pairing, reservations, feedback
//    - OpenAI integration with streaming
//    - Tool calling for waiter-specific actions

// ❌ send_order/index.ts - Order creation and kitchen notification
// ❌ momo_charge/index.ts - Mobile Money payment integration
// ❌ revolut_charge/index.ts - Revolut payment integration
```

### 3. Shared Utilities

```typescript
// ❌ supabase/functions/_shared/waiter-tools.ts - Tool definitions
// ❌ supabase/functions/_shared/waiter-prompts.ts - System prompts
```

---

## 📋 Implementation Plan

### Phase 1: Database Completion (30 min)

**File**: `supabase/migrations/20241114000000_waiter_ai_complete_schema.sql`

```sql
BEGIN;

-- 1. Users table (if not exists from auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Menu items (enhanced)
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID,
  category_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  image_url TEXT,
  tags TEXT[],
  dietary_info JSONB DEFAULT '{}',  -- vegan, gluten-free, etc.
  available BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Menu categories
CREATE TABLE IF NOT EXISTS menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Orders (completed orders)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID,
  table_number TEXT,
  status TEXT DEFAULT 'pending',  -- pending, confirmed, preparing, ready, completed, cancelled
  total_amount NUMERIC(10, 2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  special_requests TEXT,
  estimated_time INTEGER,  -- minutes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Order items
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(10, 2) NOT NULL,
  options JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  method TEXT NOT NULL,  -- momo, revolut, card
  status TEXT DEFAULT 'pending',  -- pending, processing, successful, failed
  provider_transaction_id TEXT,
  provider_response JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 7. Feedback
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  categories JSONB DEFAULT '{}',  -- food_quality, service, ambiance, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view available menu items"
  ON menu_items FOR SELECT
  USING (available = true);

CREATE POLICY "Anyone can view menu categories"
  ON menu_categories FOR SELECT
  USING (true);

CREATE POLICY "Users can view their orders"
  ON orders FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can create orders"
  ON orders FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can update their orders"
  ON orders FOR UPDATE
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can view their order items"
  ON order_items FOR SELECT
  USING (order_id IN (SELECT id FROM orders WHERE user_id = auth.uid() OR user_id IS NULL));

CREATE POLICY "Users can view their payments"
  ON payments FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can manage their feedback"
  ON feedback FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_menu_items_restaurant ON menu_items(restaurant_id);
CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_menu_items_available ON menu_items(available);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_feedback_order_id ON feedback(order_id);

-- Full-text search on menu
CREATE INDEX idx_menu_items_fts
  ON menu_items USING gin(to_tsvector('english', name || ' ' || coalesce(description, '')));

-- Triggers
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
```

### Phase 2: Waiter AI Edge Function (1-2 hours)

**File**: `supabase/functions/waiter-ai-agent/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://deno.land/x/openai@v4.20.0/mod.ts";
import { logStructuredEvent } from "../_shared/observability.ts";

const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY")! });
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const SYSTEM_PROMPT = `You are Waiter AI, a world-class multi-lingual restaurant assistant.
You help customers with:
- Menu browsing and search
- Dietary recommendations and allergen information
- Order management (add, update, cancel)
- Wine pairing suggestions
- Table reservations
- Post-order feedback collection
- Real-time order status updates

You are friendly, professional, and always clarify ambiguous requests.
You detect user frustration and offer to escalate to human staff.
You NEVER reveal sensitive information.
Always respond in the user's selected language.

Current context: {language: "${language}", venue: "${venueId}", table: "${tableNumber}"}`;

// Tool definitions
const tools = [
  {
    type: "function",
    function: {
      name: "search_menu",
      description: "Search restaurant menu items by name, description, or dietary requirements",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          dietary: {
            type: "string",
            enum: ["vegan", "vegetarian", "gluten-free", "dairy-free", ""],
            description: "Dietary filter",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_to_cart",
      description: "Add menu item to user's cart",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "string" },
          quantity: { type: "number", minimum: 1 },
          options: { type: "object", description: "Special requests or customizations" },
        },
        required: ["itemId", "quantity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_order",
      description: "Update an existing order (add/remove items)",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string" },
          addItems: {
            type: "array",
            items: {
              type: "object",
              properties: {
                itemId: { type: "string" },
                quantity: { type: "number" },
              },
            },
          },
          removeItems: { type: "array", items: { type: "string" } },
          specialRequests: { type: "string" },
        },
        required: ["orderId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_order",
      description: "Cancel a user's order",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string" },
        },
        required: ["orderId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "recommend_wine",
      description: "Recommend wine pairings for a dish",
      parameters: {
        type: "object",
        properties: {
          dish: { type: "string" },
        },
        required: ["dish"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_table",
      description: "Make a table reservation",
      parameters: {
        type: "object",
        properties: {
          datetime: { type: "string", format: "date-time" },
          partySize: { type: "number", minimum: 1 },
          specialRequests: { type: "string" },
        },
        required: ["datetime", "partySize"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "submit_feedback",
      description: "Submit post-order feedback and rating",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string" },
          rating: { type: "number", minimum: 1, maximum: 5 },
          comment: { type: "string" },
          categories: {
            type: "object",
            description: "Ratings for food_quality, service, ambiance, value",
          },
        },
        required: ["orderId", "rating"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_order_status",
      description: "Check the status of an order",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string" },
        },
        required: ["orderId"],
      },
    },
  },
];

// Tool handlers
async function handleToolCall(name: string, args: any, context: any) {
  await logStructuredEvent("WAITER_TOOL_CALL", { tool: name, args, context });

  try {
    switch (name) {
      case "search_menu": {
        let query = supabase.from("menu_items").select("*").eq("available", true);

        if (args.query) {
          query = query.textSearch("name,description", args.query);
        }

        if (args.dietary) {
          query = query.contains("dietary_info", { [args.dietary]: true });
        }

        const { data, error } = await query.limit(10);
        if (error) throw error;

        return { results: data || [], count: data?.length || 0 };
      }

      case "add_to_cart": {
        // Get item details
        const { data: item, error: itemError } = await supabase
          .from("menu_items")
          .select("*")
          .eq("id", args.itemId)
          .single();

        if (itemError) throw itemError;
        if (!item) return { error: "Menu item not found" };

        // Add to draft orders
        const { error } = await supabase.from("draft_order_items").insert({
          user_id: context.userId,
          menu_item_id: args.itemId,
          quantity: args.quantity,
          price: item.price,
          options: args.options || {},
        });

        if (error) throw error;

        return {
          success: true,
          item: item.name,
          quantity: args.quantity,
          subtotal: item.price * args.quantity,
        };
      }

      case "update_order": {
        // Update order items
        const { error } = await supabase
          .from("orders")
          .update({
            special_requests: args.specialRequests,
            updated_at: new Date().toISOString(),
          })
          .eq("id", args.orderId)
          .eq("user_id", context.userId);

        if (error) throw error;

        // Handle add/remove items logic here
        return { success: true, orderId: args.orderId };
      }

      case "cancel_order": {
        const { error } = await supabase
          .from("orders")
          .update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("id", args.orderId)
          .eq("user_id", context.userId);

        if (error) throw error;

        return { success: true, cancelled: true };
      }

      case "recommend_wine": {
        const { data, error } = await supabase
          .from("wine_pairings")
          .select("*")
          .textSearch("dish", args.dish)
          .limit(5);

        if (error) throw error;

        return { recommendations: data || [] };
      }

      case "book_table": {
        const { data, error } = await supabase
          .from("reservations")
          .insert({
            user_id: context.userId,
            restaurant_id: context.venueId,
            datetime: args.datetime,
            party_size: args.partySize,
            special_requests: args.specialRequests,
            status: "pending",
          })
          .select()
          .single();

        if (error) throw error;

        return { reservation: data, confirmed: true };
      }

      case "submit_feedback": {
        const { error } = await supabase.from("feedback").insert({
          order_id: args.orderId,
          user_id: context.userId,
          rating: args.rating,
          comment: args.comment,
          categories: args.categories || {},
        });

        if (error) throw error;

        return { success: true, thankyou: true };
      }

      case "get_order_status": {
        const { data, error } = await supabase
          .from("orders")
          .select("*, order_items(*)")
          .eq("id", args.orderId)
          .eq("user_id", context.userId)
          .single();

        if (error) throw error;

        return { order: data };
      }

      default:
        return { error: "Unknown tool" };
    }
  } catch (error) {
    await logStructuredEvent("WAITER_TOOL_ERROR", { tool: name, error: error.message });
    return { error: error.message };
  }
}

// Main handler
serve(async (req) => {
  try {
    const { action, conversationId, userId, message, language, metadata } = await req.json();

    await logStructuredEvent("WAITER_AI_REQUEST", {
      action,
      conversationId,
      userId,
      language,
    });

    // Start conversation
    if (action === "start_conversation") {
      const { data: conversation, error } = await supabase
        .from("conversations")
        .insert({
          user_id: userId,
          language,
          metadata,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      const welcomeMessages = {
        en: "Hello! I'm your virtual waiter. How may I assist you today?",
        fr: "Bonjour! Je suis votre serveur virtuel. Comment puis-je vous aider aujourd'hui?",
        es: "¡Hola! Soy su camarero virtual. ¿Cómo puedo ayudarle hoy?",
      };

      return new Response(
        JSON.stringify({
          conversationId: conversation.id,
          welcomeMessage:
            welcomeMessages[language as keyof typeof welcomeMessages] || welcomeMessages.en,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Send message
    if (action === "send_message") {
      // Save user message
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender: "user",
        content: message,
        timestamp: new Date().toISOString(),
      });

      // Get conversation history
      const { data: messages } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("timestamp", { ascending: true })
        .limit(20);

      const chatMessages =
        messages?.map((m) => ({
          role: m.sender === "user" ? "user" : "assistant",
          content: m.content,
        })) || [];

      // Call OpenAI with streaming
      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...chatMessages,
          { role: "user", content: message },
        ],
        tools,
        stream: true,
      });

      // Stream response
      const stream = new ReadableStream({
        async start(controller) {
          let fullResponse = "";
          let toolCalls: any[] = [];

          for await (const chunk of response) {
            const delta = chunk.choices[0].delta;

            if (delta.content) {
              fullResponse += delta.content;
              controller.enqueue(new TextEncoder().encode(delta.content));
            }

            if (delta.tool_calls) {
              toolCalls.push(...delta.tool_calls);
            }
          }

          // Handle tool calls
          if (toolCalls.length > 0) {
            for (const toolCall of toolCalls) {
              const args = JSON.parse(toolCall.function.arguments);
              const result = await handleToolCall(toolCall.function.name, args, {
                userId,
                conversationId,
                venueId: metadata?.venue,
                tableNumber: metadata?.table,
              });

              // Get final response with tool result
              const finalResponse = await openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
                messages: [
                  ...chatMessages,
                  { role: "user", content: message },
                  {
                    role: "function",
                    name: toolCall.function.name,
                    content: JSON.stringify(result),
                  },
                ],
              });

              fullResponse = finalResponse.choices[0].message.content || fullResponse;
            }
          }

          // Save assistant response
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            sender: "assistant",
            content: fullResponse,
            timestamp: new Date().toISOString(),
          });

          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    await logStructuredEvent("WAITER_AI_ERROR", { error: error.message });

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
```

### Phase 3: Payment Functions (1 hour each)

**Files needed**:

- `supabase/functions/send_order/index.ts`
- `supabase/functions/momo_charge/index.ts`
- `supabase/functions/revolut_charge/index.ts`

### Phase 4: Testing & Documentation (1 hour)

- E2E tests for complete flow
- API documentation
- Deployment guide

---

## Priority Ranking

1. **CRITICAL** - Database schema completion (Phase 1)
2. **CRITICAL** - Waiter AI edge function (Phase 2)
3. **HIGH** - Payment functions (Phase 3)
4. **MEDIUM** - Testing & docs (Phase 4)

---

## Next Steps

1. Run Phase 1 migration to complete database schema
2. Implement Phase 2 waiter-ai-agent function
3. Test end-to-end with PWA frontend
4. Implement payment functions
5. Full E2E testing

**Estimated Total Time**: 4-6 hours for full implementation
