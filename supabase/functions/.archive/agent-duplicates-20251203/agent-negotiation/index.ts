import { createServiceRoleClient, handleOptions, json } from "../_shared/admin.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";
import { logStructuredEvent, logError } from "../_shared/observability.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";
import { isFeatureEnabled } from "../_shared/feature-flags.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";
import {
  logNegotiationStart,
  logVendorContact,
  logAgentError,
  maskPhone,
} from "../_shared/agent-observability.ts";

/**
 * Agent Negotiation Edge Function
 * 
 * Handles agent-driven negotiation flows for drivers, pharmacies, and other vendors.
 * Integrates with the orchestrator service to manage 5-minute negotiation windows.
 * 
 * Endpoints:
 * - POST /agent-negotiation/start - Start a new negotiation session
 * - POST /agent-negotiation/quote - Add a vendor quote
 * - GET /agent-negotiation/status/:sessionId - Get session status
 * - POST /agent-negotiation/complete - Complete negotiation with selected quote
 */

const supabase = createServiceRoleClient();

interface StartNegotiationRequest {
  userId: string;
  flowType: "nearby_drivers" | "nearby_pharmacies" | "nearby_quincailleries" | "nearby_shops";
  requestData: {
    pickup?: { lat: number; lng: number };
    dropoff?: { lat: number; lng: number };
    vehicleType?: string;
    radiusMeters?: number;
    description?: string;
  };
  windowMinutes?: number;
}

interface AddQuoteRequest {
  sessionId: string;
  vendorId?: string;
  vendorPhone: string;
  vendorType: "driver" | "pharmacy" | "quincaillerie" | "shop";
  priceAmount?: number;
  estimatedTimeMinutes?: number;
  notes?: string;
  offerData?: Record<string, unknown>;
}

/**
 * Start a new negotiation session
 */
