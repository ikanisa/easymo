import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";
import { sendTextMessage, sendButtonsMessage, sendListMessage } from "../_shared/wa-webhook-shared/utils/reply.ts";
import { logStructuredEvent, recordMetric, maskPII } from "../_shared/observability.ts";
import { formatPaymentInstructions, generateMoMoUSSDCode } from "./payment.ts";
import { notifyBarNewOrder } from "./notify_bar.ts";
import { DualAIProvider } from "./providers/dual-ai-provider.ts";
import Fuse from "https://esm.sh/fuse.js@7.0.0";

// State machine and discovery imports
import {
  WAITER_STATE_KEYS,
  getWaiterState,
  initializeWaiterSession,
  initializeWaiterSessionFromQR,
  setWaiterVenue,
  setWaiterTableNumber,
  setWaiterLocation,
  transitionWaiterState,
  requiresVenueDiscovery,
  isReadyForOrdering,
  getBarsNearLocation,
  searchBarsByName,
  formatBarsForWhatsApp,
  type WaiterState,
  type WaiterSessionContext,
} from "../_shared/agents/waiter/index.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
import { callAI } from "./ai-provider.ts";

// Phone validation (Rwanda + Malta)
const RWANDA_PHONE_REGEX = /^\+250\d{9}$/;
const MALTA_PHONE_REGEX = /^\+356\d{8}$/;

/**
 * Validate phone number format (Rwanda or Malta)
 */
export function isValidPhone(phone: string): boolean {
  return RWANDA_PHONE_REGEX.test(phone) || MALTA_PHONE_REGEX.test(phone);
}

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
  // Get user profile ID for state management
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("user_id")
    .eq("whatsapp_e164", ctx.from)
    .maybeSingle();

  const userId = profile?.user_id || ctx.from;

  // Log message receipt for all states (W5: Fix logging)
  await logStructuredEvent("WAITER_MESSAGE_RECEIVED", {
    requestId: ctx.requestId,
    phone: maskPII(ctx.from),
    messageType: ctx.messageType,
    hasProfile: Boolean(profile),
  });

  // Check for QR code pattern in message (QR flow takes priority)
  const messageText = ctx.message.text?.body || "";
  const qrMatch = messageText.match(/TABLE-([A-Z0-9]+)-BAR-([a-f0-9-]+)/i);
  
  if (qrMatch) {
    return await handleQRCodeEntry(ctx, userId, qrMatch[1], qrMatch[2]);
  }

  // Handle location message for venue discovery
  if (ctx.messageType === "location" && ctx.message.location) {
    return await handleLocationMessage(ctx, userId);
  }

  // Get current waiter state
  const waiterState = await getWaiterState(ctx.supabase, userId);

  // W2/W-Fix 2: If no venue context, run venue discovery flow
  if (requiresVenueDiscovery(waiterState)) {
    return await handleVenueDiscoveryFlow(ctx, userId, waiterState);
  }

  // If we have venue context, proceed with existing session logic
  const session = await getOrCreateSession(ctx);
  
  if (!session) {
    // This shouldn't happen if state says we have a venue, but handle gracefully
    await logStructuredEvent("WAITER_SESSION_STATE_MISMATCH", {
      userId: maskPII(userId),
      waiterStateKey: waiterState?.key,
      venueId: waiterState?.data?.venueId,
    }, "warn");
    
    // Reset state and start discovery
    return await handleVenueDiscoveryFlow(ctx, userId, null);
  }

  // Handle interactive messages (buttons/lists)
  if (ctx.messageType === "interactive") {
    return await handleInteractiveMessage(ctx, session);
  }

  // Process with AI for ordering
  return await processWithAI(ctx, session, messageText);
}

/**
 * Handle QR code entry - direct path to full context
 * W-Fix 3: Unify QR and home entry
 */
