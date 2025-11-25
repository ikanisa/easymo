import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../_shared/observability.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

// User state tracking (in-memory for session)
interface UserState {
  mode: "idle" | "browsing" | "search" | "register_business";
  lastAction: string;
  searchQuery?: string;
  selectedBusinessId?: string;
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

      let response = "";

      // Main menu or welcome
      if (!text || text === "marketplace" || text === "shops_services" || text === "shop" || text === "menu" || text === "home") {
        state = { mode: "idle", lastAction: "menu" };
        response = `🛍️ *EasyMO Marketplace*\n\n` +
          `Find local businesses and services in Rwanda.\n\n` +
          `1. 🏪 Browse Businesses\n` +
          `2. 🔍 Search by Category\n` +
          `3. 📍 Nearby Services\n` +
          `4. ➕ Register Your Business\n\n` +
          `Reply with a number or type what you're looking for.`;
      }
      // Browse businesses
      else if (text === "1" || text.includes("browse") || text.includes("businesses")) {
        state = { mode: "browsing", lastAction: "browse" };
        
        // Fetch businesses from business_directory table
        const { data: businesses } = await supabase
          .from("business_directory")
          .select("id, name, category, city, phone, rating")
          .neq("status", "DO_NOT_CALL")
          .order("rating", { ascending: false })
          .limit(5);
        
        if (businesses && businesses.length > 0) {
          response = "🏪 *Featured Businesses*\n\n";
          businesses.forEach((biz, i) => {
            const stars = biz.rating ? "⭐".repeat(Math.round(biz.rating)) : "";
            response += `${i + 1}. *${biz.name}*\n`;
            response += `   📂 ${biz.category}\n`;
            response += `   📍 ${biz.city}\n`;
            if (biz.rating) response += `   ${stars} (${biz.rating})\n`;
            response += `\n`;
          });
          response += `Reply with a number for details and contact info.`;
        } else {
          response = "🏪 No businesses found in directory yet.\n\nType *register* to add your business!";
        }
      }
      // Search by category
      else if (text === "2" || text.includes("category") || text.includes("categories")) {
        state = { mode: "search", lastAction: "category_prompt" };
        response = `🔍 *Search by Category*\n\n` +
          `Popular categories:\n` +
          `• Restaurant 🍽️\n` +
          `• Pharmacy 💊\n` +
          `• Hotel 🏨\n` +
          `• Supermarket 🛒\n` +
          `• Bank 🏦\n` +
          `• Hospital 🏥\n\n` +
          `Type a category to search.`;
      }
      // Nearby services
      else if (text === "3" || text.includes("nearby") || text.includes("near me")) {
        state = { mode: "search", lastAction: "nearby" };
        response = `📍 *Find Nearby Services*\n\n` +
          `Tell me your location (city or area) and what you need.\n\n` +
          `Example: "pharmacy in Kigali" or "restaurant Nyarugenge"`;
      }
      // Register business
      else if (text === "4" || text.includes("register") || text.includes("add business")) {
        state = { mode: "register_business", lastAction: "register_start" };
        response = `➕ *Register Your Business*\n\n` +
          `To add your business to our directory, please provide:\n\n` +
          `Business Name, Category, City, Phone\n\n` +
          `Example:\n` +
          `"Kigali Pharmacy, Pharmacy, Kigali, 0788123456"\n\n` +
          `Type *cancel* to go back.`;
      }
      // Cancel
      else if (text === "cancel" || text === "exit" || text === "back") {
        state = { mode: "idle", lastAction: "cancelled" };
        response = "✅ Cancelled. Type *marketplace* to see the main menu.";
      }
      // Handle business registration
      else if (state.mode === "register_business") {
        const parts = text.split(",").map(p => p.trim());
        
        if (parts.length >= 3) {
          const name = parts[0];
          const category = parts[1];
          const city = parts[2];
          const phone = parts[3] || userPhone;
          
          // Add to business_directory
          const { data: newBiz, error } = await supabase
            .from("business_directory")
            .insert({
              name,
              category,
              city,
              address: city, // Default address to city
              phone,
              status: "NEW",
              source: "whatsapp_registration"
            })
            .select("id, name, category, city")
            .single();
          
          if (error) {
            logEvent("BUSINESS_REGISTER_ERROR", { error: error.message }, "error");
            response = "❌ Sorry, there was an error registering your business. Please try again.";
          } else {
            state = { mode: "idle", lastAction: "business_registered" };
            response = `✅ *Business Registered!*\n\n` +
              `🏪 ${newBiz.name}\n` +
              `📂 ${newBiz.category}\n` +
              `📍 ${newBiz.city}\n\n` +
              `Your business is now in our directory! Customers can find you by searching.\n\n` +
              `Type *marketplace* to return to menu.`;
          }
        } else {
          response = `Please provide details in this format:\n\n` +
            `*Business Name, Category, City, Phone*\n\n` +
            `Example: Kigali Pharmacy, Pharmacy, Kigali, 0788123456`;
        }
      }
      // Handle search mode (category or location search)
      else if (state.mode === "search" || text.includes(" in ") || text.includes(" near ")) {
        const searchQuery = text;
        
        // Search in business_directory
        const { data: results } = await supabase
          .from("business_directory")
          .select("id, name, category, city, phone, rating, address")
          .neq("status", "DO_NOT_CALL")
          .or(`name.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%`)
          .order("rating", { ascending: false })
          .limit(5);
        
        if (results && results.length > 0) {
          response = `🔍 *Results for "${searchQuery}"*\n\n`;
          results.forEach((biz, i) => {
            const stars = biz.rating ? "⭐".repeat(Math.round(biz.rating)) : "";
            response += `${i + 1}. *${biz.name}*\n`;
            response += `   📂 ${biz.category}\n`;
            response += `   📍 ${biz.city}\n`;
            if (biz.phone) response += `   📞 ${biz.phone}\n`;
            if (biz.rating) response += `   ${stars}\n`;
            response += `\n`;
          });
          response += `Reply with a number for more details.`;
        } else {
          response = `🔍 No businesses found for "${searchQuery}".\n\nTry browsing with *browse* or search a different category.`;
        }
        state = { mode: "idle", lastAction: "search_complete" };
      }
      // Default handler - treat as search
      else {
        // Try searching with the input
        const { data: results } = await supabase
          .from("business_directory")
          .select("id, name, category, city, phone, rating")
          .neq("status", "DO_NOT_CALL")
          .or(`name.ilike.%${text}%,category.ilike.%${text}%,city.ilike.%${text}%`)
          .order("rating", { ascending: false })
          .limit(5);
        
        if (results && results.length > 0) {
          response = `🔍 *Results for "${text}"*\n\n`;
          results.forEach((biz, i) => {
            response += `${i + 1}. *${biz.name}*\n`;
            response += `   📂 ${biz.category} | 📍 ${biz.city}\n`;
            if (biz.phone) response += `   📞 ${biz.phone}\n`;
            response += `\n`;
          });
        } else {
          response = `I didn't find any businesses matching "${text}".\n\nType *marketplace* to see options.`;
        }
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
