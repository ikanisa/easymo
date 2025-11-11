/**
 * AI Agents Integration Module
 * 
 * Connects database search agents with the WhatsApp webhook system.
 * Agents search ONLY from database - NO web search or external APIs.
 * All agents must have proper error handling and fallback messages.
 */

import type { RouterContext } from "../../types.ts";
import { isFeatureEnabled } from "../../../_shared/feature-flags.ts";
import { logAgentEvent } from "../../../_shared/agent-observability.ts";
import { sendText, sendList } from "../../wa/client.ts";
import { sendButtonsMessage, buildButtons } from "../../utils/reply.ts";
import { t } from "../../i18n/translator.ts";
import { IDS } from "../../wa/ids.ts";

export interface AgentRequest {
  userId: string;
  agentType: "nearby_drivers" | "pharmacy" | "property_rental" | "schedule_trip" | "shops" | "quincaillerie";
  flowType: string;
  requestData: any;
  location?: { latitude: number; longitude: number; text?: string };
}

export interface AgentResponse {
  success: boolean;
  sessionId: string;
  message: string;
  options?: any[];
  metadata?: Record<string, any>;
}

/**
 * Route request to appropriate AI agent based on intent
 */
export async function routeToAIAgent(
  ctx: RouterContext,
  request: AgentRequest,
): Promise<AgentResponse> {
  const agentEnabled = isFeatureEnabled(`agent.${request.agentType}`);
  
  if (!agentEnabled) {
    return {
      success: false,
      sessionId: "",
      message: t(ctx.locale, "agent.not_available"),
    };
  }

  logAgentEvent("AGENT_REQUEST_ROUTED", {
    userId: request.userId,
    agentType: request.agentType,
    flowType: request.flowType,
  });

  try {
    // Route to specific agent
    switch (request.agentType) {
      case "nearby_drivers":
        return await invokeDriverAgent(ctx, request);
      
      case "pharmacy":
        return await invokePharmacyAgent(ctx, request);
      
      case "property_rental":
        return await invokePropertyAgent(ctx, request);
      
      case "schedule_trip":
        return await invokeScheduleTripAgent(ctx, request);
      
      case "shops":
        return await invokeShopsAgent(ctx, request);
      
      case "quincaillerie":
        return await invokeQuincaillerieAgent(ctx, request);
      
      default:
        throw new Error(`Unknown agent type: ${request.agentType}`);
    }
  } catch (error) {
    console.error("AI Agent routing error:", error);
    logAgentEvent("AGENT_ERROR", {
      userId: request.userId,
      agentType: request.agentType,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      sessionId: "",
      message: t(ctx.locale, "agent.error_occurred"),
    };
  }
}

/**
 * Invoke Nearby Drivers Agent - DATABASE SEARCH ONLY
 */
async function invokeDriverAgent(
  ctx: RouterContext,
  request: AgentRequest,
): Promise<AgentResponse> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error("Missing Supabase credentials");
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/agent-negotiation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        userId: request.userId,
        agentType: "driver",
        flowType: request.flowType,
        pickupLocation: request.requestData.pickup,
        dropoffLocation: request.requestData.dropoff,
        vehicleType: request.requestData.vehicleType,
        maxPrice: request.requestData.maxPrice,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Driver agent HTTP error:", response.status, errorText);
      
      // Return fallback response
      return {
        success: false,
        sessionId: "",
        message: "🚖 Sorry, we couldn't find drivers at this moment. This might be because:\n\n" +
                 "• No drivers are currently available in your area\n" +
                 "• The service is temporarily unavailable\n\n" +
                 "Please try again in a few minutes or use the traditional driver search.",
      };
    }

    return await response.json();
  } catch (error) {
    console.error("Driver agent error:", error);
    
    return {
      success: false,
      sessionId: "",
      message: "🚖 Unable to search for drivers right now. Please try:\n\n" +
               "• Checking your internet connection\n" +
               "• Using the traditional 'See Drivers' option\n" +
               "• Trying again in a few minutes",
    };
  }
}

/**
 * Invoke Pharmacy Agent - DATABASE SEARCH ONLY
 */