async function handleQRCodeEntry(
  ctx: WaiterContext,
  userId: string,
  tableNumber: string,
  barId: string
): Promise<boolean> {
  await logStructuredEvent("WAITER_QR_ENTRY", {
    userId: maskPII(userId),
    barId,
    tableNumber,
  });

  recordMetric("waiter.entry", 1, { mode: "qr" });

  // Initialize session from QR (sets state to VENUE_AND_TABLE_SELECTED)
  const state = await initializeWaiterSessionFromQR(ctx.supabase, userId, barId, tableNumber);

  if (!state) {
    await sendTextMessage(ctx.from,
      "❌ Sorry, this bar is not available right now.\n\n" +
      "Please try scanning the QR code again or ask bar staff for help."
    );
    return true;
  }

  // Create conversation session and send welcome
  const session = await getOrCreateSession(ctx);
  
  if (session) {
    const welcomeMessage = `👋 Welcome to ${state.data.venueName}!\n\n` +
      `📍 You're at Table ${tableNumber}.\n\n` +
      `I'm your AI waiter. I can help you:\n` +
      `• Browse our menu\n` +
      `• Place orders\n` +
      `• Get payment instructions\n\n` +
      `Just tell me what you'd like! 😊`;

    await sendTextMessage(ctx.from, welcomeMessage);
  }

  return true;
}

/**
 * Handle location message for bar discovery
 */
async function handleLocationMessage(
  ctx: WaiterContext,
  userId: string
): Promise<boolean> {
  const lat = ctx.message.location.latitude;
  const lng = ctx.message.location.longitude;

  await logStructuredEvent("WAITER_LOCATION_RECEIVED", {
    userId: maskPII(userId),
    lat,
    lng,
  });

  // Save location to state
  await setWaiterLocation(ctx.supabase, userId, lat, lng);

  // Search for nearby bars
  const discoveryResult = await getBarsNearLocation(ctx.supabase, lat, lng, 10, 5);

  if (discoveryResult.bars.length === 0) {
    await transitionWaiterState(ctx.supabase, userId, WAITER_STATE_KEYS.NO_VENUE_SELECTED);
    
    await sendButtonsMessage(
      { from: ctx.from } as any,
      "📍 I couldn't find any partner bars nearby.\n\n" +
      "You can:\n" +
      "• Move closer to a partner bar\n" +
      "• Search by bar name\n" +
      "• Scan a QR code at the bar\n\n" +
      "What would you like to do?",
      [
        { id: "waiter_search_name", title: "🔍 Search by Name" },
        { id: "waiter_back_home", title: "↩️ Main Menu" },
      ]
    );
    return true;
  }

  // Transition to discovery mode
  await transitionWaiterState(ctx.supabase, userId, WAITER_STATE_KEYS.DISCOVERY_MODE);

  // Format bars for display
  const barsText = formatBarsForWhatsApp(discoveryResult.bars);

  // Create list selection for bars
  const barRows = discoveryResult.bars.map((bar, idx) => ({
    id: `waiter_select_bar_${bar.id}`,
    title: bar.name.slice(0, 24),
    description: bar.locationText || bar.city || `${bar.distanceKm?.toFixed(1)}km away`,
  }));

  await sendListMessage(
    { from: ctx.from, locale: ctx.locale } as any,
    {
      title: "Nearby Bars",
      body: `📍 Found ${discoveryResult.bars.length} partner bar(s) near you:\n\n${barsText}\n\nSelect one to start ordering:`,
      sectionTitle: "Select a Bar",
      buttonText: "Choose Bar",
      rows: [
        ...barRows,
        { id: "waiter_search_name", title: "🔍 Search by Name" },
        { id: "waiter_back_home", title: "↩️ Main Menu" },
      ],
    },
    { emoji: "🍽️" }
  );

  return true;
}

/**
 * Handle venue discovery flow for home entry
 * W-Fix 2: Implement Venue Discovery Flow
 */
