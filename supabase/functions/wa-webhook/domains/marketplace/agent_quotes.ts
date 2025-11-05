import type { RouterContext } from "../../types.ts";
import { isFeatureEnabled } from "../../_shared/feature-flags.ts";
import { logAgentEvent, maskPhone } from "../../_shared/agent-observability.ts";
import { sendWhatsAppMessage } from "../../wa/send.ts";

/**
 * Marketplace Agent Quote Request Handler
 * 
 * Sends quote requests to marketplace vendors (pharmacies, quincailleries, shops)
 * and handles their responses for agent negotiation sessions.
 */

interface MarketplaceQuoteRequestParams {
  vendorPhone: string;
  vendorName?: string;
  sessionId: string;
  flowType: "nearby_pharmacies" | "nearby_quincailleries" | "nearby_shops";
  requestDetails: {
    description: string;
    category?: string;
    location?: { lat: number; lng: number; text?: string };
    distance?: number;
    imageUrl?: string; // For prescription/list images
  };
}

/**
 * Send quote request to a marketplace vendor
 */
export async function sendMarketplaceQuoteRequest(
  ctx: RouterContext,
  params: MarketplaceQuoteRequestParams,
): Promise<boolean> {
  if (!isFeatureEnabled("agent.marketplace")) {
    return false;
  }

  try {
    const { vendorPhone, sessionId, flowType, requestDetails } = params;

    // Format quote request message
    const message = formatMarketplaceQuoteRequest(flowType, requestDetails);

    // Send WhatsApp message
    const sent = await sendWhatsAppMessage(ctx, {
      to: vendorPhone,
      type: "text",
      text: { body: message },
    });

    if (sent) {
      const vendorType = getVendorTypeFromFlow(flowType);
      logAgentEvent("AGENT_QUOTE_SENT", {
        sessionId,
        vendorPhone: maskPhone(vendorPhone),
        vendorType,
      });
    }

    return sent;
  } catch (error) {
    console.error("Failed to send marketplace quote request:", error);
    return false;
  }
}

/**
 * Format marketplace quote request message
 */
function formatMarketplaceQuoteRequest(
  flowType: MarketplaceQuoteRequestParams["flowType"],
  details: MarketplaceQuoteRequestParams["requestDetails"],
): string {
  const vendorTypeLabel = getVendorTypeLabel(flowType);
  let message = `${getVendorTypeIcon(flowType)} *New ${vendorTypeLabel} Request - Quote Needed*\n\n`;

  message += `📝 *Request:* ${details.description}\n`;

  if (details.location?.text) {
    message += `📍 *Location:* ${details.location.text}\n`;
  } else if (details.location) {
    message += `📍 *Location:* ${details.location.lat.toFixed(5)}, ${details.location.lng.toFixed(5)}\n`;
  }

  if (details.distance) {
    message += `📏 *Distance:* ${details.distance.toFixed(1)} km away\n`;
  }

  if (details.category) {
    message += `🏷️ *Category:* ${details.category}\n`;
  }

  message += "\n💰 *Please reply with your quote price (RWF)*\n";
  message += "📦 *Include availability and delivery time if applicable*\n";
  message += "⏱️ *Reply within 5 minutes*\n\n";
  message += "Example: 15,000 RWF - In stock, delivery 30 min";

  return message;
}

/**
 * Parse marketplace vendor quote response
 */
