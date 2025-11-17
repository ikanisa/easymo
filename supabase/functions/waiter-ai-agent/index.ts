import { detectLanguage, translateText } from "../_shared/multilingual-utils.ts";
import { transcribeAudio, textToSpeech, downloadWhatsAppAudio, uploadWhatsAppMedia } from "../_shared/voice-handler.ts";
// =====================================================
// WAITER AI AGENT - Complete Edge Function
// =====================================================
// Full-featured AI agent for restaurant ordering with:
// - Multi-language support (EN, FR, ES, PT, DE)
// - Streaming responses
// - Function calling (menu search, cart, wine recommendations, reservations, feedback)
// - Error handling & observability
// =====================================================

import { serve } from "$std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://deno.land/x/openai@v4.20.0/mod.ts";
import { logStructuredEvent } from "../_shared/observability.ts";

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY")!,
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const healthMetrics = {
  success: 0,
  failure: 0,
  latencyMsTotal: 0,
};

function renderHealthMetrics(service: string): string {
  return [
    `agent_health_checks_total{service="${service}",status="success"} ${healthMetrics.success}`,
    `agent_health_checks_total{service="${service}",status="failure"} ${healthMetrics.failure}`,
    `agent_health_latency_ms_sum{service="${service}"} ${healthMetrics.latencyMsTotal}`,
  ].join("\n");
}

// =====================================================
// CONFIG & HELPERS
// =====================================================

const ADMIN_INTERNAL_TOKEN = Deno.env.get("EASYMO_ADMIN_TOKEN") ?? "";

type Guardrails = {
  payment_limits?: { currency?: string; max_per_txn?: number };
  pii_minimization?: boolean;
  never_collect_card?: boolean;
  allergy_check?: boolean;
};

async function loadAgentGuardrails(): Promise<Guardrails> {
  try {
    const { data, error } = await supabase
      .from("agent_registry")
      .select("guardrails, slug")
      .eq("slug", "waiter-ai")
      .maybeSingle();
    if (error) throw error;
    return (data?.guardrails as Guardrails) || {};
  } catch (_) {
    return {};
  }
}

function containsCardPAN(text: string): boolean {
  const digits = text.replace(/\D/g, "");
  // Very rough: 13–19 consecutive digits heuristic
  return /\b\d{13,19}\b/.test(digits);
}

function currencyForCountryCode(code?: string | null): string {
  switch ((code || "").toUpperCase()) {
    case "RW":
      return "RWF";
    case "MT":
      return "EUR";
    case "CA":
      return "CAD";
    default:
      return "RWF";
  }
}

async function enforcePolicy(
  guardrails: Guardrails,
  toolName: string,
  args: any,
): Promise<{ allowed: boolean; reason?: string }> {
  // Payment ceilings
  if (toolName === "initiate_payment" && guardrails?.payment_limits) {
    const limit = guardrails.payment_limits.max_per_txn ?? 200000;
    const amount = Number(args?.amount ?? 0);
    if (amount > limit) {
      return { allowed: false, reason: `Payment exceeds limit (${limit}).` };
    }
  }
  return { allowed: true };
}

async function promoteDraftToOrder(userId: string, conversationId?: string | null, restaurantId?: string | null, currency?: string) {
  // Find draft order
  const { data: draft } = await supabase
    .from("draft_orders")
    .select("id, subtotal, tax, total, metadata")
    .eq("user_id", userId)
    .eq("status", "draft")
    .maybeSingle();
  if (!draft) return { error: "No draft order to finalize" };

  const { data: items } = await supabase
    .from("draft_order_items")
    .select("menu_item_id, quantity, unit_price, total_price")
    .eq("draft_order_id", draft.id);

  // Compute
  const subtotal = (items || []).reduce((s, i) => s + Number(i.total_price || 0), 0);
  const tax = subtotal * 0.1;
  const total = subtotal + tax;

  // Resolve currency if not provided
  let cur = currency || "RWF";
  if (!currency && conversationId) {
    const { data: conv } = await supabase
      .from("waiter_conversations")
      .select("metadata")
      .eq("id", conversationId)
      .maybeSingle();
    const countryCode = (conv?.metadata as any)?.countryCode || (conv?.metadata as any)?.country_code || null;
    cur = currencyForCountryCode(countryCode);
  }

  // Create waiter_orders
  const { data: order, error: orderErr } = await supabase
    .from("waiter_orders")
    .insert({
      user_id: userId,
      conversation_id: conversationId || null,
      restaurant_id: restaurantId || null,
      status: "pending",
      payment_status: "pending",
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      currency: cur,
      metadata: draft.metadata || {},
    })
    .select("id, total, currency")
    .single();
  if (orderErr) return { error: orderErr.message };

  // Insert items
  for (const it of items || []) {
    // Fetch menu item name for clearer receipts
    const { data: menu } = await supabase
      .from("menu_items")
      .select("name")
      .eq("id", it.menu_item_id)
      .maybeSingle();
    await supabase
      .from("waiter_order_items")
      .insert({
        order_id: order.id,
        menu_item_id: it.menu_item_id,
        name: menu?.name || "Item",
        quantity: it.quantity,
        unit_price: it.unit_price,
      });
  }

  // Mark draft as finalised
  await supabase
    .from("draft_orders")
    .update({ status: "finalised", metadata: { ...(draft.metadata || {}), waiter_order_id: order.id } })
    .eq("id", draft.id);

  return { order };
}