async function invokePharmacyAgent(
  ctx: RouterContext,
  request: AgentRequest,
): Promise<AgentResponse> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error("Missing Supabase credentials");
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/agent-negotiation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        userId: request.userId,
        agentType: "pharmacy",
        flowType: request.flowType,
        location: request.location,
        medications: request.requestData.medications,
        prescriptionImage: request.requestData.prescriptionImage,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Pharmacy agent HTTP error:", response.status, errorText);
      
      return {
        success: false,
        sessionId: "",
        message: "💊 Sorry, we couldn't find pharmacies at this moment. This might be because:\n\n" +
                 "• No pharmacies are registered in your area yet\n" +
                 "• The service is temporarily unavailable\n\n" +
                 "💡 Tip: We're constantly adding new pharmacies to our database!",
      };
    }

    return await response.json();
  } catch (error) {
    console.error("Pharmacy agent error:", error);
    
    return {
      success: false,
      sessionId: "",
      message: "💊 Unable to search pharmacies right now. Please try:\n\n" +
               "• Checking your internet connection\n" +
               "• Trying again in a few minutes\n" +
               "• Contacting support if the issue persists",
    };
  }
}

/**
 * Invoke Property Rental Agent - DATABASE SEARCH ONLY
 */
async function invokePropertyAgent(
  ctx: RouterContext,
  request: AgentRequest,
): Promise<AgentResponse> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error("Missing Supabase credentials");
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/agent-property-rental`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        userId: request.userId,
        action: request.requestData.action,
        rentalType: request.requestData.rentalType,
        bedrooms: request.requestData.bedrooms,
        minBudget: request.requestData.minBudget,
        maxBudget: request.requestData.maxBudget,
        location: request.location,
        address: request.requestData.address,
        amenities: request.requestData.amenities,
        propertyData: request.requestData.propertyData,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Property agent HTTP error:", response.status, errorText);
      
      return {
        success: false,
        sessionId: "",
        message: "🏠 Sorry, we couldn't find properties at this moment. This might be because:\n\n" +
                 "• No properties match your criteria in this area\n" +
                 "• The service is temporarily unavailable\n\n" +
                 "💡 Try adjusting your budget or location for better results!",
      };
    }

    return await response.json();
  } catch (error) {
    console.error("Property agent error:", error);
    
    return {
      success: false,
      sessionId: "",
      message: "🏠 Unable to search properties right now. Please try:\n\n" +
               "• Checking your internet connection\n" +
               "• Adjusting your search criteria\n" +
               "• Trying again in a few minutes",
    };
  }
}

/**
 * Invoke Schedule Trip Agent - DATABASE SEARCH ONLY
 */
/**
 * Invoke Schedule Trip Agent - WITH ENHANCED 3-TIER FALLBACK
 * 
 * Fallback strategy:
 * 1. Try AI agent scheduling (primary)
 * 2. Fall back to direct database insert (manual scheduling)
 * 3. Return user-friendly error with alternatives
 */
async function invokeScheduleTripAgent(
  ctx: RouterContext,
  request: AgentRequest,
): Promise<AgentResponse> {
  const supabaseClient = ctx.locals.supabase;
  
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error("Missing Supabase credentials");
    }

    // TIER 1: Try AI agent scheduling
    const response = await fetch(`${SUPABASE_URL}/functions/v1/agent-schedule-trip`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        userId: request.userId,
        action: request.requestData.action,
        pickupLocation: request.requestData.pickup,
        dropoffLocation: request.requestData.dropoff,
        scheduledTime: request.requestData.scheduledTime,
        recurrence: request.requestData.recurrence,
        vehiclePreference: request.requestData.vehicleType,
        maxPrice: request.requestData.maxPrice,
        flexibilityMinutes: request.requestData.flexibilityMinutes,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Schedule trip agent HTTP error:", response.status, errorText);
      
      // TIER 2: Fallback to direct database insert
      console.log("FALLBACK: Attempting direct schedule trip creation");
      
      try {
        const scheduledDate = new Date(request.requestData.scheduledTime);
        
        const { data: trip, error: dbError } = await supabaseClient
          .from("scheduled_trips")
          .insert({
            user_id: request.userId,
            pickup_location: `POINT(${request.requestData.pickup.longitude} ${request.requestData.pickup.latitude})`,
            dropoff_location: `POINT(${request.requestData.dropoff.longitude} ${request.requestData.dropoff.latitude})`,
            pickup_address: request.requestData.pickup.address || "Unknown",
            dropoff_address: request.requestData.dropoff.address || "Unknown",
            scheduled_time: scheduledDate.toISOString(),
            vehicle_preference: request.requestData.vehicleType || "Moto",
            recurrence: request.requestData.recurrence || "once",
            max_price: request.requestData.maxPrice,
            notification_minutes: 30,
            flexibility_minutes: request.requestData.flexibilityMinutes || 15,
            status: "scheduled",
          })
          .select()
          .single();

        if (dbError) {
          console.error("Fallback database insert failed:", dbError);
          throw dbError;
        }

        console.log("FALLBACK SUCCESS: Trip scheduled via direct DB insert");
        
        return {
          success: true,
          sessionId: trip.id,
          message: `✅ Trip scheduled successfully!\n\n` +
                   `🕐 **Time**: ${scheduledDate.toLocaleString()}\n` +
                   `🚗 **Vehicle**: ${request.requestData.vehicleType || "Moto"}\n` +
                   `📍 **From**: ${request.requestData.pickup.address || "Your location"}\n` +
                   `📍 **To**: ${request.requestData.dropoff.address || "Destination"}\n\n` +
                   `You'll receive a notification 30 minutes before. Check "My Trips" to manage.`,
          metadata: {
            tripId: trip.id,
            fallbackUsed: true,
            scheduledTime: scheduledDate.toISOString(),
          },
        };
      } catch (fallbackError) {
        console.error("All fallbacks failed:", fallbackError);
        
        // TIER 3: User-friendly error with alternatives
        return {
          success: false,
          sessionId: "",
          message: "🛵 Sorry, we couldn't schedule your trip at this moment. This might be because:\n\n" +
                   "• The scheduling service is temporarily unavailable\n" +
                   "• There was an issue processing your request\n\n" +
                   "💡 **What you can do**:\n" +
                   "• Try the manual trip scheduling option\n" +
                   "• Book a regular trip instead\n" +
                   "• Try again in a few minutes",
        };
      }
    }

    return await response.json();
  } catch (error) {
    console.error("Schedule trip agent error:", error);
    
    // TIER 3: Network/system error fallback
    return {
      success: false,
      sessionId: "",
      message: "🛵 Unable to schedule trip right now. Please try:\n\n" +
               "• Checking your internet connection\n" +
               "• Using the traditional trip scheduling from the menu\n" +
               "• Booking a regular trip instead\n" +
               "• Trying again in a few minutes\n\n" +
               "If the issue persists, contact support.",
    };
  }
}

