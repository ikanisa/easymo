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
          .select("id, name, description, price, available")
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

        return {
          success: true,
          item: {
            name: item.name,
            quantity: args.quantity,
            unit_price: item.price,
            total_price: item.price * args.quantity
          },
          cart_total: total
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
  // CORS headers
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const { action, userId, message, language, conversationId, metadata } = await req.json();

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

      // Call OpenAI with streaming
      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + `\n\nCurrent language: ${language}` },
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