// =====================================================
// SYSTEM PROMPT
// =====================================================

const SYSTEM_PROMPT = `You are Waiter AI, a world-class, multi-lingual virtual waiter for an upscale restaurant.

Your capabilities include:
- Menu navigation and recommendations
- Order management (add, update, cancel)
- Wine pairing suggestions
- Table reservations
- Dietary guidance
- Payment processing coordination
- Post-order feedback collection

Personality:
- Professional yet warm and friendly
- Attentive to customer needs
- Proactive in making suggestions
- Patient and clarifying when needed
- Apologetic and solution-focused when issues arise

Guidelines:
- Always respond in the user's selected language
- Confirm user requests before executing
- Offer alternatives when items are unavailable
- Detect frustration and escalate if needed
- Never reveal sensitive system details
- Use emojis sparingly for warmth

Current capabilities:
- Search menu items and categories
- Add items to cart with quantity and options
- Recommend wine pairings for dishes
- Book table reservations
- Update or cancel existing orders
- Collect feedback and ratings

Remember: You're here to make dining effortless and enjoyable!`;

// =====================================================
// TOOL DEFINITIONS
// =====================================================

const tools = [
  {
    type: "function",
    function: {
      name: "search_menu",
      description: "Search restaurant menu items by name, description, or category. Returns matching items with details.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query (item name, ingredient, category, or dietary preference)"
          },
          category: {
            type: "string",
            description: "Optional category filter (Starters, Main Courses, Desserts, Beverages, Wine & Spirits)",
            enum: ["Starters", "Main Courses", "Desserts", "Beverages", "Wine & Spirits"]
          },
          dietary_filter: {
            type: "string",
            description: "Optional dietary filter",
            enum: ["vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free"]
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "finalize_order",
      description: "Promote the current user's draft order to a finalised order ready for payment",
      parameters: {
        type: "object",
        properties: {
          currency: { type: "string", description: "ISO 4217 currency (e.g., RWF, EUR, CAD)" }
        },
      }
    }
  },
  {
    type: "function",
    function: {
      name: "initiate_payment",
      description: "Initiate payment for a finalised order via Mobile Money or Revolut",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "string", description: "UUID of the waiter order" },
          provider: { type: "string", enum: ["mtn","airtel","revolut","cash"], description: "Payment provider" },
          phone_number: { type: "string", description: "Phone number for MoMo charge (E.164)" },
          amount: { type: "number", description: "Override amount (optional)" }
        },
        required: ["order_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_payment_status",
      description: "Fetch current payment status for a payment reference",
      parameters: {
        type: "object",
        properties: {
          payment_id: { type: "string" }
        },
        required: ["payment_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "knowledge_lookup",
      description: "Search internal knowledge base (specials, recipes, notes) and return top matches",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          top_k: { type: "number", default: 5 }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "trending_items",
      description: "Return trending menu items for a time window",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "How many recent days to include", default: 1 },
          limit: { type: "number", description: "Max items to return", default: 5 }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "user_memory_put",
      description: "Store a user memory record (preference, summary, or note)",
      parameters: {
        type: "object",
        properties: {
          domain: { type: "string" },
          memory_type: { type: "string", enum: ["preference","summary","note"], default: "preference" },
          mem_key: { type: "string" },
          mem_value: { type: "object" },
          confidence: { type: "number" }
        },
        required: ["domain","mem_key","mem_value"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "user_memory_get",
      description: "Fetch user memory records by domain and optional key",
      parameters: {
        type: "object",
        properties: {
          domain: { type: "string" },
          mem_key: { type: "string" }
        },
        required: ["domain"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "user_profile_summary",
      description: "Return a summary of the user's dining preferences and favorites for personalization",
      parameters: {
        type: "object",
        properties: {},
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_to_cart",
      description: "Add a menu item to the user's cart with specified quantity and options",
      parameters: {
        type: "object",
        properties: {
          item_id: {
            type: "string",
            description: "UUID of the menu item"
          },
          quantity: {
            type: "number",
            description: "Quantity to add (must be positive)",
            minimum: 1
          },
          options: {
            type: "object",
            description: "Optional customizations (e.g., cooking preference, sides)",
            properties: {
              cooking: { type: "string" },
              sides: { type: "array", items: { type: "string" } },
              extras: { type: "array", items: { type: "string" } }
            }
          },
          special_requests: {
            type: "string",
            description: "Any special preparation instructions"
          }
        },
        required: ["item_id", "quantity"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "recommend_wine",
      description: "Recommend wine pairings for a specific dish",
      parameters: {
        type: "object",
        properties: {
          dish_name: {
            type: "string",
            description: "Name of the dish to pair with wine"
          },
          preference: {
            type: "string",
            description: "Wine preference if specified",
            enum: ["red", "white", "rose", "sparkling", "any"]
          }
        },
        required: ["dish_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "book_table",
      description: "Create a table reservation",
      parameters: {
        type: "object",
        properties: {
          guest_name: {
            type: "string",
            description: "Name for the reservation"
          },
          guest_email: {
            type: "string",
            description: "Email for confirmation"
          },
          guest_phone: {
            type: "string",
            description: "Phone number"
          },
          datetime: {
            type: "string",
            description: "Reservation date and time (ISO 8601 format)"
          },
          party_size: {
            type: "number",
            description: "Number of guests",
            minimum: 1,
            maximum: 20
          },
          special_requests: {
            type: "string",
            description: "Special requests (occasion, seating preference, etc.)"
          }
        },
        required: ["guest_name", "datetime", "party_size"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_order",
      description: "Update an existing draft order (add/remove items)",
      parameters: {
        type: "object",
        properties: {
          order_id: {
            type: "string",
            description: "UUID of the draft order"
          },
          add_items: {
            type: "array",
            description: "Items to add to the order",
            items: {
              type: "object",
              properties: {
                item_id: { type: "string" },
                quantity: { type: "number", minimum: 1 }
              },
              required: ["item_id", "quantity"]
            }
          },
          remove_items: {
            type: "array",
            description: "Item IDs to remove from the order",
            items: { type: "string" }
          }
        },
        required: ["order_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "cancel_order",
      description: "Cancel a user's order (only for pending/draft orders)",
      parameters: {
        type: "object",
        properties: {
          order_id: {
            type: "string",
            description: "UUID of the order to cancel"
          },
          reason: {
            type: "string",
            description: "Reason for cancellation"
          }
        },
        required: ["order_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "submit_feedback",
      description: "Submit post-order feedback and rating",
      parameters: {
        type: "object",
        properties: {
          order_id: {
            type: "string",
            description: "UUID of the completed order"
          },
          rating: {
            type: "number",
            description: "Overall rating (1-5 stars)",
            minimum: 1,
            maximum: 5
          },
          food_rating: {
            type: "number",
            description: "Food quality rating (1-5)",
            minimum: 1,
            maximum: 5
          },
          service_rating: {
            type: "number",
            description: "Service rating (1-5)",
            minimum: 1,
            maximum: 5
          },
          comment: {
            type: "string",
            description: "Optional feedback comment"
          },
          would_recommend: {
            type: "boolean",
            description: "Would recommend to others"
          }
        },
        required: ["order_id", "rating"]
      }
    }
  }
];

// =====================================================
// TOOL HANDLERS
// =====================================================

async function handleToolCall(
  name: string,
  args: any,
  context: { userId: string; conversationId: string; venueId?: string }
) {
  await logStructuredEvent("WAITER_TOOL_CALL", {
    tool: name,
    args: JSON.stringify(args),
    userId: context.userId,
    conversationId: context.conversationId
  });

  try {
    const guardrails = await loadAgentGuardrails();
    const policy = await enforcePolicy(guardrails, name, args);
    if (!policy.allowed) {
      return { success: false, error: policy.reason || "Action not allowed by policy" };
    }
    switch (name) {
      case "search_menu": {
        let query = supabase
          .from("menu_items")
          .select(`
            id,
            name,
            description,
            price,
            image_url,
            tags,
            dietary_info,
            preparation_time,
            category:category_id(name)
          `)
          .eq("available", true);

        // Text search
        if (args.query) {
          query = query.textSearch("name,description", args.query);
        }

        // Category filter
        if (args.category) {
          const { data: category } = await supabase
            .from("menu_categories")
            .select("id")
            .eq("name", args.category)
            .single();

          if (category) {
            query = query.eq("category_id", category.id);
          }
        }

        // Dietary filter
        if (args.dietary_filter) {
          query = query.contains("tags", [args.dietary_filter]);
        }

        const { data, error } = await query.order("sort_order").limit(10);

        if (error) throw error;

        return {
          success: true,
          results: data || [],
          count: data?.length || 0
        };
      }

      case "add_to_cart": {
        // Get menu item details
        const { data: item, error: itemError } = await supabase
          .from("menu_items")
          .select("id, name, description, price, available, tags, dietary_info")
          .eq("id", args.item_id)
          .single();

        if (itemError || !item) {
          return { success: false, error: "Menu item not found" };
        }

        if (!item.available) {
          return { success: false, error: "Item is currently unavailable" };
        }

        // Get or create draft order
        let { data: draftOrder } = await supabase
          .from("draft_orders")
          .select("id")
          .eq("user_id", context.userId)
          .eq("status", "draft")
          .maybeSingle();

        if (!draftOrder) {
          const { data: newOrder, error: orderError } = await supabase
            .from("draft_orders")
            .insert({
              user_id: context.userId,
              conversation_id: context.conversationId,
              status: "draft"
            })
            .select("id")
            .single();

          if (orderError) throw orderError;
          draftOrder = newOrder;
        }

        // Add item to draft order
        const { error: insertError } = await supabase
          .from("draft_order_items")
          .insert({
            draft_order_id: draftOrder.id,
            user_id: context.userId,
            menu_item_id: args.item_id,
            quantity: args.quantity,
            unit_price: item.price,
            options: args.options || {},
            special_requests: args.special_requests
          });

        if (insertError) throw insertError;

        // Calculate new total
        const { data: items } = await supabase
          .from("draft_order_items")
          .select("total_price")
          .eq("draft_order_id", draftOrder.id);

        const subtotal = items?.reduce((sum, i) => sum + parseFloat(i.total_price), 0) || 0;
        const tax = subtotal * 0.1; // 10% tax
        const total = subtotal + tax;

        await supabase
          .from("draft_orders")
          .update({ subtotal, tax, total })
          .eq("id", draftOrder.id);

        // Persist preferences/memory heuristics (best-effort)
        try {
          // Dietary labels from menu item tags
          const tags: string[] = Array.isArray((item as any)?.tags) ? (item as any).tags as string[] : [];
          if (tags.length) {
            const { data: existingDiet } = await supabase
              .from('user_memories')
              .select('id, mem_value')
              .eq('user_id', context.userId)
              .eq('domain', 'waiter')
              .eq('mem_key', 'dietary')
              .maybeSingle();
            const set = new Set<string>(Array.isArray(existingDiet?.mem_value?.labels) ? existingDiet!.mem_value.labels : []);
            for (const t of tags) {
              const low = String(t).toLowerCase();
              if (["vegan","vegetarian","gluten-free","halal","kosher"].includes(low)) set.add(low);
            }
            if (set.size) {
              await supabase.from('user_memories').upsert({
                user_id: context.userId,
                domain: 'waiter',
                memory_type: 'preference',
                mem_key: 'dietary',
                mem_value: { labels: Array.from(set) },
                last_seen: new Date().toISOString(),
              }, { onConflict: 'user_id,domain,mem_key' });
            }
          }

          // Favorite items (increment simple counters)
          const { data: fav } = await supabase
            .from('user_memories')
            .select('id, mem_value')
            .eq('user_id', context.userId)
            .eq('domain', 'waiter')
            .eq('mem_key', 'favorite_items')
            .maybeSingle();
          const list: Array<{ item_id: string; name: string; count: number }> = Array.isArray(fav?.mem_value?.items)
            ? fav!.mem_value.items
            : [];
          const idx = list.findIndex((x) => x.item_id === item.id);
          if (idx >= 0) list[idx].count += args.quantity || 1; else list.push({ item_id: item.id, name: item.name, count: args.quantity || 1 });
          await supabase.from('user_memories').upsert({
            user_id: context.userId,
            domain: 'waiter',
            memory_type: 'summary',
            mem_key: 'favorite_items',
            mem_value: { items: list.slice(0, 50) },
            last_seen: new Date().toISOString(),
          }, { onConflict: 'user_id,domain,mem_key' });

          // Cooking preference and sides from options
          if (args?.options?.cooking) {
            await supabase.from('user_memories').upsert({
              user_id: context.userId,
              domain: 'waiter',
              memory_type: 'preference',
              mem_key: 'cooking_preference',
              mem_value: { value: String(args.options.cooking) },
              last_seen: new Date().toISOString(),
            }, { onConflict: 'user_id,domain,mem_key' });
          }
          if (Array.isArray(args?.options?.sides) && args.options.sides.length) {
            const { data: existingSides } = await supabase
              .from('user_memories')
              .select('id, mem_value')
              .eq('user_id', context.userId)
              .eq('domain', 'waiter')
              .eq('mem_key', 'preferred_sides')
              .maybeSingle();
            const set = new Set<string>(Array.isArray(existingSides?.mem_value?.labels) ? existingSides!.mem_value.labels : []);
            for (const s of args.options.sides) set.add(String(s));
            await supabase.from('user_memories').upsert({
              user_id: context.userId,
              domain: 'waiter',
              memory_type: 'preference',
              mem_key: 'preferred_sides',
              mem_value: { labels: Array.from(set) },
              last_seen: new Date().toISOString(),
            }, { onConflict: 'user_id,domain,mem_key' });
          }
        } catch (_e) {
          // best-effort; do not block add_to_cart on memory errors
        }

        // Allergy note (if tags present)
        let warning: string | undefined;
        const tags = Array.isArray((item as any)?.tags) ? (item as any).tags as string[] : [];
        const risky = ["nuts","shellfish","gluten","dairy","sesame"];
        const found = tags.filter((t) => risky.includes(String(t).toLowerCase()));
        if (found.length) warning = `Allergy note: contains ${found.join(", ")}`;

        return {
          success: true,
          item: {
            name: item.name,
            quantity: args.quantity,
            unit_price: item.price,
            total_price: item.price * args.quantity
          },
          cart_total: total,
          warning
        };
      }

      case "recommend_wine": {
        let query = supabase
          .from("wine_pairings")
          .select("*")
          .eq("active", true)
          .textSearch("dish_name", args.dish_name)
          .order("confidence_score", { ascending: false });

        if (args.preference && args.preference !== "any") {
          query = query.eq("wine_type", args.preference);
        }

        const { data, error } = await query.limit(3);

        if (error) throw error;

        return {
          success: true,
          recommendations: data || [],
          count: data?.length || 0
        };
      }

      case "finalize_order": {
        const currency = typeof args?.currency === "string" ? args.currency : undefined;
        const { order, error } = await promoteDraftToOrder(context.userId, context.conversationId, context.venueId || null, currency);
        if (error || !order) return { success: false, error: error || "Failed to finalize order" };
        // Store memory: last_order_total and timestamp
        await supabase.from('user_memories').upsert({
          user_id: context.userId,
          domain: 'waiter',
          memory_type: 'summary',
          mem_key: 'last_order',
          mem_value: { order_id: order.id, total: order.total, currency: order.currency },
          last_seen: new Date().toISOString(),
        }, { onConflict: 'user_id,domain,mem_key' });
        return { success: true, order };
      }

      case "initiate_payment": {
        // Fetch order
        const { data: order, error: oErr } = await supabase
          .from("waiter_orders")
          .select("id, total, currency, user_id")
          .eq("id", args.order_id)
          .eq("user_id", context.userId)
          .single();
        if (oErr || !order) return { success: false, error: "Order not found" };

        const amount = Number(args?.amount ?? order.total);
        const provider = (args?.provider as string | undefined) || "mtn";
        const phone = (args?.phone_number as string | undefined) || null;

        const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/momo-charge`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Internal server-to-server call; service role is available server-side only
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "x-correlation-id": crypto.randomUUID(),
          },
          body: JSON.stringify({
            orderId: order.id,
            amount,
            currency: order.currency,
            phoneNumber: phone,
            provider,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return { success: false, error: json?.error || `Payment error ${res.status}` };
        return { success: true, payment: json };
      }

      case "get_payment_status": {
        const { data, error } = await supabase
          .from("waiter_payments")
          .select("id, status, order_id, currency, amount, created_at, processed_at, provider_transaction_id")
          .eq("id", args.payment_id)
          .eq("user_id", context.userId)
          .single();
        if (error || !data) return { success: false, error: "Payment not found" };
        return { success: true, payment: data };
      }

      case "knowledge_lookup": {
        const query = String(args?.query || "").slice(0, 512);
        const top_k = Math.max(1, Math.min(20, Number(args?.top_k ?? 5)));
        const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/retrieval-search`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ query, topK: top_k }),
        });
        const json = await res.json().catch(() => ({ results: [] }));
        if (!res.ok) return { success: false, error: json?.error || `retrieval error ${res.status}` };
        return { success: true, results: json?.results ?? [] };
      }

      case "trending_items": {
        const days = Math.max(1, Math.min(30, Number(args?.days ?? 1)));
        const limit = Math.max(1, Math.min(20, Number(args?.limit ?? 5)));
        const { data, error } = await supabase
          .from("menu_item_popularity_daily")
          .select("day, menu_item_id, order_count")
          .gte("day", new Date(Date.now() - days * 86400000).toISOString())
          .order("order_count", { ascending: false })
          .limit(limit);
        if (error) return { success: false, error: error.message };
        // Hydrate names
        const ids = (data || []).map((d: any) => d.menu_item_id);
        const { data: items } = await supabase.from("menu_items").select("id, name, price").in("id", ids);
        const byId = new Map((items || []).map((i: any) => [i.id, i]));
        const enriched = (data || []).map((d: any) => ({
          day: d.day,
          menu_item_id: d.menu_item_id,
          order_count: d.order_count,
          name: byId.get(d.menu_item_id)?.name,
          price: byId.get(d.menu_item_id)?.price,
        }));
        return { success: true, items: enriched };
      }

      case "user_memory_put": {
        const payload = {
          user_id: context.userId,
          domain: String(args?.domain || 'waiter'),
          memory_type: String(args?.memory_type || 'preference'),
          mem_key: String(args?.mem_key || 'unknown'),
          mem_value: args?.mem_value ?? {},
          confidence: typeof args?.confidence === 'number' ? args.confidence : 1.0,
          last_seen: new Date().toISOString(),
        };
        const { data, error } = await supabase
          .from('user_memories')
          .upsert(payload, { onConflict: 'user_id,domain,mem_key' })
          .select('id, domain, mem_key, mem_value, confidence, last_seen')
          .single();
        if (error) return { success: false, error: error.message };
        return { success: true, memory: data };
      }

      case "user_memory_get": {
        const domain = String(args?.domain || 'waiter');
        let query = supabase
          .from('user_memories')
          .select('mem_key, mem_value, memory_type, confidence, last_seen')
          .eq('user_id', context.userId)
          .eq('domain', domain)
          .order('last_seen', { ascending: false });
        if (args?.mem_key) query = query.eq('mem_key', String(args.mem_key));
        const { data, error } = await query.limit(50);
        if (error) return { success: false, error: error.message };
        return { success: true, memories: data || [] };
      }

      case "user_profile_summary": {
        const keys = ['dietary','favorite_items','cooking_preference','preferred_sides'];
        const { data, error } = await supabase
          .from('user_memories')
          .select('mem_key, mem_value')
          .eq('user_id', context.userId)
          .eq('domain', 'waiter')
          .in('mem_key', keys)
          .order('last_seen', { ascending: false });
        if (error) return { success: false, error: error.message };
        const byKey: Record<string, any> = {};
        for (const row of (data || [])) byKey[row.mem_key] = row.mem_value;
        // Build friendly summary
        const fav = (byKey.favorite_items?.items || []) as Array<{ name: string; count: number }>;
        fav.sort((a, b) => (b.count || 0) - (a.count || 0));
        const favorites = fav.slice(0, 5).map((x) => x.name);
        const dietary = (byKey.dietary?.labels || []) as string[];
        const cooking = byKey.cooking_preference?.value as string | undefined;
        const sides = (byKey.preferred_sides?.labels || []) as string[];
        const summaryParts = [] as string[];
        if (dietary.length) summaryParts.push(`Dietary: ${dietary.join(', ')}`);
        if (cooking) summaryParts.push(`Cooking: ${cooking}`);
        if (sides.length) summaryParts.push(`Sides: ${sides.join(', ')}`);
        if (favorites.length) summaryParts.push(`Favorites: ${favorites.join(', ')}`);
        const summary = summaryParts.length ? summaryParts.join(' | ') : 'No saved preferences yet.';
        return { success: true, profile: { dietary, cooking, sides, favorites, summary } };
      }

      case "book_table": {
        const { data: reservation, error } = await supabase
          .from("waiter_reservations")
          .insert({
            user_id: context.userId,
            restaurant_id: context.venueId,
            guest_name: args.guest_name,
            guest_email: args.guest_email,
            guest_phone: args.guest_phone,
            reservation_datetime: args.datetime,
            party_size: args.party_size,
            special_requests: args.special_requests,
            status: "pending"
          })
          .select("id, reservation_code, reservation_datetime, party_size, status")
          .single();

        if (error) throw error;

        return {
          success: true,
          reservation
        };
      }

      case "update_order": {
        // Verify order belongs to user
        const { data: order, error: orderError } = await supabase
          .from("draft_orders")
          .select("id, status")
          .eq("id", args.order_id)
          .eq("user_id", context.userId)
          .single();

        if (orderError || !order) {
          return { success: false, error: "Order not found or access denied" };
        }

        if (order.status !== "draft") {
          return { success: false, error: "Can only update draft orders" };
        }

        // Add items
        if (args.add_items && args.add_items.length > 0) {
          for (const item of args.add_items) {
            const { data: menuItem } = await supabase
              .from("menu_items")
              .select("price")
              .eq("id", item.item_id)
              .single();

            if (menuItem) {
              await supabase
                .from("draft_order_items")
                .insert({
                  draft_order_id: args.order_id,
                  user_id: context.userId,
                  menu_item_id: item.item_id,
                  quantity: item.quantity,
                  unit_price: menuItem.price
                });
            }
          }
        }

        // Remove items
        if (args.remove_items && args.remove_items.length > 0) {
          await supabase
            .from("draft_order_items")
            .delete()
            .eq("draft_order_id", args.order_id)
            .in("id", args.remove_items);
        }

        return { success: true };
      }

      case "cancel_order": {
        const { error } = await supabase
          .from("draft_orders")
          .update({
            status: "cancelled",
            metadata: { cancellation_reason: args.reason }
          })
          .eq("id", args.order_id)
          .eq("user_id", context.userId)
          .eq("status", "draft");

        if (error) throw error;

        return { success: true };
      }

      case "submit_feedback": {
        const { error } = await supabase
          .from("waiter_feedback")
          .insert({
            order_id: args.order_id,
            user_id: context.userId,
            rating: args.rating,
            food_rating: args.food_rating,
            service_rating: args.service_rating,
            comment: args.comment,
            would_recommend: args.would_recommend
          });

        if (error) throw error;

        return { success: true };
      }

      default:
        return { error: "Unknown tool" };
    }
  } catch (error) {
    await logStructuredEvent("WAITER_TOOL_ERROR", {
      tool: name,
      error: error.message,
      userId: context.userId
    });
    return { success: false, error: error.message };
  }
}

// =====================================================
// REQUEST HANDLER
// =====================================================

serve(async (req: Request) => {
  const url = new URL(req.url);
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const startedAt = Date.now();

  // CORS headers
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "X-Request-ID": requestId,
  };

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const mergedHeaders = new Headers({ ...headers, ...(init.headers || {}) });
    return new Response(
      typeof body === "string" ? body : JSON.stringify(body),
      { ...init, headers: mergedHeaders },
    );
  };

  if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/ping")) {
    try {
      const { error } = await supabase.from("waiter_conversations").select("id").limit(1);
      const healthy = !error;
      const durationMs = Date.now() - startedAt;
      healthMetrics.latencyMsTotal += durationMs;
      healthy ? healthMetrics.success++ : healthMetrics.failure++;

      await logStructuredEvent("WAITER_HEALTH_CHECK", {
        requestId,
        healthy,
        durationMs,
        error: error?.message,
      });

      return respond({
        status: healthy ? "ok" : "degraded",
        service: "waiter-ai-agent",
        requestId,
        latency_ms: durationMs,
        checks: { database: healthy ? "connected" : "error" },
        timestamp: new Date().toISOString(),
      }, { status: healthy ? 200 : 503 });
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      healthMetrics.failure++;
      healthMetrics.latencyMsTotal += durationMs;
      await logStructuredEvent("WAITER_HEALTH_CHECK_ERROR", {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        durationMs,
      }, "error");

      return respond({
        status: "unhealthy",
        service: "waiter-ai-agent",
        requestId,
        latency_ms: durationMs,
      }, { status: 503 });
    }
  }

  if (req.method === "GET" && url.pathname === "/metrics") {
    return new Response(renderHealthMetrics("waiter-ai-agent"), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; version=0.0.4",
        "X-Request-ID": requestId,
      },
    });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const { action, userId, message, language, conversationId, metadata, audio } = await req.json();

    // Basic S2S auth for WA webhook and internal calls
    const adminHeader = req.headers.get("x-admin-token") || "";
    const isInternal = ADMIN_INTERNAL_TOKEN && adminHeader === ADMIN_INTERNAL_TOKEN;

    if (!isInternal) {
      // If verify_jwt is enabled at deploy-time this is redundant, but keep a soft gate
      // Refuse privileged actions without internal token
      if (action === "start_conversation" || action === "send_message" || action === "send_audio") {
        // allow but continue; if you want to hard-enforce, uncomment:
        // return respond({ error: 'unauthorized' }, { status: 401 });
      }
    }

    await logStructuredEvent("WAITER_AI_REQUEST", {
      action,
      userId,
      language,
      conversationId
    });

    // =====================================================
    // ACTION: START CONVERSATION
    // =====================================================
    if (action === "start_conversation") {
      const { data: conversation, error } = await supabase
        .from("waiter_conversations")
        .insert({
          user_id: userId,
          language,
          restaurant_id: metadata?.venue,
          table_number: metadata?.table,
          metadata,
          status: "active"
        })
        .select("id")
        .single();

      if (error) throw error;

      const welcomeMessages: Record<string, string> = {
        en: "Hello! 👋 I'm your virtual waiter. I can help you browse our menu, make recommendations, take your order, and more. What would you like to do today?",
        fr: "Bonjour ! 👋 Je suis votre serveur virtuel. Je peux vous aider à parcourir notre menu, faire des recommandations, prendre votre commande, et plus encore. Que puis-je faire pour vous aujourd'hui ?",
        es: "¡Hola! 👋 Soy tu camarero virtual. Puedo ayudarte a explorar nuestro menú, hacer recomendaciones, tomar tu pedido y más. ¿Qué te gustaría hacer hoy?",
        pt: "Olá! 👋 Sou seu garçom virtual. Posso ajudá-lo a navegar pelo nosso menu, fazer recomendações, anotar seu pedido e muito mais. O que gostaria de fazer hoje?",
        de: "Hallo! 👋 Ich bin Ihr virtueller Kellner. Ich kann Ihnen helfen, unser Menü zu durchsuchen, Empfehlungen abzugeben, Ihre Bestellung aufzunehmen und vieles mehr. Was möchten Sie heute tun?"
      };

      const welcomeMessage = welcomeMessages[language] || welcomeMessages.en;

      // Store welcome message
      await supabase
        .from("waiter_messages")
        .insert({
          conversation_id: conversation.id,
          sender: "assistant",
          content: welcomeMessage
        });

      return new Response(
        JSON.stringify({
          conversationId: conversation.id,
          welcomeMessage
        }),
        { headers }
      );
    }

    // =====================================================
    // ACTION: SEND MESSAGE
    // =====================================================
    if (action === "send_message") {
      // PII & payment guardrails (basic)
      if (containsCardPAN(String(message || ""))) {
        await logStructuredEvent("WAITER_GUARDRAIL_PAN_BLOCK", { conversationId, userId });
        return respond({ error: "For your safety, please do not share card numbers. Use mobile money or secure links." }, { status: 400 });
      }
      // Store user message
      await supabase
        .from("waiter_messages")
        .insert({
          conversation_id: conversationId,
          sender: "user",
          content: message
        });

      // Update conversation activity
      await supabase
        .from("waiter_conversations")
        .update({ last_activity: new Date().toISOString() })
        .eq("id", conversationId);

      // Get conversation history
      const { data: messages } = await supabase
        .from("waiter_messages")
        .select("sender, content")
        .eq("conversation_id", conversationId)
        .order("timestamp", { ascending: true })
        .limit(30);

      const chatMessages = messages?.map(m => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.content
      })) || [];

      // Personalization: fetch user memories for waiter domain and seed system context
      const { data: mems } = await supabase
        .from('user_memories')
        .select('mem_key, mem_value')
        .eq('user_id', userId)
        .eq('domain', 'waiter')
        .order('last_seen', { ascending: false })
        .limit(20);
      const memorySummary = Array.isArray(mems) && mems.length
        ? `Known preferences: ${mems.map(m => `${m.mem_key}=${JSON.stringify(m.mem_value)}`).join('; ')}`
        : '';

      // Call OpenAI with streaming
      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + `\n\nCurrent language: ${language}` + (memorySummary ? `\n\n${memorySummary}` : '') },
          ...chatMessages,
          { role: "user", content: message }
        ],
        tools,
        stream: true,
        temperature: 0.7,
        max_tokens: 2000
      });

      // Stream response
      const stream = new ReadableStream({
        async start(controller) {
          let fullResponse = "";
          let toolCalls: any[] = [];

          try {
            for await (const chunk of response) {
              const delta = chunk.choices[0].delta;

              if (delta.content) {
                fullResponse += delta.content;
                controller.enqueue(
                  new TextEncoder().encode(
                    `data: ${JSON.stringify({ type: "chunk", content: delta.content })}\n\n`
                  )
                );
              }

              if (delta.tool_calls) {
                toolCalls.push(...delta.tool_calls);
              }
            }

            // Handle tool calls if any
            if (toolCalls.length > 0) {
              for (const toolCall of toolCalls) {
                const args = JSON.parse(toolCall.function.arguments);
                const result = await handleToolCall(
                  toolCall.function.name,
                  args,
                  { userId, conversationId, venueId: metadata?.venue }
                );

                // Get follow-up response with tool result
                const followUpResponse = await openai.chat.completions.create({
                  model: "gpt-4-turbo-preview",
                  messages: [
                    ...chatMessages,
                    { role: "user", content: message },
                    {
                      role: "assistant",
                      content: null,
                      tool_calls: [toolCall]
                    },
                    {
                      role: "tool",
                      tool_call_id: toolCall.id,
                      content: JSON.stringify(result)
                    }
                  ]
                });

                fullResponse = followUpResponse.choices[0].message.content || fullResponse;
              }
            }

            // Store assistant response
            await supabase
              .from("waiter_messages")
              .insert({
                conversation_id: conversationId,
                sender: "assistant",
                content: fullResponse,
                metadata: { tool_calls: toolCalls.length > 0 ? toolCalls : null }
              });

            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ type: "done", content: fullResponse })}\n\n`
              )
            );
            controller.close();

            await logStructuredEvent("WAITER_MESSAGE_COMPLETE", {
              conversationId,
              userId,
              responseLength: fullResponse.length,
              toolCallsCount: toolCalls.length
            });
          } catch (error) {
            await logStructuredEvent("WAITER_STREAM_ERROR", {
              error: error.message,
              conversationId
            });
            controller.error(error);
          }
        }
      });

      return new Response(stream, {
        headers: {
          ...headers,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        }
      });
    }

    // =====================================================
    // ACTION: PROFILE SUMMARY
    // =====================================================
    if (action === "profile_summary") {
      const { data } = await supabase
        .from('user_memories')
        .select('mem_key, mem_value')
        .eq('user_id', userId)
        .eq('domain', 'waiter')
        .in('mem_key', ['dietary','favorite_items','cooking_preference','preferred_sides'])
        .order('last_seen', { ascending: false });
      const byKey: Record<string, any> = {};
      for (const row of (data || [])) byKey[row.mem_key] = row.mem_value;
      const fav = (byKey.favorite_items?.items || []) as Array<{ name: string; count: number }>;
      fav.sort((a, b) => (b.count || 0) - (a.count || 0));
      const favorites = fav.slice(0, 5).map((x) => x.name);
      const dietary = (byKey.dietary?.labels || []) as string[];
      const cooking = byKey.cooking_preference?.value as string | undefined;
      const sides = (byKey.preferred_sides?.labels || []) as string[];
      const summaryParts = [] as string[];
      if (dietary.length) summaryParts.push(`Dietary: ${dietary.join(', ')}`);
      if (cooking) summaryParts.push(`Cooking: ${cooking}`);
      if (sides.length) summaryParts.push(`Sides: ${sides.join(', ')}`);
      if (favorites.length) summaryParts.push(`Favorites: ${favorites.join(', ')}`);
      const summary = summaryParts.length ? summaryParts.join(' | ') : 'No saved preferences yet.';
      return respond({ profile: { dietary, cooking, sides, favorites, summary } }, { status: 200 });
    }

    // =====================================================
    // ACTION: ASSISTANT SUGGESTIONS (Personalized + Market insights)
    // =====================================================
    if (action === "assistant_suggestions") {
      // 1) User favorites
      const { data: favMem } = await supabase
        .from('user_memories')
        .select('mem_value')
        .eq('user_id', userId)
        .eq('domain', 'waiter')
        .eq('mem_key', 'favorite_items')
        .maybeSingle();
      const favItems = Array.isArray(favMem?.mem_value?.items) ? favMem!.mem_value.items as Array<{ item_id: string; name: string; count: number }> : [];
      favItems.sort((a, b) => (b.count || 0) - (a.count || 0));
      const favTop = favItems.slice(0, 3);

      // 2) Trending (1 day window; fallback 7d MV if available)
      const { data: trendingDaily } = await supabase
        .from('menu_item_popularity_daily')
        .select('menu_item_id, order_count')
        .gte('day', new Date(Date.now() - 86400000).toISOString())
        .order('order_count', { ascending: false })
        .limit(5);
      const trendingIds = (trendingDaily || []).map((r: any) => r.menu_item_id);
      const { data: trendingItems } = trendingIds.length
        ? await supabase.from('menu_items').select('id, name, price').in('id', trendingIds)
        : { data: [] } as any;

      // 3) New items (last 14 days)
      let newItems: any[] = [];
      try {
        const since = new Date(Date.now() - 14 * 86400000).toISOString();
        const { data } = await supabase
          .from('menu_items')
          .select('id, name, price, created_at')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(5);
        newItems = data || [];
      } catch (_) {}

      // Format suggestions
      const favLine = favTop.length ? `Based on your favorites: ${favTop.map(x => x.name).join(', ')}` : '';
      const trendLine = (trendingItems || []).length ? `Trending now: ${(trendingItems || []).map((x: any) => x.name).join(', ')}` : '';
      const newLine = newItems.length ? `New on the menu: ${newItems.map((x: any) => x.name).join(', ')}` : '';
      const parts = [favLine, trendLine, newLine].filter(Boolean);
      const messageText = parts.length ? `✨ Suggestions\n\n• ${parts.join('\n• ')}` : '✨ Suggestions\n\nTry our chef specials or ask for the menu!';

      return respond({ message: messageText }, { status: 200 });
    }

    // =====================================================
    // ACTION: SEND AUDIO (WhatsApp voice)
    // =====================================================
    if (action === "send_audio") {
      // Expect: audio = { phoneNumberId, mediaId, accessToken }
      if (!audio?.phoneNumberId || !audio?.mediaId || !audio?.accessToken) {
        return respond({ error: "missing_audio_fields" }, { status: 400 });
      }

      // Download + transcribe
      const buffer = await downloadWhatsAppAudio(audio.mediaId, audio.accessToken);
      const transcript = await transcribeAudio(buffer, "ogg");

      // Recurse into send_message pipeline with transcribed text
      const forward = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": adminHeader },
        body: JSON.stringify({
          action: "send_message",
          userId,
          conversationId,
          language: language || transcript.language || "en",
          message: transcript.text,
          metadata,
        }),
      });
      return forward;
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers }
    );
  } catch (error) {
    await logStructuredEvent("WAITER_AI_ERROR", {
      error: error.message,
      stack: error.stack
    });

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers }
    );
  }
});
