import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../_shared/observability.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

// User state tracking (in-memory for session)
interface UserState {
  mode: "idle" | "browsing" | "selling" | "listing_details" | "search";
  lastAction: string;
  pendingListing?: {
    title?: string;
    description?: string;
    price?: number;
    category?: string;
    images?: string[];
  };
  searchQuery?: string;
}

const userStates = new Map<string, UserState>();

serve(async (req: Request): Promise<Response> => {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  const logEvent = (event: string, details: Record<string, unknown> = {}, level: "info" | "error" = "info") => {
    logStructuredEvent(event, { service: "wa-webhook-marketplace", requestId, ...details }, level);
  };

  if (req.method === "POST") {
    try {
      const payload = await req.json();
      const message = extractWhatsAppMessage(payload);
      
      if (!message?.from) {
        return new Response(JSON.stringify({ success: true, ignored: "no_message" }), { headers: { "Content-Type": "application/json" } });
      }

      const text = message.body?.toLowerCase().trim() ?? "";
      const userPhone = message.from;
      logEvent("MARKETPLACE_MESSAGE_RECEIVED", { from: userPhone, input: text, type: message.type });

      // Get or create user state
      let state = userStates.get(userPhone) || { mode: "idle", lastAction: "" };

      // Handle image uploads for listings
      if (message.type === "image" && state.mode === "selling") {
        const imageUrl = message.image?.link || message.image?.url;
        if (imageUrl && state.pendingListing) {
          state.pendingListing.images = state.pendingListing.images || [];
          state.pendingListing.images.push(imageUrl);
          userStates.set(userPhone, state);
          
          await sendText(userPhone, "📸 Image received! Send more photos or describe your item (title, price, description).");
          return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        }
      }

      let response = "";

      // Main menu or welcome
      if (!text || text === "marketplace" || text === "shops_services" || text === "shop" || text === "menu" || text === "home") {
        state = { mode: "idle", lastAction: "menu" };
        response = `🛍️ *EasyMO Marketplace*\n\n` +
          `1. 🛒 Browse Items\n` +
          `2. 🏷️ Sell Item\n` +
          `3. 📋 My Listings\n` +
          `4. 🔍 Search\n\n` +
          `Reply with a number or keyword.`;
      }
      // Browse items
      else if (text === "1" || text.includes("browse") || text.includes("buy")) {
        state = { mode: "browsing", lastAction: "browse" };
        
        // Fetch recent listings
        const { data: listings } = await supabase
          .from("marketplace_listings")
          .select("id, title, price, category, location_name")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(5);
        
        if (listings && listings.length > 0) {
          response = "🛒 *Recent Listings*\n\n";
          listings.forEach((item, i) => {
            response += `${i + 1}. *${item.title}*\n`;
            response += `   💰 ${item.price?.toLocaleString() || "Price TBD"} RWF\n`;
            response += `   📍 ${item.location_name || "Rwanda"}\n\n`;
          });
          response += `Reply with a number for details, or type what you're looking for.`;
        } else {
          response = "🛒 No listings available right now.\n\nBe the first to sell something! Type *sell* to list an item.";
        }
      }
      // Sell item
      else if (text === "2" || text.includes("sell")) {
        state = { 
          mode: "selling", 
          lastAction: "sell_start",
          pendingListing: {}
        };
        response = `🏷️ *Sell an Item*\n\n` +
          `Let's create your listing!\n\n` +
          `📸 Send a photo of your item\n` +
          `Then tell me:\n` +
          `• Title (what are you selling?)\n` +
          `• Price in RWF\n` +
          `• Brief description\n\n` +
          `Example: "iPhone 12, 350000, Like new condition with charger"\n\n` +
          `Type *cancel* to exit.`;
      }
      // My listings
      else if (text === "3" || text.includes("my listing")) {
        const { data: myListings } = await supabase
          .from("marketplace_listings")
          .select("id, title, price, status, views, created_at")
          .eq("seller_phone", userPhone)
          .order("created_at", { ascending: false })
          .limit(5);
        
        if (myListings && myListings.length > 0) {
          response = "📋 *Your Listings*\n\n";
          myListings.forEach((item, i) => {
            const statusIcon = item.status === "active" ? "🟢" : item.status === "sold" ? "✅" : "⚪";
            response += `${i + 1}. ${statusIcon} *${item.title}*\n`;
            response += `   💰 ${item.price?.toLocaleString() || "TBD"} RWF | 👁️ ${item.views || 0} views\n\n`;
          });
          response += `Reply with a number to manage listing.`;
        } else {
          response = "📋 You haven't listed anything yet.\n\nType *sell* to create your first listing!";
        }
      }
      // Search
      else if (text === "4" || text === "search" || text.startsWith("find ") || text.startsWith("looking for ")) {
        const searchQuery = text.replace(/^(4|search|find|looking for)\s*/i, "").trim();
        
        if (searchQuery) {
          // Perform search
          const { data: results } = await supabase
            .from("marketplace_listings")
            .select("id, title, price, category, location_name")
            .eq("status", "active")
            .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%`)
            .order("created_at", { ascending: false })
            .limit(5);
          
          if (results && results.length > 0) {
            response = `🔍 *Results for "${searchQuery}"*\n\n`;
            results.forEach((item, i) => {
              response += `${i + 1}. *${item.title}*\n`;
              response += `   💰 ${item.price?.toLocaleString() || "Price TBD"} RWF\n`;
              response += `   📍 ${item.location_name || "Rwanda"}\n\n`;
            });
            response += `Reply with a number for details.`;
          } else {
            response = `🔍 No results for "${searchQuery}".\n\nTry a different search or browse all items with *browse*.`;
          }
        } else {
          state = { mode: "search", lastAction: "search_prompt" };
          response = "🔍 *Search Marketplace*\n\nWhat are you looking for?\n\nType a keyword like 'phone', 'furniture', or 'car'.";
        }
      }
      // Cancel
      else if (text === "cancel" || text === "exit") {
        state = { mode: "idle", lastAction: "cancelled" };
        response = "✅ Cancelled. Type *marketplace* to see the main menu.";
      }
      // Handle listing creation (in selling mode)
      else if (state.mode === "selling" && state.pendingListing) {
        // Try to parse: "Title, Price, Description"
        const parts = text.split(",").map(p => p.trim());
        
        if (parts.length >= 2) {
          const title = parts[0];
          const priceStr = parts[1].replace(/[^0-9]/g, "");
          const price = parseInt(priceStr) || null;
          const description = parts.slice(2).join(", ") || null;
          
          // Create listing
          const { data: newListing, error } = await supabase
            .from("marketplace_listings")
            .insert({
              seller_phone: userPhone,
              title,
              price,
              description,
              images: state.pendingListing.images || [],
              status: "active"
            })
            .select("id, title, price")
            .single();
          
          if (error) {
            logEvent("MARKETPLACE_LISTING_ERROR", { error: error.message }, "error");
            response = "❌ Sorry, there was an error creating your listing. Please try again.";
          } else {
            state = { mode: "idle", lastAction: "listing_created" };
            response = `✅ *Listing Created!*\n\n` +
              `📦 ${newListing.title}\n` +
              `💰 ${newListing.price?.toLocaleString() || "Price TBD"} RWF\n\n` +
              `Your listing is now live! Buyers can contact you on WhatsApp.\n\n` +
              `Type *my listings* to manage your listings.`;
          }
        } else {
          response = "Please provide details in this format:\n\n*Title, Price, Description*\n\nExample: iPhone 12, 350000, Like new with charger";
        }
      }
      // Handle search mode
      else if (state.mode === "search") {
        const searchQuery = text;
        const { data: results } = await supabase
          .from("marketplace_listings")
          .select("id, title, price, category, location_name")
          .eq("status", "active")
          .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%`)
          .order("created_at", { ascending: false })
          .limit(5);
        
        if (results && results.length > 0) {
          response = `🔍 *Results for "${searchQuery}"*\n\n`;
          results.forEach((item, i) => {
            response += `${i + 1}. *${item.title}*\n`;
            response += `   💰 ${item.price?.toLocaleString() || "Price TBD"} RWF\n\n`;
          });
          response += `Reply with a number for details.`;
        } else {
          response = `🔍 No results for "${searchQuery}".\n\nTry *browse* to see all items.`;
        }
        state = { mode: "idle", lastAction: "search_complete" };
      }
      // Default handler
      else {
        response = `You said: "${text}"\n\nType *marketplace* to see the menu.`;
      }

      // Update user state
      userStates.set(userPhone, state);

      // Send response
      await sendText(userPhone, response);

      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    } catch (error) {
      logEvent("MARKETPLACE_ERROR", { error: String(error) }, "error");
      return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
    }
  }

  return new Response("OK");
});

// Extract message from WhatsApp webhook payload
function extractWhatsAppMessage(payload: any): {
  from: string;
  body: string;
  type: string;
  image?: { link?: string; url?: string };
} | null {
  try {
    if (payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      const msg = payload.entry[0].changes[0].value.messages[0];
      return {
        from: msg.from,
        body: msg.text?.body || msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || "",
        type: msg.type,
        image: msg.image,
      };
    }
    if (payload?.from && payload?.body) {
      return {
        from: payload.from,
        body: payload.body,
        type: payload.type || "text",
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Send text message via WhatsApp
async function sendText(to: string, text: string): Promise<void> {
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  
  if (!phoneNumberId || !accessToken) {
    console.error("WhatsApp credentials not configured");
    return;
  }
  
  try {
    await fetch(`https://graph.facebook.com/v17.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    });
  } catch (error) {
    console.error("Failed to send WhatsApp message:", error);
  }
}