async function handleVenueDiscoveryFlow(
  ctx: WaiterContext,
  userId: string,
  currentState: WaiterState | null
): Promise<boolean> {
  const messageText = ctx.message.text?.body?.trim().toLowerCase() || "";

  // Log discovery flow entry
  await logStructuredEvent("WAITER_DISCOVERY_FLOW", {
    userId: maskPII(userId),
    currentState: currentState?.key || "none",
    messageText: messageText.slice(0, 50),
  });

  recordMetric("waiter.entry", 1, { mode: "home_discovery" });

  // Handle bar selection from list
  if (ctx.messageType === "interactive") {
    const interactive = ctx.message.interactive;
    const listId = interactive?.list_reply?.id;
    const buttonId = interactive?.button_reply?.id;
    const actionId = listId || buttonId;

    if (actionId?.startsWith("waiter_select_bar_")) {
      const barId = actionId.replace("waiter_select_bar_", "");
      return await handleBarSelection(ctx, userId, barId);
    }

    if (actionId === "waiter_search_name") {
      await transitionWaiterState(ctx.supabase, userId, WAITER_STATE_KEYS.SEARCHING_BAR_NAME);
      await sendTextMessage(ctx.from,
        "🔍 *Search for a bar*\n\n" +
        "Type the name of the bar or restaurant you're at:"
      );
      return true;
    }

    if (actionId === "waiter_share_location") {
      await transitionWaiterState(ctx.supabase, userId, WAITER_STATE_KEYS.AWAITING_LOCATION);
      await sendTextMessage(ctx.from,
        "📍 *Share your location*\n\n" +
        "Please share your location so I can find bars near you.\n\n" +
        "Tap the 📎 attachment icon → Location → Share Live Location"
      );
      return true;
    }

    if (actionId === "waiter_back_home") {
      // Clear waiter state and exit
      await transitionWaiterState(ctx.supabase, userId, WAITER_STATE_KEYS.NO_VENUE_SELECTED, {}, true);
      await sendTextMessage(ctx.from, "Okay! Come back anytime you're ready to order. 👋");
      return true;
    }
  }

  // Handle text input for bar name search
  if (currentState?.key === WAITER_STATE_KEYS.SEARCHING_BAR_NAME && messageText.length >= 2) {
    return await handleBarNameSearch(ctx, userId, messageText);
  }

  // Handle table number input
  if (currentState?.key === WAITER_STATE_KEYS.VENUE_SELECTED_NO_TABLE && messageText.length > 0) {
    const tableNumber = messageText.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (tableNumber.length > 0) {
      return await handleTableNumberInput(ctx, userId, tableNumber);
    }
  }

  // Default: Show welcome and discovery options (W-Fix 2)
  if (!currentState || currentState.key === WAITER_STATE_KEYS.NO_VENUE_SELECTED) {
    await initializeWaiterSession(ctx.supabase, userId, "home");
    
    await sendButtonsMessage(
      { from: ctx.from } as any,
      "🍽️ *Welcome to AI Waiter!*\n\n" +
      "I can help you order food and drinks at any easyMO partner bar.\n\n" +
      "To serve you, I need to know which bar you're at:\n\n" +
      "📍 Share your location to find nearby bars\n" +
      "🔍 Or search by bar name\n\n" +
      "_Tip: Scanning the QR code at your table is the fastest way to start!_",
      [
        { id: "waiter_share_location", title: "📍 Share Location" },
        { id: "waiter_search_name", title: "🔍 Search by Name" },
        { id: "waiter_back_home", title: "↩️ Main Menu" },
      ]
    );
    return true;
  }

  // If awaiting location, remind user
  if (currentState.key === WAITER_STATE_KEYS.AWAITING_LOCATION) {
    await sendTextMessage(ctx.from,
      "📍 Please share your location to find nearby bars.\n\n" +
      "Tap the 📎 attachment icon → Location → Share Live Location\n\n" +
      "Or type a bar name to search."
    );
    return true;
  }

  return true;
}

/**
 * Handle bar name search
 */
