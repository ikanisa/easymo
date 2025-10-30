// Supabase Edge Function: agent-runner
//
// Executes OpenAI agents with proper authentication, validation, and observability.
// Supports BookingAgent, TokenRedemptionAgent, and TriageAgent.

import { serve } from "$std/http/server.ts";
import { getServiceClient } from "shared/supabase.ts";
import { requireAdmin } from "shared/auth.ts";
import { z } from "zod";

// Feature flag check
const ENABLE_AGENTS = ["1", "true", "yes"].includes(
  (Deno.env.get("ENABLE_AGENTS") ?? "false").toLowerCase(),
);

const RequestSchema = z.object({
  agentName: z.enum(["booking", "redemption", "triage"]),
  userId: z.string().uuid(),
  query: z.string().min(1).max(2000),
  sessionId: z.string().uuid().optional(),
  context: z.record(z.any()).optional(),
}).strict();

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers });
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  // Check feature flag
  if (!ENABLE_AGENTS) {
    return respond(403, {
      error: "feature_disabled",
      message: "Agent functionality is not enabled",
    });
  }

  // Verify admin authentication
  const authResponse = requireAdmin(req);
  if (authResponse) return authResponse;

  // Only POST method allowed
  if (req.method !== "POST") {
    return respond(405, { error: "method_not_allowed" });
  }

  const startTime = Date.now();

  try {
    // Parse and validate request
    const body = await req.json();
    const parseResult = RequestSchema.safeParse(body);

    if (!parseResult.success) {
      return respond(400, {
        error: "invalid_request",
        details: parseResult.error.errors,
      });
    }

    const { agentName, userId, query, sessionId, context } = parseResult.data;

    // Log structured event
    console.log(JSON.stringify({
      event: "AGENT_EXECUTION_REQUEST",
      timestamp: new Date().toISOString(),
      agentName,
      userId,
      sessionId,
      queryLength: query.length,
    }));

    // NOTE: In production, this would import and run the actual agent from @easymo/agents
    // For now, we provide a mock response since Edge Functions can't import NPM packages yet
    // TODO: Integrate with @easymo/agents when Deno NPM support is stable
    
    const result = {
      success: true,
      finalOutput: getMockResponse(agentName, query),
      agentName,
      toolsInvoked: getMockTools(agentName),
      duration: Date.now() - startTime,
    };

    // Store trace in Supabase
    const supabase = getServiceClient();
    await supabase.from("agent_traces").insert({
      agent_name: agentName,
      user_id: userId,
      session_id: sessionId,
      query: query.substring(0, 500),
      result: result,
      duration_ms: result.duration,
      tools_invoked: result.toolsInvoked,
    });

    // Log completion
    console.log(JSON.stringify({
      event: "AGENT_EXECUTION_COMPLETE",
      timestamp: new Date().toISOString(),
      agentName,
      userId,
      sessionId,
      success: true,
      durationMs: result.duration,
      toolsInvoked: result.toolsInvoked,
    }));

    return respond(200, result);
  } catch (error) {
    const durationMs = Date.now() - startTime;
    
    console.error(JSON.stringify({
      event: "AGENT_EXECUTION_FAILED",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      durationMs,
    }));

    return respond(500, {
      error: "agent_execution_failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Mock response generator
 * TODO: Replace with actual agent execution
 */
function getMockResponse(agentName: string, query: string): string {
  const lowerQuery = query.toLowerCase();

  if (agentName === "booking") {
    if (lowerQuery.includes("availability") || lowerQuery.includes("available")) {
      return "I can check availability for you! We have several time slots available this week:\n\n1. Friday, 5:00-7:00 PM at Kigali City Center (15/50 spots taken)\n2. Friday, 7:00-9:00 PM at Kigali City Center (35/50 spots taken)\n3. Saturday, 5:00-7:00 PM at Nyamirambo (8/50 spots taken)\n\nWhich slot would you like to book?";
    }
    if (lowerQuery.includes("book") || lowerQuery.includes("reserve")) {
      return "Great! I'll help you create a booking. To complete your reservation, I'll need:\n1. Your preferred time slot (from the available options)\n2. Number of guests\n3. Any special requests\n\nYour booking will be confirmed once these details are provided.";
    }
    return "I'm your booking assistant! I can help you:\n- Check available time slots\n- Make reservations for the bar-truck\n- View your current bookings\n- Answer questions about our service\n\nWhat would you like to do?";
  }

  if (agentName === "redemption") {
    if (lowerQuery.includes("balance")) {
      return "Here's your current balance:\n\n• Vouchers: 5,000 RWF (expires Dec 31, 2025)\n• Reward Points: 150 points\n• Account Credit: 10,000 RWF\n\nYou have a total of 15,000 RWF in redeemable value!";
    }
    if (lowerQuery.includes("redeem")) {
      return "I can help you redeem your tokens! You have:\n- 5,000 RWF in vouchers\n- 150 reward points\n- 10,000 RWF in credits\n\nWhat would you like to redeem today?";
    }
    return "I'm your token management assistant! I can help you:\n- Check your balance\n- Redeem vouchers and tokens\n- View transaction history\n- Track expiring vouchers\n\nWhat would you like to do?";
  }

  if (agentName === "triage") {
    // Simple intent detection
    if (lowerQuery.includes("book") || lowerQuery.includes("reserve") || lowerQuery.includes("availability")) {
      return "I can help you with that! Let me connect you to our booking assistant who specializes in reservations and availability.";
    }
    if (lowerQuery.includes("balance") || lowerQuery.includes("voucher") || lowerQuery.includes("redeem")) {
      return "I can help you with that! Let me connect you to our token management assistant who handles balances and redemptions.";
    }
    return "Hello! I'm here to help you with the EasyMO platform. I can assist with:\n- Bookings and reservations\n- Token and voucher management\n- Menu inquiries\n- General questions\n\nHow can I help you today?";
  }

  return "Agent response";
}

/**
 * Mock tools list
 * TODO: Replace with actual tools invoked
 */
function getMockTools(agentName: string): string[] {
  if (agentName === "booking") {
    return ["CheckAvailability"];
  }
  if (agentName === "redemption") {
    return ["CheckBalance"];
  }
  if (agentName === "triage") {
    return [];
  }
  return [];
}
