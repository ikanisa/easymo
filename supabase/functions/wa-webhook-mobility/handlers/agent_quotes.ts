import type { RouterContext } from "../../types.ts";
import { isFeatureEnabled } from "../../_shared/feature-flags.ts";
import { logAgentEvent, maskPhone } from "../../_shared/agent-observability.ts";
import { sendWhatsAppMessage } from "../../wa/send.ts";

/**
 * Agent Quote Request Handler
 * 
 * Sends quote requests to vendors (drivers, pharmacies, etc.) via WhatsApp
 * and handles their responses for agent negotiation sessions.
 */

interface QuoteRequestParams {
  vendorPhone: string;
  vendorName?: string;
  sessionId: string;
  flowType: string;
  requestDetails: {
    pickup?: { lat: number; lng: number; text?: string };
    dropoff?: { lat: number; lng: number; text?: string };
    vehicleType?: string;
    distance?: number;
    description?: string;
  };
}

/**
 * Send quote request to a driver
 */
export async function sendDriverQuoteRequest(
  ctx: RouterContext,
  params: QuoteRequestParams,
): Promise<boolean> {
  if (!isFeatureEnabled("agent.negotiation")) {
    return false;
  }

  try {
    const { vendorPhone, sessionId, requestDetails } = params;

    // Format quote request message
    const message = formatDriverQuoteRequest(requestDetails);

    // Send WhatsApp message
    const sent = await sendWhatsAppMessage(ctx, {
      to: vendorPhone,
      type: "text",
      text: { body: message },
    });

    if (sent) {
      logAgentEvent("AGENT_QUOTE_SENT", {
        sessionId,
        vendorPhone: maskPhone(vendorPhone),
        vendorType: "driver",
      });
    }

    return sent;
  } catch (error) {
    console.error("Failed to send driver quote request:", error);
    return false;
  }
}

/**
 * Format driver quote request message
 */
function formatDriverQuoteRequest(details: QuoteRequestParams["requestDetails"]): string {
  let message = "🚕 *New Ride Request - Quote Needed*\n\n";

  if (details.pickup?.text) {
    message += `📍 *Pickup:* ${details.pickup.text}\n`;
  } else if (details.pickup) {
    message += `📍 *Pickup:* ${details.pickup.lat.toFixed(5)}, ${details.pickup.lng.toFixed(5)}\n`;
  }

  if (details.dropoff?.text) {
    message += `🎯 *Dropoff:* ${details.dropoff.text}\n`;
  } else if (details.dropoff) {
    message += `🎯 *Dropoff:* ${details.dropoff.lat.toFixed(5)}, ${details.dropoff.lng.toFixed(5)}\n`;
  }

  if (details.distance) {
    message += `📏 *Distance:* ${details.distance.toFixed(1)} km\n`;
  }

  if (details.vehicleType) {
    message += `🏍️ *Vehicle:* ${details.vehicleType}\n`;
  }

  message += "\n💰 *Please reply with your quote price (RWF)*\n";
  message += "⏱️ *Reply within 5 minutes*\n\n";
  message += "Example: 3500 RWF";

  return message;
}

/**
 * Parse driver quote response
 */
export function parseDriverQuoteResponse(text: string): {
  priceAmount: number | null;
  estimatedTimeMinutes: number | null;
  notes: string | null;
} {
  let priceAmount: number | null = null;
  let estimatedTimeMinutes: number | null = null;
  let notes: string | null = null;

  // Try to extract price (formats: "3500", "3500 RWF", "RWF 3500", "3,500")
  const priceMatch = text.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*(?:RWF|Frw?)?/i);
  if (priceMatch) {
    const priceStr = priceMatch[1].replace(/,/g, "");
    const price = parseInt(priceStr, 10);
    if (!isNaN(price) && price > 0 && price < 1000000) {
      priceAmount = price;
    }
  }

  // Try to extract time (formats: "15 min", "15min", "15 minutes")
  const timeMatch = text.match(/(\d+)\s*(?:min(?:ute)?s?)/i);
  if (timeMatch) {
    const time = parseInt(timeMatch[1], 10);
    if (!isNaN(time) && time > 0 && time < 300) {
      estimatedTimeMinutes = time;
    }
  }

  // Extract notes (everything that's not price/time)
  const cleanText = text
    .replace(/(\d{1,3}(?:,\d{3})*|\d+)\s*(?:RWF|Frw?)?/gi, "")
    .replace(/(\d+)\s*(?:min(?:ute)?s?)/gi, "")
    .trim();

  if (cleanText.length > 0 && cleanText.length < 200) {
    notes = cleanText;
  }

  return { priceAmount, estimatedTimeMinutes, notes };
}