async function handleBarNameSearch(
  ctx: WaiterContext,
  userId: string,
  query: string
): Promise<boolean> {
  await logStructuredEvent("WAITER_BAR_NAME_SEARCH", {
    userId: maskPII(userId),
    query: query.slice(0, 50),
  });

  const result = await searchBarsByName(ctx.supabase, query, 5);

  if (result.bars.length === 0) {
    await sendButtonsMessage(
      { from: ctx.from } as any,
      `🔍 No bars found matching "${query}"\n\n` +
      "Try:\n" +
      "• A different spelling\n" +
      "• Sharing your location\n" +
      "• Scanning the QR code at the bar",
      [
        { id: "waiter_share_location", title: "📍 Share Location" },
        { id: "waiter_search_name", title: "🔍 Search Again" },
        { id: "waiter_back_home", title: "↩️ Main Menu" },
      ]
    );
    return true;
  }

  // Transition to discovery mode
  await transitionWaiterState(ctx.supabase, userId, WAITER_STATE_KEYS.DISCOVERY_MODE);

  const barRows = result.bars.map((bar) => ({
    id: `waiter_select_bar_${bar.id}`,
    title: bar.name.slice(0, 24),
    description: bar.locationText || bar.city || "",
  }));

  await sendListMessage(
    { from: ctx.from, locale: ctx.locale } as any,
    {
      title: "Search Results",
      body: `🔍 Found ${result.bars.length} bar(s) matching "${query}":\n\nSelect one to start ordering:`,
      sectionTitle: "Select a Bar",
      buttonText: "Choose Bar",
      rows: [
        ...barRows,
        { id: "waiter_search_name", title: "🔍 Search Again" },
        { id: "waiter_back_home", title: "↩️ Main Menu" },
      ],
    },
    { emoji: "🍽️" }
  );

  return true;
}

/**
 * Handle bar selection from discovery results
 */
async function handleBarSelection(
  ctx: WaiterContext,
  userId: string,
  barId: string
): Promise<boolean> {
  await logStructuredEvent("WAITER_BAR_SELECTED", {
    userId: maskPII(userId),
    barId,
  });

  // Set venue in state (transitions to VENUE_SELECTED_NO_TABLE)
  const state = await setWaiterVenue(ctx.supabase, userId, barId);

  if (!state) {
    await sendTextMessage(ctx.from,
      "❌ Sorry, this bar is not available right now. Please try another one."
    );
    return true;
  }

  // Ask for table number
  await sendButtonsMessage(
    { from: ctx.from } as any,
    `🍽️ Great! You're at *${state.data.venueName}*\n\n` +
    "Which table are you at?\n\n" +
    "_Type your table number (e.g., A5, 12, VIP1) or tap if you're at the bar:_",
    [
      { id: "waiter_table_bar", title: "🍺 At the Bar" },
      { id: "waiter_table_skip", title: "⏩ Skip for Now" },
    ]
  );

  return true;
}

/**
 * Handle table number input
 */
