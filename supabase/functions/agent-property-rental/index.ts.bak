import { detectLanguage, translateText } from "../_shared/multilingual-utils.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";
import { transcribeAudio, textToSpeech } from "../_shared/voice-handler.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";
// Property Rental Agent
// Handles short-term and long-term rental matching, property listing, and price negotiation

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";
import { createClient } from "@supabase/supabase-js@2";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const healthMetrics = {
  success: 0,
  failure: 0,
  latencyMsTotal: 0,
};

const renderHealthMetrics = (service: string): string => [
  `agent_health_checks_total{service="${service}",status="success"} ${healthMetrics.success}`,
  `agent_health_checks_total{service="${service}",status="failure"} ${healthMetrics.failure}`,
  `agent_health_latency_ms_sum{service="${service}"} ${healthMetrics.latencyMsTotal}`,
].join("\n");

interface PropertySearchRequest {
  userId: string;
  action: "find" | "add";
  rentalType: "short_term" | "long_term";
  bedrooms?: number;
  minBudget?: number;
  maxBudget?: number;
  location: { latitude: number; longitude: number };
  address?: string;
  amenities?: string[];
  // For adding property
  propertyData?: {
    price: number;
    bathrooms?: number;
    description?: string;
    images?: string[];
    availableFrom?: string;
  };
}

interface PropertyMatch {
  id: string;
  ownerId: string;
  type: string;
  bedrooms: number;
  bathrooms: number;
  price: number;
  location: any;
  address: string;
  amenities: string[];
  images: string[];
  distance: number;
  matchScore: number;
  negotiatedPrice?: number;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  const url = new URL(req.url);
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startTime = Date.now();

