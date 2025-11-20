import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { normalizeVendorPayload, findVendorsNearby as geminiVendorSearch } from "../_shared/gemini-tools.ts";
import { logStructuredEvent, logError } from "../_shared/observability.ts";

/**
 * General Broker Agent Tools
 * 
 * Provides all tools needed by the General Broker Agent:
 * - User location management
 * - User facts (persistent memory)
 * - Service request tracking
 * - Vendor search (Gemini-enhanced)
 * - FAQ & catalog search
 * - Vendor payload normalization (Gemini-powered)
 */

interface ToolRequest {
  action: string;
  userId: string;
  [key: string]: any;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const correlationId = req.headers.get("X-Correlation-ID") || crypto.randomUUID();

  try {
    const { action, userId, ...params }: ToolRequest = await req.json();

    if (!action || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing action or userId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStructuredEvent("BROKER_TOOL_CALL", {
      action,
      userId,
      correlationId,
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let result;

    switch (action) {
      // User Locations
      case "get_user_locations":
        result = await getUserLocations(supabase, userId);
        break;
      case "upsert_user_location":
        result = await upsertUserLocation(supabase, userId, params);
        break;

      // User Facts
      case "get_user_facts":
        result = await getUserFacts(supabase, userId, params.keys);
        break;
      case "upsert_user_fact":
        result = await upsertUserFact(supabase, userId, params.key, params.value);
        break;

      // Service Requests
      case "classify_request":
        result = await classifyRequest(params.query);
        break;
      case "record_service_request":
        result = await recordServiceRequest(supabase, userId, params);
        break;
      case "update_service_request":
        result = await updateServiceRequest(supabase, params.id, params.patch);
        break;

      // Vendors (Gemini-enhanced)
      case "find_vendors_nearby":
        result = await findVendorsNearbyEnhanced(supabase, params, correlationId);
        break;

      // Vendor normalization (Gemini-powered)
      case "normalize_vendor_payload":
        result = await normalizeVendorPayloadTool(params, correlationId);
        break;

      // Catalog & FAQ
      case "search_service_catalog":
        result = await searchServiceCatalog(supabase, params.query);
        break;
      case "search_easymo_faq":
        result = await searchFAQ(supabase, params.query, params.locale || "en");
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Correlation-ID": correlationId },
    });
  } catch (error) {
    logError("agent_tools_error", error, {
      action: (await req.clone().json()).action,
      correlationId,
    });
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json", "X-Correlation-ID": correlationId } }
    );
  }
});

// ============================================================================
// USER LOCATIONS
// ============================================================================

async function getUserLocations(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_locations")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false });

  if (error) throw error;
  return { locations: data || [] };
}