async function handleTableNumberInput(
  ctx: WaiterContext,
  userId: string,
  tableNumber: string
): Promise<boolean> {
  const state = await setWaiterTableNumber(ctx.supabase, userId, tableNumber);

  if (!state) {
    await sendTextMessage(ctx.from,
      "❌ Something went wrong. Please try again or scan the QR code at your table."
    );
    return true;
  }

  await logStructuredEvent("WAITER_TABLE_SET_SUCCESS", {
    userId: maskPII(userId),
    venueId: state.data.venueId,
    tableNumber,
  });

  // Create conversation session and send welcome
  const session = await getOrCreateSession(ctx);

  const welcomeMessage = `👋 Perfect! You're at *${state.data.venueName}*, Table ${tableNumber}.\n\n` +
    `I'm your AI waiter. I can help you:\n` +
    `• Browse our menu\n` +
    `• Place orders\n` +
    `• Get payment instructions\n\n` +
    `What would you like to order? 😊`;

  await sendTextMessage(ctx.from, welcomeMessage);

  return true;
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
        payment_settings,
        currency
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
        currency: existing.bars.currency || existing.bars.payment_settings?.currency || "RWF",
        payment_settings: existing.bars.payment_settings,
      } : undefined,
    };
  }

  // Try to create session from QR code deep link
  const messageText = ctx.message.text?.body || "";
  const qrMatch = messageText.match(/TABLE-([A-Z0-9]+)-BAR-([a-f0-9-]+)/i);
  
  if (qrMatch) {
    const tableNumber = qrMatch[1];
    const barId = qrMatch[2];

    const { data: bar } = await ctx.supabase
      .from("bars")
      .select("id, name, phone, payment_settings, currency")
      .eq("id", barId)
      .single();

    if (!bar) {
      return null;
    }

    const { data: menuItems } = await ctx.supabase
      .from("menu_items")
      .select("id, name, description, price, currency, category, is_available")
      .eq("bar_id", barId)
      .eq("is_available", true)
      .order("category")
      .order("name");

    // Validate menu is not empty per problem statement
    if (!menuItems || menuItems.length === 0) {
      await sendTextMessage(ctx.from, 
        "Sorry, the menu is currently unavailable. Please contact the bar staff.");
      await logStructuredEvent("WAITER_EMPTY_MENU_ERROR", {
        barId,
        phone: ctx.from,
      }, "error");
      return null;
    }

    const sessionId = crypto.randomUUID();

    const { data: newSession } = await ctx.supabase
      .from("waiter_conversations")
      .insert({
        session_id: sessionId,
        bar_id: barId,
        visitor_phone: ctx.from,
        table_number: tableNumber,
        status: "active",
        messages: [],
        current_cart: { items: [], total: 0 },
      })
      .select()
      .single();

    if (!newSession) {
      return null;
    }

    const welcomeMessage = `👋 Welcome to ${bar.name}!\n\n` +
      `You're at Table ${tableNumber}.\n\n` +
      `I'm your AI waiter. I can help you:\n` +
      `• Browse our menu\n` +
      `• Place orders\n` +
      `• Get payment instructions\n\n` +
      `Just tell me what you'd like! 😊`;

    await sendTextMessage(ctx.from, welcomeMessage);

    return {
      ...newSession,
      bars: bar,
      bar_info: {
        name: bar.name,
        phone: bar.phone,
        currency: bar.currency || bar.payment_settings?.currency || "RWF",
        payment_settings: bar.payment_settings,
      },
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
    .from("menu_items")
    .select("id, name, description, price, currency, category, is_available")
    .eq("bar_id", session.bar_id)
    .eq("is_available", true)
    .order("category")
    .order("name");

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
  ] as Array<{ role: "user" | "assistant"; content: string }>;

  try {
    // GROUND_RULES: Use dual-provider AI (GPT-5 primary, Gemini-3 fallback)
    const aiResponse = await callAI(systemPrompt, updatedMessages);

    await handleAIAction(ctx, session, aiResponse, updatedMessages);

    return true;
  } catch (error) {
    console.error("waiter_ai.error", error);
    await logStructuredEvent("WAITER_AI_ERROR", {
      error: error instanceof Error ? error.message : String(error),
      from: ctx.from,
    }, "error");
    await sendTextMessage(ctx.from, "Sorry, I'm having trouble right now. Please try again.");
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
        // Fetch all menu items for fuzzy matching
        const { data: allMenuItems } = await ctx.supabase
          .from("menu_items")
          .select("id, name, price, description")
          .eq("bar_id", session.bar_id)
          .eq("is_available", true);

        for (const item of items) {
          let menuItem = null;
          
          // Try exact ID match first
          if (item.id) {
            const { data } = await ctx.supabase
              .from("menu_items")
              .select("id, name, price")
              .eq("id", item.id)
              .eq("bar_id", session.bar_id)
              .eq("is_available", true)
              .maybeSingle();
            menuItem = data;
          }
          
          // Use Fuse.js for fuzzy name matching
          if (!menuItem && item.name && allMenuItems && allMenuItems.length > 0) {
            const fuse = new Fuse(allMenuItems, {
              keys: ['name', 'description'],
              threshold: 0.4,  // Per problem statement
              includeScore: true,
            });
            
            const results = fuse.search(item.name);
            if (results.length > 0 && results[0].score! < 0.4) {
              menuItem = results[0].item;
              
              await logStructuredEvent("WAITER_FUZZY_MATCH", {
                searchTerm: item.name,
                matched: menuItem.name,
                score: results[0].score,
              });
            }
          }
          
          if (!menuItem) continue;
          
          const existing = updatedCart.items.find(i => i.id === menuItem!.id);
          if (existing) {
            existing.quantity += item.quantity || 1;
          } else {
            updatedCart.items.push({
              id: menuItem.id,
              name: menuItem.name,
              price: menuItem.price,
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
    await sendTextMessage(ctx.from, message);
  }
}

async function handleCheckout(
  ctx: WaiterContext,
  session: ConversationSession,
  cart: ConversationSession["current_cart"]
): Promise<void> {
  if (cart.items.length === 0) {
    await sendTextMessage(ctx.from, "Your cart is empty! Tell me what you'd like to order.");
    return;
  }

  // Use bar's currency column, fall back to payment_settings, then default
  const { data: bar } = await ctx.supabase
    .from("bars")
    .select("currency, payment_settings")
    .eq("id", session.bar_id)
    .single();

  const currency = bar?.currency || bar?.payment_settings?.currency || "RWF";
  const paymentSettings = bar?.payment_settings || {};

  const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
  
  // GROUND_RULES: Do NOT track payment_status - customer pays directly
  const { data: order, error} = await ctx.supabase
    .from("orders")
    .insert({
      bar_id: session.bar_id,
      order_number: orderNumber,
      status: "pending",
      total_amount: cart.total,
      currency,
      visitor_phone: ctx.from,
      dine_in_table: session.table_number,
      waiter_session_id: session.session_id,
      payment_method: currency === "EUR" ? "revolut" : "momo",
    })
    .select("id")
    .single();

  if (error || !order) {
    await sendTextMessage(ctx.from, "Sorry, couldn't create your order. Please try again.");
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
  
  // NOTE: Per GROUND_RULES.md, we do NOT process payments directly.
  // We only generate payment instructions (USSD codes/Revolut links) 
  // for the user to complete payment themselves via mobile money or Revolut.
  const paymentInfo = formatPaymentInstructions(
    paymentMethod,
    cart.total,
    currency,
    orderNumber,
    paymentSettings
  );

  // Store payment link for reference only (not tracking payment)
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

  // GROUND_RULES: Do NOT track payment status - customer pays directly via USSD/Revolut
  await sendButtonsMessage(
    { from: ctx.from } as any,
    `✅ *Order Confirmed!*\n\n📋 Order #${orderNumber}\n📍 Table: ${session.table_number || "N/A"}\n\n*Items:*\n${itemsList}\n\n💰 *Total: ${cart.total.toLocaleString()} ${currency}*\n\n${paymentInfo.message}\n\n_Your order will be prepared once payment is received._`,
    [
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

  // Handle table selection buttons from discovery flow
  if (actionId === "waiter_table_bar") {
    // User is at the bar counter
    const { data: profile } = await ctx.supabase
      .from("profiles")
      .select("user_id")
      .eq("whatsapp_e164", ctx.from)
      .maybeSingle();
    
    const userId = profile?.user_id || ctx.from;
    await setWaiterTableNumber(ctx.supabase, userId, "BAR");
    
    await sendTextMessage(ctx.from,
      "👍 Got it! You're at the bar counter.\n\n" +
      "What would you like to order? 🍽️"
    );
    return true;
  }

  if (actionId === "waiter_table_skip") {
    await sendTextMessage(ctx.from,
      "👍 No problem! You can tell me your table number anytime.\n\n" +
      "What would you like to order? 🍽️"
    );
    return true;
  }

  switch (actionId) {
    case "waiter_checkout":
      await handleCheckout(ctx, session, session.current_cart);
      break;
    
    case "waiter_add_more":
      await sendTextMessage(ctx.from, "What else would you like to order? 🍽️");
      break;
    
    case "waiter_clear_cart":
      await ctx.supabase
        .from("waiter_conversations")
        .update({ current_cart: { items: [], total: 0 } })
        .eq("id", session.id);
      await sendTextMessage(ctx.from, "🗑️ Cart cleared! What would you like to order?");
      break;
    
    case "waiter_help":
      await sendTextMessage(ctx.from,
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
