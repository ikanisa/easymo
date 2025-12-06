import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendText, sendButtonsMessage } from "../_shared/wa-webhook-shared/utils/reply.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import { formatPaymentInstructions, generateMoMoUSSDCode } from "./payment.ts";
import { notifyBarNewOrder } from "./notify_bar.ts";
import { DualAIProvider } from "./providers/dual-ai-provider.ts";

interface WaiterContext {
  supabase: SupabaseClient;
  from: string;
  message: any;
  messageType: string;
  requestId: string;
  locale: string;
}

interface ConversationSession {
  id: string;
  bar_id: string;
  visitor_phone: string;
  session_id: string;
  messages: Array<{ role: string; content: string }>;
  current_cart: {
    items: Array<{ id: string; name: string; price: number; quantity: number }>;
    total: number;
  };
  current_order_id: string | null;
  table_number: string | null;
  status: string;
  bar_info?: {
    name: string;
    phone: string;
    currency: string;
    payment_settings: any;
  };
}

export async function handleWaiterMessage(ctx: WaiterContext): Promise<boolean> {
  const session = await getOrCreateSession(ctx);
  
  if (!session) {
    await sendText(ctx.from, 
      "👋 Welcome! Please scan the QR code at your table to start ordering."
    );
    return true;
  }

  const messageText = ctx.message.text?.body || "";
  const messageType = ctx.messageType;

  if (messageType === "interactive") {
    return await handleInteractiveMessage(ctx, session);
  }

  return await processWithAI(ctx, session, messageText);
}

async function getOrCreateSession(ctx: WaiterContext): Promise<ConversationSession | null> {
  const { data: existing } = await ctx.supabase
    .from("waiter_conversations")
    .select(`
      *,
      bars (
        id,
        name,
        phone,
        payment_settings
      )
    `)
    .eq("visitor_phone", ctx.from)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return {
      ...existing,
      bar_info: existing.bars ? {
        name: existing.bars.name,
        phone: existing.bars.phone,
        currency: existing.bars.payment_settings?.currency || "RWF",
        payment_settings: existing.bars.payment_settings,
      } : undefined,
    };
  }

  return null;
}

async function processWithAI(
  ctx: WaiterContext,
  session: ConversationSession,
  userMessage: string
): Promise<boolean> {
  const { data: menuItems } = await ctx.supabase
    .from("restaurant_menu_items")
    .select("id, name, description, price, currency, category, is_available")
    .eq("bar_id", session.bar_id)
    .eq("is_available", true)
    .order("category")
    .order("sort_order");

  const menuText = (menuItems || []).map((item) => 
    `- ${item.name} (${item.category}): ${item.price} ${item.currency}${item.description ? ` - ${item.description}` : ""}`
  ).join("\n");

  const cartText = session.current_cart.items.length > 0
    ? session.current_cart.items.map(i => `${i.quantity}x ${i.name}`).join(", ")
    : "Empty";

  const systemPrompt = `You are a friendly AI waiter at ${session.bar_info?.name || "this restaurant"}. 

MENU:
${menuText}

CURRENT CART: ${cartText} (Total: ${session.current_cart.total} ${session.bar_info?.currency || "RWF"})
TABLE: ${session.table_number || "Not set"}

YOUR RESPONSIBILITIES:
1. Greet customers warmly
2. Help them browse the menu
3. Take orders item by item
4. Confirm orders before checkout
5. Process payment

RESPONSE FORMAT:
Always respond in JSON:
{
  "message": "Your friendly response to the customer",
  "action": "none" | "add_to_cart" | "remove_from_cart" | "show_cart" | "checkout" | "set_table",
  "items": [{"id": "menu_item_id", "name": "Item Name", "quantity": 1}],
  "table_number": "A5"
}

Keep responses SHORT and friendly (max 2-3 sentences). 
Use emojis sparingly. 
If customer wants to order, extract the items and quantities.
If unclear, ask for clarification.`;

  const updatedMessages = [
    ...session.messages,
    { role: "user", content: userMessage },
  ];

  try {
    // Use DualAIProvider with automatic failover (OpenAI GPT-5 → Gemini-3)
    const aiProvider = new DualAIProvider();
    const aiResult = await aiProvider.chat([
      { role: "system", content: systemPrompt },
      ...updatedMessages.slice(-10),
    ], {
      temperature: 0.7,
      maxTokens: 500,
    });

    // Log which provider was used
    await logStructuredEvent("WAITER_AI_RESPONSE", {
      provider: aiResult.provider,
      model: aiResult.model,
      fallbackUsed: aiResult.fallbackUsed,
    });

    const aiResponseText = aiResult.text;

    let aiResponse: any;
    try {
      const jsonMatch = aiResponseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[0]);
      } else {
        aiResponse = { message: aiResponseText, action: "none" };
      }
    } catch {
      aiResponse = { message: aiResponseText, action: "none" };
    }

    await handleAIAction(ctx, session, aiResponse, updatedMessages);

    return true;
  } catch (error) {
    console.error("waiter_ai.error", error);
    await sendText(ctx.from, "Sorry, I'm having trouble right now. Please try again.");
    return true;
  }
}