async function startNegotiation(req: Request): Promise<Response> {
  const startTime = Date.now();

  // Check feature flags
  if (!isFeatureEnabled("agent.negotiation")) {
    return json({ error: "feature_disabled", message: "Agent negotiation is not enabled" }, 403);
  }

  let payload: StartNegotiationRequest;
  try {
    payload = await req.json() as StartNegotiationRequest;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  // Validate required fields
  if (!payload.userId || !payload.flowType || !payload.requestData) {
    return json({ error: "missing_required_fields" }, 400);
  }
  
  // Marketplace flag removed; flows are handled per-category (pharmacy/quincaillerie/shops)

  const windowMinutes = payload.windowMinutes ?? 5;
  const now = new Date();
  const deadline = new Date(now.getTime() + windowMinutes * 60 * 1000);

  try {
    // Create agent session
    const { data: session, error: sessionError } = await supabase
      .from("agent_sessions")
      .insert({
        user_id: payload.userId,
        flow_type: payload.flowType,
        status: "searching",
        request_data: payload.requestData,
        started_at: now.toISOString(),
        deadline_at: deadline.toISOString(),
        quotes_collected: [],
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    logNegotiationStart(session.id, payload.flowType, payload.userId, windowMinutes);

    // For nearby_drivers flow, find matching drivers
    if (payload.flowType === "nearby_drivers" && payload.requestData.pickup) {
      await findAndContactDrivers(session.id, payload);
    }
    
    // Category-specific vendor flows (pharmacy/quincaillerie/shops)
    if (["nearby_pharmacies", "nearby_quincailleries", "nearby_shops"].includes(payload.flowType)) {
      await findAndContactNearbyVendors(session.id, payload);
    }

    await logStructuredEvent("AGENT_SESSION_CREATED", {
      sessionId: session.id,
      flowType: payload.flowType,
      userId: maskPhone(payload.userId),
      windowMinutes,
      deadlineAt: deadline.toISOString(),
    });

    return json({
      success: true,
      sessionId: session.id,
      status: session.status,
      deadlineAt: deadline.toISOString(),
      windowMinutes,
    });
  } catch (error) {
    logAgentError("negotiation_start", error, {
      userId: maskPhone(payload.userId),
      flowType: payload.flowType,
    });
    return json({ error: "negotiation_start_failed", message: String(error) }, 500);
  }
}

/**
 * Find matching drivers and send quote requests
 */
async function findAndContactDrivers(
  sessionId: string,
  request: StartNegotiationRequest,
): Promise<void> {
  const { requestData } = request;

  if (!requestData.pickup) {
    throw new Error("Pickup location required for driver matching");
  }

  // Create temporary trip for matching
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .insert({
      creator_user_id: request.userId,
      role: "passenger",
      vehicle_type: requestData.vehicleType ?? "moto",
      pickup_lat: requestData.pickup.lat,
      pickup_lng: requestData.pickup.lng,
      pickup: `SRID=4326;POINT(${requestData.pickup.lng} ${requestData.pickup.lat})`,
      pickup_radius_m: requestData.radiusMeters ?? 5000,
      status: "open",
      agent_session_id: sessionId,
    })
    .select("id")
    .single();

  if (tripError) throw tripError;

  // Call match_drivers_for_trip_v2
  const { data: matches, error: matchError } = await supabase.rpc(
    "match_drivers_for_trip_v2",
    {
      _trip_id: trip.id,
      _limit: 10,
      _prefer_dropoff: false,
      _radius_m: requestData.radiusMeters ?? 5000,
      _window_days: 30,
    },
  );

  if (matchError) throw matchError;

  await logStructuredEvent("DRIVERS_MATCHED", {
    sessionId,
    tripId: trip.id,
    matchCount: matches?.length ?? 0,
  });

  // Send quote requests to drivers (will be implemented in wa-webhook)
  if (matches && matches.length > 0) {
    // Update session status to negotiating
    await supabase
      .from("agent_sessions")
      .update({ status: "negotiating" })
      .eq("id", sessionId);

    // Log vendor contacts
    for (const match of matches) {
      logVendorContact(sessionId, match.creator_user_id, "driver", "whatsapp");
      
      // Create pending quotes
      await supabase.from("agent_quotes").insert({
        session_id: sessionId,
        vendor_id: match.creator_user_id,
        vendor_type: "driver",
        vendor_phone: match.whatsapp_e164,
        status: "pending",
        offer_data: {
          distance_km: match.distance_km,
          ref_code: match.ref_code,
        },
        sent_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min expiry
      });
    }
  } else {
    // No drivers found, move to timeout
    await supabase
      .from("agent_sessions")
      .update({ 
        status: "timeout",
        result_data: { reason: "no_drivers_found" },
      })
      .eq("id", sessionId);
  }
}

/**
 * Find matching vendors (pharmacy/quincaillerie/shops) and send quote requests
*/
async function findAndContactNearbyVendors(
  sessionId: string,
  request: StartNegotiationRequest,
): Promise<void> {
  const { requestData, flowType } = request;

  if (!requestData.pickup) {
    throw new Error("Location required for vendor matching");
  }

  // Determine category based on flow type
  const categoryMap: Record<string, string> = {
    "nearby_pharmacies": "pharmacies",
    "nearby_quincailleries": "quincailleries",
    "nearby_shops": "shops",
  };
  
  const category = categoryMap[flowType] || null;
  const vendorTypeMap: Record<string, string> = {
    "nearby_pharmacies": "pharmacy",
    "nearby_quincailleries": "quincaillerie",
    "nearby_shops": "shop",
  };
  const vendorType = vendorTypeMap[flowType] || "other";

  // Find nearby businesses using RPC
  const { data: vendors, error: vendorsError } = await supabase.rpc(
    "nearby_businesses_v2",
    {
      _lat: requestData.pickup.lat,
      _lng: requestData.pickup.lng,
      _viewer: "",
      _category_slug: category,
      _limit: 10,
    },
  );

  if (vendorsError) {
    await logStructuredEvent("ERROR", { data: "Vendor matching failed:", vendorsError });
    throw vendorsError;
  }

  await logStructuredEvent("VENDORS_MATCHED", {
    sessionId,
    category,
    vendorCount: vendors?.length ?? 0,
  });

  // Send quote requests to vendors
  if (vendors && vendors.length > 0) {
    // Update session status to negotiating
    await supabase
      .from("agent_sessions")
      .update({ status: "negotiating" })
      .eq("id", sessionId);

    // Log vendor contacts and create pending quotes
    for (const vendor of vendors) {
      logVendorContact(sessionId, vendor.id, vendorType, "whatsapp");
      
      // Create pending quotes
      await supabase.from("agent_quotes").insert({
        session_id: sessionId,
        vendor_id: vendor.id,
        vendor_type: vendorType,
        vendor_name: vendor.name,
        vendor_phone: vendor.owner_whatsapp,
        status: "pending",
        offer_data: {
          distance_km: vendor.distance_km,
          category: vendor.category,
          description: requestData.description || null,
        },
        sent_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min expiry
      });
    }
  } else {
    // No vendors found, move to timeout
    await supabase
      .from("agent_sessions")
      .update({ 
        status: "timeout",
        result_data: { reason: "no_vendors_found", category },
      })
      .eq("id", sessionId);
  }
}

/**
 * Add a quote from a vendor
 */
async function addQuote(req: Request): Promise<Response> {
  if (!isFeatureEnabled("agent.negotiation")) {
    return json({ error: "feature_disabled" }, 403);
  }

  let payload: AddQuoteRequest;
  try {
    payload = await req.json() as AddQuoteRequest;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (!payload.sessionId || !payload.vendorPhone) {
    return json({ error: "missing_required_fields" }, 400);
  }

  try {
    // Find or create the quote
    const { data: quote, error: quoteError } = await supabase
      .from("agent_quotes")
      .upsert({
        session_id: payload.sessionId,
        vendor_id: payload.vendorId,
        vendor_type: payload.vendorType,
        vendor_phone: payload.vendorPhone,
        status: "received",
        price_amount: payload.priceAmount,
        estimated_time_minutes: payload.estimatedTimeMinutes,
        notes: payload.notes,
        offer_data: payload.offerData ?? {},
        received_at: new Date().toISOString(),
      }, {
        onConflict: "session_id,vendor_phone",
      })
      .select()
      .single();

    if (quoteError) throw quoteError;

    await logStructuredEvent("AGENT_QUOTE_RECEIVED", {
      sessionId: payload.sessionId,
      vendorType: payload.vendorType,
      priceAmount: payload.priceAmount,
      estimatedTime: payload.estimatedTimeMinutes,
    });

    // Check if we have enough quotes to present
    const { count } = await supabase
      .from("agent_quotes")
      .select("*", { count: "exact", head: true })
      .eq("session_id", payload.sessionId)
      .eq("status", "received");

    // If we have 3+ quotes, move to presenting
    if (count && count >= 3) {
      await supabase
        .from("agent_sessions")
        .update({ status: "presenting" })
        .eq("id", payload.sessionId);
    }

    return json({ success: true, quoteId: quote.id, quotesReceived: count });
  } catch (error) {
    logAgentError("quote_add", error, {
      sessionId: payload.sessionId,
      vendorType: payload.vendorType,
    });
    return json({ error: "quote_add_failed", message: String(error) }, 500);
  }
}

/**
 * Get session status
 */
async function getStatus(sessionId: string): Promise<Response> {
  if (!isFeatureEnabled("agent.negotiation")) {
    return json({ error: "feature_disabled" }, 403);
  }

  try {
    const { data: session, error: sessionError } = await supabase
      .from("agent_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionError) throw sessionError;

    const { data: quotes, error: quotesError } = await supabase
      .from("agent_quotes")
      .select("*")
      .eq("session_id", sessionId)
      .order("price_amount", { ascending: true, nullsLast: true });

    if (quotesError) throw quotesError;

    const receivedQuotes = quotes.filter((q) => q.status === "received");
    const bestQuotes = receivedQuotes.slice(0, 3);

    return json({
      session: {
        id: session.id,
        status: session.status,
        flowType: session.flow_type,
        startedAt: session.started_at,
        deadlineAt: session.deadline_at,
      },
      quotes: {
        total: quotes.length,
        received: receivedQuotes.length,
        best: bestQuotes,
      },
    });
  } catch (error) {
    logAgentError("status_check", error, { sessionId });
    return json({ error: "status_check_failed", message: String(error) }, 500);
  }
}

/**
 * Complete negotiation with selected quote
 */
async function completeNegotiation(req: Request): Promise<Response> {
  if (!isFeatureEnabled("agent.negotiation")) {
    return json({ error: "feature_disabled" }, 403);
  }

  let payload: { sessionId: string; quoteId: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (!payload.sessionId || !payload.quoteId) {
    return json({ error: "missing_required_fields" }, 400);
  }

  try {
    // Accept the selected quote
    await supabase
      .from("agent_quotes")
      .update({ status: "accepted" })
      .eq("id", payload.quoteId);

    // Reject other quotes
    await supabase
      .from("agent_quotes")
      .update({ status: "rejected" })
      .eq("session_id", payload.sessionId)
      .neq("id", payload.quoteId)
      .eq("status", "received");

    // Complete the session
    await supabase
      .from("agent_sessions")
      .update({
        status: "completed",
        selected_quote_id: payload.quoteId,
        result_data: { completed_at: new Date().toISOString() },
      })
      .eq("id", payload.sessionId);

    await logStructuredEvent("AGENT_NEGOTIATION_COMPLETED", {
      sessionId: payload.sessionId,
      quoteId: payload.quoteId,
    });

    return json({ success: true });
  } catch (error) {
    logAgentError("negotiation_complete", error, {
      sessionId: payload.sessionId,
      quoteId: payload.quoteId,
    });
    return json({ error: "completion_failed", message: String(error) }, 500);
  }
}

/**
 * Main handler
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions();
  }

  const url = new URL(req.url);
  const path = url.pathname;

  // Route requests
  if (req.method === "POST" && path.endsWith("/start")) {
    return await startNegotiation(req);
  }

  if (req.method === "POST" && path.endsWith("/quote")) {
    return await addQuote(req);
  }

  if (req.method === "GET" && path.includes("/status/")) {
    const sessionId = path.split("/status/")[1];
    return await getStatus(sessionId);
  }

  if (req.method === "POST" && path.endsWith("/complete")) {
    return await completeNegotiation(req);
  }

  return json({ error: "not_found" }, 404);
});