export function parseMarketplaceQuoteResponse(text: string): {
  priceAmount: number | null;
  estimatedTimeMinutes: number | null;
  availability: string | null;
  notes: string | null;
} {
  let priceAmount: number | null = null;
  let estimatedTimeMinutes: number | null = null;
  let availability: string | null = null;
  let notes: string | null = null;

  // Try to extract price (formats: "15000", "15,000 RWF", "RWF 15000")
  const priceMatch = text.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*(?:RWF|Frw?)?/i);
  if (priceMatch) {
    const priceStr = priceMatch[1].replace(/,/g, "");
    const price = parseInt(priceStr, 10);
    if (!isNaN(price) && price > 0 && price < 10000000) {
      priceAmount = price;
    }
  }

  // Try to extract delivery/preparation time
  const timeMatch = text.match(/(\d+)\s*(?:min(?:ute)?s?|hours?|hrs?)/i);
  if (timeMatch) {
    const time = parseInt(timeMatch[1], 10);
    const unit = timeMatch[0].toLowerCase();
    if (!isNaN(time) && time > 0) {
      if (unit.includes("hour") || unit.includes("hr")) {
        estimatedTimeMinutes = time * 60;
      } else {
        estimatedTimeMinutes = time;
      }
    }
  }

  // Try to extract availability keywords
  const availabilityKeywords = [
    "in stock",
    "available",
    "out of stock",
    "not available",
    "can deliver",
    "delivery available",
  ];
  const lowerText = text.toLowerCase();
  for (const keyword of availabilityKeywords) {
    if (lowerText.includes(keyword)) {
      availability = keyword;
      break;
    }
  }

  // Extract notes (everything that's not price/time/common phrases)
  const cleanText = text
    .replace(/(\d{1,3}(?:,\d{3})*|\d+)\s*(?:RWF|Frw?)?/gi, "")
    .replace(/(\d+)\s*(?:min(?:ute)?s?|hours?|hrs?)/gi, "")
    .replace(/in stock|available|out of stock|not available|can deliver|delivery available/gi, "")
    .trim();

  if (cleanText.length > 0 && cleanText.length < 300) {
    notes = cleanText;
  }

  return { priceAmount, estimatedTimeMinutes, availability, notes };
}

/**
 * Handle incoming quote response from marketplace vendor
 */