async function handleAIAction(
  ctx: WaiterContext,
  session: ConversationSession,
  aiResponse: any,
  updatedMessages: Array<{ role: string; content: string }>
): Promise<void> {
  const { message, action, items, table_number } = aiResponse;

  updatedMessages.push({ role: "assistant", content: message });

  let updatedCart = { ...session.current_cart };
  let updatedTable = session.table_number;

  switch (action) {
    case "add_to_cart":
      if (items && items.length > 0) {
        for (const item of items) {
          const existing = updatedCart.items.find(i => i.id === item.id);
          if (existing) {
            existing.quantity += item.quantity || 1;
          } else {
            const { data: menuItem } = await ctx.supabase
              .from("restaurant_menu_items")
              .select("price")
              .eq("id", item.id)
              .single();
            
            updatedCart.items.push({
              id: item.id,
              name: item.name,
              price: menuItem?.price || 0,
              quantity: item.quantity || 1,
            });
          }
        }
        updatedCart.total = updatedCart.items.reduce(
          (sum, i) => sum + (i.price * i.quantity), 0
        );
      }
      break;

    case "remove_from_cart":
      if (items && items.length > 0) {
        for (const item of items) {
          updatedCart.items = updatedCart.items.filter(i => i.id !== item.id);
        }
        updatedCart.total = updatedCart.items.reduce(
          (sum, i) => sum + (i.price * i.quantity), 0
        );
      }
      break;

    case "set_table":
      if (table_number) {
        updatedTable = table_number;
      }
      break;

    case "checkout":
      await handleCheckout(ctx, session, updatedCart);
      return;
  }

  await ctx.supabase
    .from("waiter_conversations")
    .update({
      messages: updatedMessages,
      current_cart: updatedCart,
      table_number: updatedTable,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id);

  if (action === "show_cart" && updatedCart.items.length > 0) {
    const cartSummary = updatedCart.items
      .map(i => `${i.quantity}x ${i.name} - ${(i.price * i.quantity).toLocaleString()}`)
      .join("\n");
    
    await sendButtonsMessage(
      { from: ctx.from } as any,
      `🛒 *Your Cart*\n\n${cartSummary}\n\n💰 *Total: ${updatedCart.total.toLocaleString()} ${session.bar_info?.currency || "RWF"}*\n\n${message}`,
      [
        { id: "waiter_checkout", title: "✅ Checkout" },
        { id: "waiter_add_more", title: "➕ Add More" },
        { id: "waiter_clear_cart", title: "🗑️ Clear Cart" },
      ]
    );
  } else {
    await sendText(ctx.from, message);
  }
}

async function handleCheckout(
  ctx: WaiterContext,
  session: ConversationSession,
  cart: ConversationSession["current_cart"]
): Promise<void> {
  if (cart.items.length === 0) {
    await sendText(ctx.from, "Your cart is empty! Tell me what you'd like to order.");
    return;
  }

  const currency = session.bar_info?.currency || "RWF";
  const paymentSettings = session.bar_info?.payment_settings || {};

  const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
  
  const { data: order, error } = await ctx.supabase
    .from("orders")
    .insert({
      business_id: session.bar_id,
      order_number: orderNumber,
      status: "pending",
      total_amount: cart.total,
      currency,
      visitor_phone: ctx.from,
      dine_in_table: session.table_number,
      waiter_session_id: session.session_id,
      payment_status: "pending",
      payment_method: currency === "EUR" ? "revolut" : "momo",
    })
    .select("id")
    .single();

  if (error || !order) {
    await sendText(ctx.from, "Sorry, couldn't create your order. Please try again.");
    return;
  }

  await ctx.supabase.from("order_items").insert(
    cart.items.map(item => ({
      order_id: order.id,
      menu_item_id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    }))
  );

  const paymentMethod = currency === "EUR" ? "revolut" : "momo";
  const paymentInfo = formatPaymentInstructions(
    paymentMethod,
    cart.total,
    currency,
    orderNumber,
    paymentSettings
  );

  await ctx.supabase
    .from("orders")
    .update({
      payment_link: paymentInfo.url,
      payment_ussd_code: paymentMethod === "momo" ? generateMoMoUSSDCode(cart.total) : null,
    })
    .eq("id", order.id);

  await ctx.supabase
    .from("waiter_conversations")
    .update({
      current_order_id: order.id,
      status: "order_placed",
      current_cart: { items: [], total: 0 },
    })
    .eq("id", session.id);

  await notifyBarNewOrder(ctx.supabase, session.bar_id, order.id, orderNumber, cart, session);

  const itemsList = cart.items
    .map(i => `${i.quantity}x ${i.name}`)
    .join("\n");

  await sendButtonsMessage(
    { from: ctx.from } as any,
    `✅ *Order Confirmed!*\n\n📋 Order #${orderNumber}\n📍 Table: ${session.table_number || "N/A"}\n\n*Items:*\n${itemsList}\n\n💰 *Total: ${cart.total.toLocaleString()} ${currency}*\n\n${paymentInfo.message}`,
    [
      { id: "waiter_confirm_paid", title: "✅ I've Paid" },
      { id: "waiter_help", title: "❓ Need Help" },
    ]
  );

  await logStructuredEvent("WAITER_ORDER_CREATED", {
    orderId: order.id,
    orderNumber,
    barId: session.bar_id,
    visitorPhone: ctx.from,
    total: cart.total,
    itemCount: cart.items.length,
  });
}

async function handleInteractiveMessage(
  ctx: WaiterContext,
  session: ConversationSession
): Promise<boolean> {
  const interactive = ctx.message.interactive;
  const buttonId = interactive?.button_reply?.id;
  const listId = interactive?.list_reply?.id;
  const actionId = buttonId || listId;

  if (!actionId) return false;

  switch (actionId) {
    case "waiter_checkout":
      await handleCheckout(ctx, session, session.current_cart);
      break;
    
    case "waiter_add_more":
      await sendText(ctx.from, "What else would you like to order? 🍽️");
      break;
    
    case "waiter_clear_cart":
      await ctx.supabase
        .from("waiter_conversations")
        .update({ current_cart: { items: [], total: 0 } })
        .eq("id", session.id);
      await sendText(ctx.from, "🗑️ Cart cleared! What would you like to order?");
      break;
    
    case "waiter_confirm_paid":
      if (session.current_order_id) {
        await ctx.supabase
          .from("orders")
          .update({ payment_status: "confirmed" })
          .eq("id", session.current_order_id);
      }
      await sendText(ctx.from, 
        "✅ Thank you! Your payment has been noted.\n\n" +
        "Your order is being prepared. We'll let you know when it's ready! 🍽️"
      );
      break;
    
    case "waiter_help":
      await sendText(ctx.from,
        "Need help? Here are your options:\n\n" +
        "• Type what you want to order\n" +
        "• Say 'menu' to see the full menu\n" +
        "• Say 'cart' to view your cart\n" +
        "• Say 'cancel' to cancel your order\n\n" +
        "Or ask me anything! 😊"
      );
      break;
  }

  return true;
}