  if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/ping")) {
    try {
      const { error } = await supabase.from("agent_sessions").select("id").limit(1);
      const healthy = !error;
      const durationMs = Date.now() - startTime;
      healthMetrics.latencyMsTotal += durationMs;
      healthy ? healthMetrics.success++ : healthMetrics.failure++;

      logStructuredEvent("PROPERTY_AGENT_HEALTH", {
        requestId,
        healthy,
        durationMs,
        error: error?.message,
      });

      return new Response(JSON.stringify({
        status: healthy ? "ok" : "degraded",
        service: "agent-property-rental",
        requestId,
        latency_ms: durationMs,
        timestamp: new Date().toISOString(),
        checks: { database: healthy ? "connected" : "error" },
      }), {
        status: healthy ? 200 : 503,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-ID": requestId },
      });
    } catch (error) {
      const durationMs = Date.now() - startTime;
      healthMetrics.failure++;
      healthMetrics.latencyMsTotal += durationMs;
      logStructuredEvent("PROPERTY_AGENT_HEALTH_ERROR", {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        durationMs,
      }, "error");

      return new Response(JSON.stringify({
        status: "unhealthy",
        service: "agent-property-rental",
        requestId,
        latency_ms: durationMs,
      }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-ID": requestId },
      });
    }
  }

  if (req.method === "GET" && url.pathname === "/metrics") {
    return new Response(renderHealthMetrics("agent-property-rental"), {
      status: 200,
      headers: { "Content-Type": "text/plain; version=0.0.4", "X-Request-ID": requestId },
    });
  }

  try {
    const request: PropertySearchRequest = await req.json();
    
    console.log(JSON.stringify({
      event: "PROPERTY_AGENT_REQUEST",
      timestamp: new Date().toISOString(),
      userId: request.userId,
      action: request.action,
      rentalType: request.rentalType,
    }));

    // Create agent session
    const { data: session, error: sessionError } = await supabase
      .from("agent_sessions")
      .insert({
        user_id: request.userId,
        agent_type: "property_rental",
        flow_type: request.action === "add" ? "property_listing" : "property_search",
        status: "searching",
        request_data: request,
        deadline_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    if (request.action === "add") {
      return await handleAddProperty(supabase, request, session.id);
    } else {
      return await handleFindProperty(supabase, request, session.id);
    }
  } catch (error) {
    console.error(JSON.stringify({
      event: "PROPERTY_AGENT_ERROR",
      error: error.message,
      duration: Date.now() - startTime,
    }));

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleAddProperty(supabase: any, request: PropertySearchRequest, sessionId: string) {
  try {
    // Create property listing
    const { data: property, error } = await supabase
      .from("properties")
      .insert({
        owner_id: request.userId,
        rental_type: request.rentalType,
        bedrooms: request.propertyData?.bedrooms || request.bedrooms,
        bathrooms: request.propertyData?.bathrooms || 1,
        price: request.propertyData?.price || request.maxBudget,
        location: `POINT(${request.location.longitude} ${request.location.latitude})`,
        address: request.address,
        amenities: request.amenities || [],
        images: request.propertyData?.images || [],
        description: request.propertyData?.description,
        status: "available",
        available_from: request.propertyData?.availableFrom || new Date().toISOString(),
        minimum_stay: request.rentalType === "short_term" ? 1 : 30,
      })
      .select()
      .single();

    if (error) throw error;

    // Update session
    await supabase
      .from("agent_sessions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        metadata: { propertyId: property.id },
      })
      .eq("id", sessionId);

    const message = `✅ *Property Listed Successfully!*\n\n` +
      `Your property has been added to our listings.\n` +
      `Property ID: ${property.id}\n` +
      `Type: ${request.rentalType === "short_term" ? "Short-term" : "Long-term"} rental\n` +
      `Bedrooms: ${property.bedrooms}\n` +
      `Price: ${property.price} RWF/month\n\n` +
      `We'll notify you when potential tenants show interest!`;

    return new Response(
      JSON.stringify({
        success: true,
        propertyId: property.id,
        message,
        sessionId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    throw new Error(`Failed to add property: ${error.message}`);
  }
}

async function handleFindProperty(supabase: any, request: PropertySearchRequest, sessionId: string) {
  try {
    // Personalization: fetch user memories for real_estate domain
    const { data: mems } = await supabase
      .from('user_memories')
      .select('mem_key, mem_value')
      .eq('user_id', request.userId)
      .eq('domain', 'real_estate')
      .order('last_seen', { ascending: false })
      .limit(20);

    // Apply defaults from memory if request fields are missing
    const memMap = new Map<string, any>((mems || []).map((m: any) => [m.mem_key, m.mem_value]));
    if (!request.bedrooms && memMap.get('bedrooms')) request.bedrooms = Number(memMap.get('bedrooms') || 0) || undefined;
    if (!request.minBudget && memMap.get('budget_min')) request.minBudget = Number(memMap.get('budget_min') || 0) || undefined;
    if (!request.maxBudget && memMap.get('budget_max')) request.maxBudget = Number(memMap.get('budget_max') || 0) || undefined;
    if (!request.amenities && memMap.get('amenities')) request.amenities = memMap.get('amenities');
    if (request.propertyData?.bathrooms === undefined && memMap.get('bathrooms')) {
      request.propertyData = { ...(request.propertyData || {}), bathrooms: Number(memMap.get('bathrooms') || 0) || undefined };
    }

    // Search for matching properties
    const radiusKm = 10;
    const { data: properties, error } = await supabase.rpc("search_nearby_properties", {
      p_latitude: request.location.latitude,
      p_longitude: request.location.longitude,
      p_radius_km: radiusKm,
      p_rental_type: request.rentalType,
      p_bedrooms: request.bedrooms,
      p_min_budget: request.minBudget || 0,
      p_max_budget: request.maxBudget || 999999999,
    });

    if (error) throw error;

    if (!properties || properties.length === 0) {
      await supabase
        .from("agent_sessions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", sessionId);

      return new Response(
        JSON.stringify({
          success: false,
          message: "No properties found matching your criteria. Would you like to adjust your search?",
          sessionId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Score and rank properties
    const scoredProperties = properties.map((prop: any) => ({
      ...prop,
      matchScore: calculatePropertyScore(prop, request),
    })).sort((a: any, b: any) => b.matchScore - a.matchScore);

    // Get top 3 properties and create quotes
    const topProperties = scoredProperties.slice(0, 3);
    const quotes = [];

    for (const property of topProperties) {
      // Simulate price negotiation (in production, would contact owners)
      const negotiatedPrice = await simulateNegotiation(property.price, request.maxBudget);

      const { data: quote } = await supabase
        .from("agent_quotes")
        .insert({
          session_id: sessionId,
          vendor_id: property.owner_id,
          vendor_type: "property_owner",
          vendor_name: property.owner_name || "Property Owner",
          offer_data: {
            original_price: property.price,
            negotiated_price: negotiatedPrice,
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
            location: property.address,
            amenities: property.amenities,
            images: property.images,
            distance: property.distance,
          },
          status: "pending",
          ranking_score: property.matchScore,
        })
        .select()
        .single();

      quotes.push(quote);
    }

    // Update session
    await supabase
      .from("agent_sessions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    // Format message (include memory context if any)
    const message = formatPropertyOptions(topProperties, quotes, mems || []);

    // Store memory summary of this search
    await supabase.from('user_memories').upsert({
      user_id: request.userId,
      domain: 'real_estate',
      memory_type: 'preference',
      mem_key: 'search_prefs',
      mem_value: {
        rentalType: request.rentalType,
        bedrooms: request.bedrooms,
        minBudget: request.minBudget,
        maxBudget: request.maxBudget,
        amenities: request.amenities || [],
      },
      last_seen: new Date().toISOString(),
    }, { onConflict: 'user_id,domain,mem_key' });

    return new Response(
      JSON.stringify({
        success: true,
        searchId: sessionId,
        options: quotes,
        message,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    throw new Error(`Failed to search properties: ${error.message}`);
  }
}

function calculatePropertyScore(property: any, request: PropertySearchRequest): number {
  let score = 0;

  // Location score (30%)
  if (property.distance < 2) score += 30;
  else if (property.distance < 5) score += 25;
  else if (property.distance < 10) score += 15;
  else score += 5;

  // Price score (30%)
  const priceRatio = property.price / (request.maxBudget || property.price);
  score += (1 - priceRatio) * 30;

  // Amenities score (20%)
  if (request.amenities && request.amenities.length > 0) {
    const matchingAmenities = request.amenities.filter((a: string) =>
      property.amenities.includes(a)
    ).length;
    score += (matchingAmenities / request.amenities.length) * 20;
  } else {
    score += 10;
  }

  // Size score (10%)
  if (property.bedrooms === request.bedrooms) score += 10;
  else if (property.bedrooms > request.bedrooms) score += 7;

  // Availability score (10%)
  score += 10;

  return Math.round(score);
}

async function simulateNegotiation(originalPrice: number, maxBudget?: number): Promise<number> {
  // Simple negotiation logic
  if (!maxBudget || originalPrice <= maxBudget) {
    return originalPrice;
  }

  // Negotiate 5-10% discount
  const discountPercent = 0.05 + Math.random() * 0.05;
  const negotiatedPrice = Math.round(originalPrice * (1 - discountPercent));

  return Math.max(negotiatedPrice, maxBudget);
}

function formatPropertyOptions(properties: any[], quotes: any[], mems: any[]): string {
  let message = "🏠 *Available Properties:*\n\n";

  // Include memory context if available
  if (Array.isArray(mems) && mems.length) {
    const prefs = mems.filter((m: any) => ['search_prefs','bedrooms','budget_min','budget_max','amenities'].includes(m.mem_key));
    if (prefs.length) {
      message += "📌 Based on your preferences: ";
      message += prefs.map((m: any) => `${m.mem_key}=${JSON.stringify(m.mem_value)}`).join('; ');
      message += "\n\n";
    }
  }

  quotes.forEach((quote: any, index: number) => {
    const offer = quote.offer_data;
    message += `*Option ${index + 1}*\n`;
    message += `📍 ${offer.location}\n`;
    message += `📏 Distance: ${offer.distance?.toFixed(1)}km\n`;
    message += `🛏️ Bedrooms: ${offer.bedrooms}\n`;
    message += `🚿 Bathrooms: ${offer.bathrooms}\n`;
    message += `\n💰 *Pricing:*\n`;
    message += `  Monthly Rent: ${offer.negotiated_price} RWF`;

    if (offer.negotiated_price < offer.original_price) {
      const discount = ((offer.original_price - offer.negotiated_price) / offer.original_price * 100).toFixed(1);
      message += ` (${discount}% negotiated discount!)`;
    }
    message += `\n  Deposit: ${offer.negotiated_price * 2} RWF\n`;

    if (offer.amenities && offer.amenities.length > 0) {
      message += `\n✨ *Amenities:*\n`;
      offer.amenities.slice(0, 5).forEach((amenity: string) => {
        message += `  • ${amenity}\n`;
      });
    }

    message += `─────────────\n\n`;
  });

  message += "_Reply with the option number to get owner's contact details (1, 2, or 3)_";

  return message;
}