/**
 * Invoke General Shops Agent - DATABASE SEARCH ONLY
 */
async function invokeShopsAgent(
  ctx: RouterContext,
  request: AgentRequest,
): Promise<AgentResponse> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error("Missing Supabase credentials");
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/agent-shops`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        userId: request.userId,
        action: request.requestData.action,
        location: request.location,
        items: request.requestData.items,
        itemImage: request.requestData.itemImage,
        shopCategory: request.requestData.shopCategory,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Shops agent HTTP error:", response.status, errorText);
      
      return {
        success: false,
        sessionId: "",
        message: "🛍️ Sorry, we couldn't find shops at this moment. This might be because:\n\n" +
                 "• No shops are registered in your area yet\n" +
                 "• The service is temporarily unavailable\n\n" +
                 "💡 You can browse the marketplace or try again later!",
      };
    }

    return await response.json();
  } catch (error) {
    console.error("Shops agent error:", error);
    
    return {
      success: false,
      sessionId: "",
      message: "🛍️ Unable to search shops right now. Please try:\n\n" +
               "• Browsing the marketplace manually\n" +
               "• Checking your internet connection\n" +
               "• Trying again in a few minutes",
    };
  }
}

/**
 * Invoke Quincaillerie (Hardware Store) Agent - DATABASE SEARCH ONLY
 */
async function invokeQuincaillerieAgent(
  ctx: RouterContext,
  request: AgentRequest,
): Promise<AgentResponse> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error("Missing Supabase credentials");
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/agent-quincaillerie`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        userId: request.userId,
        location: request.location,
        items: request.requestData.items,
        itemImage: request.requestData.itemImage,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Quincaillerie agent HTTP error:", response.status, errorText);
      
      return {
        success: false,
        sessionId: "",
        message: "🔧 Sorry, we couldn't find hardware stores at this moment. This might be because:\n\n" +
                 "• No hardware stores are registered in your area yet\n" +
                 "• The service is temporarily unavailable\n\n" +
                 "💡 We're constantly adding new stores to our database!",
      };
    }

    return await response.json();
  } catch (error) {
    console.error("Quincaillerie agent error:", error);
    
    return {
      success: false,
      sessionId: "",
      message: "🔧 Unable to search hardware stores right now. Please try:\n\n" +
               "• Checking your internet connection\n" +
               "• Trying again in a few minutes\n" +
               "• Contacting support if the issue persists",
    };
  }
}

/**
 * Send agent options to user as interactive list with fallback buttons
 */
