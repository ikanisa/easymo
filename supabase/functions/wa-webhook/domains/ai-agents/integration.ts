/**
 * AI Agents Integration Module
 * 
 * Connects OpenAI-powered AI agents with the WhatsApp webhook system.
 * Supports all agent types: Drivers, Pharmacy, Property, Schedule Trip, Shops, Quincaillerie
 */

import type { RouterContext } from "../../types.ts";
import { isFeatureEnabled } from "../../../_shared/feature-flags.ts";
import { logAgentEvent } from "../../../_shared/agent-observability.ts";
import { sendText, sendList } from "../../wa/client.ts";
import { t } from "../../i18n/translator.ts";

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
      error: error.message,
    });

    return {
      success: false,
      sessionId: "",
      message: t(ctx.locale, "agent.error_occurred"),
    };
  }
}

/**
 * Invoke Nearby Drivers Agent
 */
async function invokeDriverAgent(
  ctx: RouterContext,
  request: AgentRequest,
): Promise<AgentResponse> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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
    throw new Error(`Driver agent error: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Invoke Pharmacy Agent
 */
async function invokePharmacyAgent(
  ctx: RouterContext,
  request: AgentRequest,
): Promise<AgentResponse> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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
    throw new Error(`Pharmacy agent error: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Invoke Property Rental Agent
 */
async function invokePropertyAgent(
  ctx: RouterContext,
  request: AgentRequest,
): Promise<AgentResponse> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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
    throw new Error(`Property agent error: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Invoke Schedule Trip Agent
 */
async function invokeScheduleTripAgent(
  ctx: RouterContext,
  request: AgentRequest,
): Promise<AgentResponse> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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
    throw new Error(`Schedule trip agent error: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Invoke General Shops Agent
 */
async function invokeShopsAgent(
  ctx: RouterContext,
  request: AgentRequest,
): Promise<AgentResponse> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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
    throw new Error(`Shops agent error: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Invoke Quincaillerie (Hardware Store) Agent
 */
async function invokeQuincaillerieAgent(
  ctx: RouterContext,
  request: AgentRequest,
): Promise<AgentResponse> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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
    throw new Error(`Quincaillerie agent error: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Send agent options to user as interactive list
 */
export async function sendAgentOptions(
  ctx: RouterContext,
  sessionId: string,
  options: any[],
  headerText: string,
) {
  if (options.length === 0) {
    await sendText(ctx.from, t(ctx.locale, "agent.no_options_found"));
    return;
  }

  const listSections = [{
    title: headerText,
    rows: options.map((option, index) => ({
      id: `agent_option_${sessionId}_${index}`,
      title: option.title,
      description: option.description,
    })),
  }];

  await sendList(ctx.from, {
    text: headerText,
    buttonText: t(ctx.locale, "agent.select_option"),
    sections: listSections,
  });
}

/**
 * Handle agent option selection
 */
export async function handleAgentSelection(
  ctx: RouterContext,
  sessionId: string,
  optionIndex: number,
): Promise<boolean> {
  try {
    // Retrieve session from database
    const { data: session } = await ctx.supabase
      .from("agent_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (!session) {
      return false;
    }

    // Get the selected option
    const options = session.metadata?.options || [];
    const selectedOption = options[optionIndex];

    if (!selectedOption) {
      return false;
    }

    // Update session with selection
    await ctx.supabase
      .from("agent_sessions")
      .update({
        selected_option: optionIndex,
        status: "option_selected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    // Send confirmation
    await sendText(
      ctx.from,
      t(ctx.locale, "agent.selection_confirmed", {
        option: selectedOption.title,
      })
    );

    logAgentEvent("AGENT_OPTION_SELECTED", {
      sessionId,
      optionIndex,
      userId: ctx.from,
    });

    return true;
  } catch (error) {
    console.error("Error handling agent selection:", error);
    return false;
  }
}

/**
 * Check agent session status
 */
export async function checkAgentSessionStatus(
  ctx: RouterContext,
  sessionId: string,
): Promise<{ status: string; message?: string; options?: any[] }> {
  const { data: session } = await ctx.supabase
    .from("agent_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (!session) {
    return { status: "not_found" };
  }

  return {
    status: session.status,
    message: session.metadata?.message,
    options: session.metadata?.options,
  };
}