async function upsertUserLocation(supabase: any, userId: string, params: any) {
  const { label, latitude, longitude, address, isDefault } = params;

  // If setting as default, unset others first
  if (isDefault) {
    await supabase
      .from("user_locations")
      .update({ is_default: false })
      .eq("user_id", userId);
  }

  const { data, error } = await supabase
    .from("user_locations")
    .upsert({
      user_id: userId,
      label: label || "other",
      latitude,
      longitude,
      address,
      is_default: isDefault || false,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return { location: data };
}

// ============================================================================
// USER FACTS
// ============================================================================

async function getUserFacts(supabase: any, userId: string, keys?: string[]) {
  let query = supabase
    .from("user_facts")
    .select("*")
    .eq("user_id", userId);

  if (keys && keys.length > 0) {
    query = query.in("key", keys);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Convert to key-value map
  const facts: Record<string, any> = {};
  (data || []).forEach((row: any) => {
    facts[row.key] = row.value;
  });

  return { facts };
}

async function upsertUserFact(supabase: any, userId: string, key: string, value: any) {
  const { data, error } = await supabase
    .from("user_facts")
    .upsert({
      user_id: userId,
      key,
      value,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return { fact: data };
}

// ============================================================================
// SERVICE REQUESTS
// ============================================================================

async function classifyRequest(query: string) {
  const vertical = detectVertical(query);
  const requestType = detectRequestType(query);
  const category = detectCategory(query, vertical);

  return {
    classification: {
      vertical,
      requestType,
      category,
    },
  };
}

async function recordServiceRequest(supabase: any, userId: string, params: any) {
  const {
    orgId,
    vertical,
    requestType,
    category,
    subcategory,
    title,
    description,
    locationId,
    latitude,
    longitude,
    address,
    payload,
  } = params;

  const { data, error } = await supabase
    .from("service_requests")
    .insert({
      org_id: orgId,
      user_id: userId,
      vertical,
      request_type: requestType,
      category,
      subcategory,
      title,
      description,
      location_id: locationId,
      latitude,
      longitude,
      address,
      payload: payload || {},
      status: "open",
    })
    .select()
    .single();

  if (error) throw error;
  return { serviceRequest: data };
}

async function updateServiceRequest(supabase: any, id: string, patch: any) {
  const { data, error } = await supabase
    .from("service_requests")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return { serviceRequest: data };
}

// ============================================================================
// VENDORS (Enhanced with Gemini)
// ============================================================================

async function findVendorsNearbyEnhanced(supabase: any, params: any, correlationId?: string) {
  const {
    vertical,
    category,
    latitude,
    longitude,
    radiusKm = 10,
    limit = 10,
  } = params;

  // Use database RPC for EasyMO-registered vendors
  const { data, error } = await supabase.rpc("vendors_nearby", {
    p_vertical: vertical,
    p_category: category || null,
    p_latitude: latitude || null,
    p_longitude: longitude || null,
    p_radius_km: radiusKm,
    p_limit: limit,
  });

  if (error) throw error;

  // Future enhancement: If no results and location provided, could use Gemini
  // to suggest nearby vendors from Google Maps, then filter to EasyMO-registered
  const vendors = data || [];

  logStructuredEvent("BROKER_VENDORS_FOUND", {
    count: vendors.length,
    vertical,
    category,
    correlationId,
  });

  return { vendors };
}

async function normalizeVendorPayloadTool(params: any, correlationId?: string) {
  const { rawText, imageUrl, categories } = params;

  const normalized = await normalizeVendorPayload(
    { rawText, imageUrl, categories },
    correlationId
  );

  return { normalized };
}

// ============================================================================
// CATALOG & FAQ
// ============================================================================

async function searchServiceCatalog(supabase: any, query: string) {
  const { data, error } = await supabase
    .from("service_catalog")
    .select("*")
    .eq("enabled", true);

  if (error) throw error;

  // Simple keyword matching (enhance with vector search if needed)
  const lowerQuery = query.toLowerCase();
  const filtered = (data || []).filter((service: any) => {
    const keywords = service.keywords || [];
    return (
      service.name.toLowerCase().includes(lowerQuery) ||
      service.description?.toLowerCase().includes(lowerQuery) ||
      keywords.some((kw: string) => lowerQuery.includes(kw.toLowerCase()))
    );
  });

  return { services: filtered };
}

async function searchFAQ(supabase: any, query: string, locale: string) {
  const { data, error } = await supabase
    .from("faq_articles")
    .select("*")
    .eq("is_active", true)
    .eq("locale", locale);

  if (error) throw error;

  // Simple keyword matching
  const lowerQuery = query.toLowerCase();
  const filtered = (data || []).filter((faq: any) => {
    return (
      faq.question.toLowerCase().includes(lowerQuery) ||
      faq.answer.toLowerCase().includes(lowerQuery) ||
      (faq.tags || []).some((tag: string) => lowerQuery.includes(tag.toLowerCase()))
    );
  });

  // Increment view count for matched FAQs
  if (filtered.length > 0) {
    const ids = filtered.map((f: any) => f.id);
    await supabase.rpc("increment_faq_views", { faq_ids: ids }).catch(() => {});
  }

  return { faqs: filtered };
}

// ============================================================================
// CLASSIFICATION HELPERS
// ============================================================================

function detectVertical(query: string): string | null {
  const lowerQuery = query.toLowerCase();

  // Commerce keywords
  if (/\b(buy|shop|purchase|store|laptop|cement|pharmacy|medicine|hardware)\b/.test(lowerQuery)) {
    return "commerce";
  }

  // Property keywords
  if (/\b(rent|house|apartment|property|room|land|landlord|tenant)\b/.test(lowerQuery)) {
    return "property";
  }

  // Insurance keywords
  if (/\b(insurance|policy|cover|premium|claim|motor|health|life)\b/.test(lowerQuery)) {
    return "insurance";
  }

  // Hospitality keywords
  if (/\b(restaurant|menu|table|book|food|drink|bar|dine)\b/.test(lowerQuery)) {
    return "hospitality";
  }

  // Jobs keywords
  if (/\b(job|work|career|vacancy|hire|employment|apply|cv|resume)\b/.test(lowerQuery)) {
    return "jobs";
  }

  // Farming keywords
  if (/\b(farm|crop|seed|fertilizer|harvest|maize|cow|agriculture)\b/.test(lowerQuery)) {
    return "farming";
  }

  // Legal keywords
  if (/\b(legal|lawyer|attorney|court|contract|law|notary)\b/.test(lowerQuery)) {
    return "legal";
  }

  // Marketing keywords
  if (/\b(marketing|campaign|ad|promotion|crm|sales|lead)\b/.test(lowerQuery)) {
    return "marketing";
  }

  // Sora video keywords
  if (/\b(sora|video ad|ai video|generate video)\b/.test(lowerQuery)) {
    return "sora_video";
  }

  // Mobility keywords
  if (/\b(ride|driver|trip|taxi|moto|transport|travel|bus)\b/.test(lowerQuery)) {
    return "mobility";
  }

  // Support keywords
  if (/\b(help|support|problem|issue|complaint|error)\b/.test(lowerQuery)) {
    return "support";
  }

  return null;
}

function detectRequestType(query: string): string {
  const lowerQuery = query.toLowerCase();

  if (/\b(buy|purchase|order)\b/.test(lowerQuery)) return "buy";
  if (/\b(book|reserve)\b/.test(lowerQuery)) return "book";
  if (/\b(quote|price|cost|how much)\b/.test(lowerQuery)) return "quote";
  if (/\b(register|onboard|list|add my)\b/.test(lowerQuery)) return "onboard_vendor";
  if (/\b(consult|consultation|advice)\b/.test(lowerQuery)) return "consult";
  if (/\b(post job|hire|recruit)\b/.test(lowerQuery)) return "post_job";
  if (/\b(find|search|looking for)\b/.test(lowerQuery)) return "search";

  return "general";
}

function detectCategory(query: string, vertical: string | null): string | null {
  if (!vertical) return null;

  const lowerQuery = query.toLowerCase();

  // Commerce categories
  if (vertical === "commerce") {
    if (/\b(laptop|computer|electronics)\b/.test(lowerQuery)) return "electronics";
    if (/\b(medicine|pharmacy|drug)\b/.test(lowerQuery)) return "pharmacy";
    if (/\b(cement|hardware|construction|quincaillerie)\b/.test(lowerQuery)) return "hardware";
    return "general";
  }

  // Insurance categories
  if (vertical === "insurance") {
    if (/\b(motor|car|vehicle)\b/.test(lowerQuery)) return "motor";
    if (/\b(health|medical)\b/.test(lowerQuery)) return "health";
    if (/\b(life)\b/.test(lowerQuery)) return "life";
    return "general";
  }

  // Property categories
  if (vertical === "property") {
    if (/\b(short.?term|daily|weekly)\b/.test(lowerQuery)) return "short_term";
    if (/\b(long.?term|monthly)\b/.test(lowerQuery)) return "long_term";
    return "rental";
  }

  return null;
}