export async function sendAgentOptions(
  ctx: RouterContext,
  sessionId: string,
  options: any[],
  headerText: string,
) {
  try {
    if (options.length === 0) {
      await sendButtonsMessage(
        ctx,
        "😔 No results found at this moment.\n\n" +
        "This might be because:\n" +
        "• No matches in your area yet\n" +
        "• Try adjusting your search criteria\n" +
        "• Check back later - we're always adding new listings!",
        buildButtons(
          { id: IDS.BACK_HOME, title: "🏠 Back to Home" }
        )
      );
      return;
    }

    const listSections = [{
      title: headerText,
      rows: options.map((option, index) => ({
        id: `agent_option_${sessionId}_${index}`,
        title: option.title || `Option ${index + 1}`,
        description: option.description || "Tap to select",
      })),
    }];

    await sendList(ctx.from, {
      title: headerText,
      body: "Select one of the options below:",
      sectionTitle: headerText,
      buttonText: t(ctx.locale, "agent.select_option") || "Select",
      rows: listSections[0].rows,
    });
  } catch (error) {
    console.error("Error sending agent options:", error);
    
    // Fallback to text message if interactive list fails
    await sendButtonsMessage(
      ctx,
      `${headerText}\n\n` +
      `We found ${options.length} option(s) for you! 🎉\n\n` +
      "However, we're having trouble displaying them right now. This is usually temporary.\n\n" +
      "Please:\n" +
      "• Try again in a moment\n" +
      "• Use the traditional search\n" +
      "• Contact support if needed",
      buildButtons(
        { id: IDS.BACK_HOME, title: "🏠 Back to Home" }
      )
    );
  }
}

/**
 * Handle agent option selection with proper error handling
 */
export async function handleAgentSelection(
  ctx: RouterContext,
  sessionId: string,
  optionIndex: number,
): Promise<boolean> {
  try {
    // Retrieve session from database
    const { data: session, error } = await ctx.supabase
      .from("agent_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (error || !session) {
      console.error("Error fetching agent session:", error);
      
      await sendButtonsMessage(
        ctx,
        "😔 Sorry, your selection session has expired or couldn't be found.\n\n" +
        "This can happen if:\n" +
        "• You waited too long to select (sessions expire after 10 minutes)\n" +
        "• Network issues interrupted the connection\n\n" +
        "Please start a new search. 🔍",
        buildButtons(
          { id: IDS.BACK_HOME, title: "🏠 Back to Home" }
        )
      );
      return false;
    }

    // Get the selected option
    const options = session.metadata?.options || [];
    const selectedOption = options[optionIndex];

    if (!selectedOption) {
      await sendButtonsMessage(
        ctx,
        "😔 The selected option is no longer available.\n\n" +
        "Please try a new search.",
        buildButtons(
          { id: IDS.BACK_HOME, title: "🏠 Back to Home" }
        )
      );
      return false;
    }

    // Update session with selection
    const { error: updateError } = await ctx.supabase
      .from("agent_sessions")
      .update({
        selected_option: optionIndex,
        status: "option_selected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (updateError) {
      console.error("Error updating agent session:", updateError);
    }

    // Send confirmation with next actions
    await sendButtonsMessage(
      ctx,
      `✅ Great choice!\n\n` +
      `You selected: *${selectedOption.title}*\n\n` +
      `${selectedOption.description || ""}\n\n` +
      "What would you like to do next?",
      buildButtons(
        { id: "contact_provider", title: "📞 Contact" },
        { id: "view_details", title: "ℹ️ View Details" },
        { id: IDS.BACK_HOME, title: "🏠 Home" }
      )
    );

    logAgentEvent("AGENT_OPTION_SELECTED", {
      sessionId,
      optionIndex,
      userId: ctx.from,
    });

    return true;
  } catch (error) {
    console.error("Error handling agent selection:", error);
    
    await sendButtonsMessage(
      ctx,
      "😔 Sorry, something went wrong while processing your selection.\n\n" +
      "Please try again or start a new search.",
      buildButtons(
        { id: IDS.BACK_HOME, title: "🏠 Back to Home" }
      )
    );
    
    return false;
  }
}

/**
 * Check agent session status with proper error handling
 */
export async function checkAgentSessionStatus(
  ctx: RouterContext,
  sessionId: string,
): Promise<{ status: string; message?: string; options?: any[] }> {
  try {
    const { data: session, error } = await ctx.supabase
      .from("agent_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (error) {
      console.error("Error checking agent session status:", error);
      return { status: "error", message: "Unable to check session status" };
    }

    if (!session) {
      return { status: "not_found", message: "Session not found or expired" };
    }

    return {
      status: session.status,
      message: session.metadata?.message,
      options: session.metadata?.options,
    };
  } catch (error) {
    console.error("Exception checking agent session:", error);
    return { status: "error", message: "System error occurred" };
  }
}