/**
 * Handle incoming quote response from driver
 */
export async function handleDriverQuoteResponse(
  ctx: RouterContext,
  text: string,
): Promise<boolean> {
  if (!isFeatureEnabled("agent.negotiation")) {
    return false;
  }

  try {
    // Check if user has pending quote requests
    const { data: pendingQuotes, error } = await ctx.supabase
      .from("agent_quotes")
      .select("session_id, vendor_phone")
      .eq("vendor_phone", ctx.from)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error || !pendingQuotes || pendingQuotes.length === 0) {
      return false;
    }

    const quote = pendingQuotes[0];
    const parsed = parseDriverQuoteResponse(text);

    if (!parsed.priceAmount) {
      // Invalid response format
      await sendWhatsAppMessage(ctx, {
        to: ctx.from,
        type: "text",
        text: {
          body: "❌ Invalid quote format. Please reply with a price (e.g., '3500 RWF')",
        },
      });
      return true;
    }

    // Update quote with response
    await ctx.supabase
      .from("agent_quotes")
      .update({
        status: "received",
        price_amount: parsed.priceAmount,
        estimated_time_minutes: parsed.estimatedTimeMinutes,
        notes: parsed.notes,
        received_at: new Date().toISOString(),
      })
      .eq("session_id", quote.session_id)
      .eq("vendor_phone", ctx.from);

    logAgentEvent("AGENT_QUOTE_RECEIVED", {
      sessionId: quote.session_id,
      vendorPhone: maskPhone(ctx.from),
      priceAmount: parsed.priceAmount,
      estimatedTime: parsed.estimatedTimeMinutes,
    });

    // Send confirmation
    await sendWhatsAppMessage(ctx, {
      to: ctx.from,
      type: "text",
      text: {
        body: `✅ Quote received: ${parsed.priceAmount} RWF${
          parsed.estimatedTimeMinutes ? ` (${parsed.estimatedTimeMinutes} min)` : ""
        }\n\nThank you! The customer will be notified.`,
      },
    });

    return true;
  } catch (error) {
    console.error("Failed to handle driver quote response:", error);
    return false;
  }
}

/**
 * Send quote presentation to user
 */
export async function sendQuotePresentationToUser(
  ctx: RouterContext,
  sessionId: string,
): Promise<boolean> {
  if (!isFeatureEnabled("agent.negotiation")) {
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

    // Format presentation message
    let message = "🎯 *Found Drivers for Your Trip!*\n\n";
    message += `I collected ${quotes.length} quote${quotes.length > 1 ? "s" : ""} for you:\n\n`;

    quotes.forEach((quote, index) => {
      message += `${index + 1}️⃣ *${quote.price_amount} RWF*`;
      if (quote.estimated_time_minutes) {
        message += ` - ${quote.estimated_time_minutes} min`;
      }
      if (quote.notes) {
        message += `\n   ${quote.notes}`;
      }
      message += "\n\n";
    });

    message += "💡 Reply with the number (1, 2, or 3) to select a driver.";

    await sendWhatsAppMessage(ctx, {
      to: session.user_id,
      type: "text",
      text: { body: message },
    });

    logAgentEvent("AGENT_PARTIAL_RESULTS_PRESENTED", {
      sessionId,
      quotesCount: quotes.length,
    });

    return true;
  } catch (error) {
    console.error("Failed to send quote presentation:", error);
    return false;
  }
}