export async function handleMarketplaceQuoteResponse(
  ctx: RouterContext,
  text: string,
): Promise<boolean> {
  if (!isFeatureEnabled("agent.marketplace")) {
    return false;
  }

  try {
    // Check if vendor has pending quote requests
    const { data: pendingQuotes, error } = await ctx.supabase
      .from("agent_quotes")
      .select("session_id, vendor_phone, vendor_type")
      .eq("vendor_phone", ctx.from)
      .eq("status", "pending")
      .in("vendor_type", ["pharmacy", "quincaillerie", "shop"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (error || !pendingQuotes || pendingQuotes.length === 0) {
      return false;
    }

    const quote = pendingQuotes[0];
    const parsed = parseMarketplaceQuoteResponse(text);

    if (!parsed.priceAmount) {
      // Invalid response format
      await sendWhatsAppMessage(ctx, {
        to: ctx.from,
        type: "text",
        text: {
          body: "❌ Invalid quote format. Please reply with:\nPrice (e.g., '15,000 RWF')\nAvailability (e.g., 'In stock')\nDelivery time (e.g., '30 min')",
        },
      });
      return true;
    }

    // Build offer data with parsed information
    const offerData: Record<string, unknown> = {
      priceAmount: parsed.priceAmount,
    };
    if (parsed.availability) {
      offerData.availability = parsed.availability;
    }
    if (parsed.estimatedTimeMinutes) {
      offerData.estimatedTimeMinutes = parsed.estimatedTimeMinutes;
    }
    if (parsed.notes) {
      offerData.notes = parsed.notes;
    }

    // Update quote with response
    await ctx.supabase
      .from("agent_quotes")
      .update({
        status: "received",
        price_amount: parsed.priceAmount,
        estimated_time_minutes: parsed.estimatedTimeMinutes,
        notes: parsed.notes || parsed.availability || null,
        offer_data: offerData,
        received_at: new Date().toISOString(),
      })
      .eq("session_id", quote.session_id)
      .eq("vendor_phone", ctx.from);

    logAgentEvent("AGENT_QUOTE_RECEIVED", {
      sessionId: quote.session_id,
      vendorPhone: maskPhone(ctx.from),
      vendorType: quote.vendor_type,
      priceAmount: parsed.priceAmount,
      estimatedTime: parsed.estimatedTimeMinutes,
      availability: parsed.availability,
    });

    // Send confirmation
    let confirmMessage = `✅ Quote received: ${parsed.priceAmount} RWF`;
    if (parsed.availability) {
      confirmMessage += `\n📦 ${parsed.availability.charAt(0).toUpperCase() + parsed.availability.slice(1)}`;
    }
    if (parsed.estimatedTimeMinutes) {
      confirmMessage += `\n⏱️ ${parsed.estimatedTimeMinutes} min`;
    }
    confirmMessage += "\n\nThank you! The customer will be notified.";

    await sendWhatsAppMessage(ctx, {
      to: ctx.from,
      type: "text",
      text: { body: confirmMessage },
    });

    return true;
  } catch (error) {
    console.error("Failed to handle marketplace quote response:", error);
    return false;
  }
}

/**
 * Send quote presentation to user for marketplace items
 */
export async function sendMarketplaceQuotePresentationToUser(
  ctx: RouterContext,
  sessionId: string,
): Promise<boolean> {
  if (!isFeatureEnabled("agent.marketplace")) {
    return false;
  }

  try {
    // Get session and best quotes
    const { data: session, error: sessionError } = await ctx.supabase
      .from("agent_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return false;
    }

    const { data: quotes, error: quotesError } = await ctx.supabase
      .from("agent_quotes")
      .select("*")
      .eq("session_id", sessionId)
      .eq("status", "received")
      .order("price_amount", { ascending: true, nullsLast: true })
      .limit(3);

    if (quotesError || !quotes || quotes.length === 0) {
      return false;
    }

    const vendorTypeLabel = getVendorTypeLabelFromVendorType(quotes[0].vendor_type);
    const vendorTypeIcon = getVendorTypeIconFromVendorType(quotes[0].vendor_type);

    // Format presentation message
    let message = `${vendorTypeIcon} *Found ${vendorTypeLabel} for Your Request!*\n\n`;
    message += `I collected ${quotes.length} quote${quotes.length > 1 ? "s" : ""} for you:\n\n`;

    quotes.forEach((quote, index) => {
      message += `${index + 1}️⃣ *${quote.price_amount} RWF*`;
      
      if (quote.vendor_name) {
        message += ` - ${quote.vendor_name}`;
      }
      
      if (quote.offer_data?.availability) {
        message += `\n   📦 ${quote.offer_data.availability}`;
      }
      
      if (quote.estimated_time_minutes) {
        message += `\n   ⏱️ ${quote.estimated_time_minutes} min`;
      }
      
      if (quote.notes) {
        const shortNotes = quote.notes.length > 50 
          ? quote.notes.substring(0, 50) + "..." 
          : quote.notes;
        message += `\n   💬 ${shortNotes}`;
      }
      
      message += "\n\n";
    });

    message += "💡 Reply with the number (1, 2, or 3) to select a vendor.";

    await sendWhatsAppMessage(ctx, {
      to: session.user_id,
      type: "text",
      text: { body: message },
    });

    logAgentEvent("AGENT_PARTIAL_RESULTS_PRESENTED", {
      sessionId,
      quotesCount: quotes.length,
      vendorType: quotes[0].vendor_type,
    });

    return true;
  } catch (error) {
    console.error("Failed to send marketplace quote presentation:", error);
    return false;
  }
}

// Helper functions

function getVendorTypeFromFlow(flowType: string): string {
  switch (flowType) {
    case "nearby_pharmacies":
      return "pharmacy";
    case "nearby_quincailleries":
      return "quincaillerie";
    case "nearby_shops":
      return "shop";
    default:
      return "other";
  }
}

function getVendorTypeLabel(flowType: string): string {
  switch (flowType) {
    case "nearby_pharmacies":
      return "Pharmacy";
    case "nearby_quincailleries":
      return "Quincaillerie";
    case "nearby_shops":
      return "Shop";
    default:
      return "Vendor";
  }
}

function getVendorTypeIcon(flowType: string): string {
  switch (flowType) {
    case "nearby_pharmacies":
      return "💊";
    case "nearby_quincailleries":
      return "🛠️";
    case "nearby_shops":
      return "🛍️";
    default:
      return "🏪";
  }
}

function getVendorTypeLabelFromVendorType(vendorType: string): string {
  switch (vendorType) {
    case "pharmacy":
      return "Pharmacies";
    case "quincaillerie":
      return "Quincailleries";
    case "shop":
      return "Shops";
    default:
      return "Vendors";
  }
}

function getVendorTypeIconFromVendorType(vendorType: string): string {
  switch (vendorType) {
    case "pharmacy":
      return "💊";
    case "quincaillerie":
      return "🛠️";
    case "shop":
      return "🛍️";
    default:
      return "🏪";
  }
}
