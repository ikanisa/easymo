import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/http.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import { requireEmbedding } from "../_shared/openaiGuard.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface BusinessLookupRequest {
  query?: string;
  lat?: number;
  lng?: number;
  category_id?: number;
  limit?: number;
}

interface BusinessResult {
  id: string;
  name: string;
  description: string | null;
  location_text: string | null;
  category_id: number | null;
  distance_km?: number;
  similarity?: number;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const body: BusinessLookupRequest = await req.json();
    const { query, lat, lng, category_id, limit = 8 } = body;

    await logStructuredEvent("BUSINESS_LOOKUP_START", {
      has_query: !!query,
      has_location: !!(lat && lng),
      category_id,
      limit,
    });

    let results: BusinessResult[] = [];

    // Semantic search by name
    if (query && OPENAI_API_KEY) {
      results = await searchByName(supabase, query, limit);
    } 
    // Location-based search
    else if (lat !== undefined && lng !== undefined) {
      results = await searchByLocation(supabase, lat, lng, category_id, limit);
    } 
    else {
      return new Response(
        JSON.stringify({ error: "Must provide either 'query' or both 'lat' and 'lng'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await logStructuredEvent("BUSINESS_LOOKUP_COMPLETE", {
      results_count: results.length,
      search_type: query ? "semantic" : "location",
    });

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Business lookup error:", error);
    
    await logStructuredEvent("BUSINESS_LOOKUP_ERROR", {
      error: error.message,
    });

    return new Response(
      JSON.stringify({ error: "Internal server error", message: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function searchByName(
  supabase: any,
  query: string,
  limit: number
): Promise<BusinessResult[]> {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  // Generate embedding for the query
  const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-large",
      input: query,
    }),
  });

  if (!embeddingResponse.ok) {
    throw new Error(`OpenAI API error: ${embeddingResponse.statusText}`);
  }

  const embeddingData = await embeddingResponse.json();
  const embedding = requireEmbedding(
    embeddingData,
    "Business lookup embedding",
  );

  // Search using pgvector
  const { data, error } = await supabase.rpc("search_businesses_by_name_similarity", {
    query_embedding: embedding,
    match_count: limit,
    min_similarity: 0.5,
  });

  if (error) {
    console.error("Supabase RPC error:", error);
    throw error;
  }

  return data || [];
}

async function searchByLocation(
  supabase: any,
  lat: number,
  lng: number,
  category_id: number | undefined,
  limit: number
): Promise<BusinessResult[]> {
  const { data, error } = await supabase.rpc("search_businesses_by_location", {
    p_lat: lat,
    p_lng: lng,
    p_category_id: category_id || null,
    p_max_distance_km: 10, // 10km radius as per requirements
    p_limit: limit,
  });

  if (error) {
    console.error("Supabase RPC error:", error);
    throw error;
  }

  // Convert distance from meters to km
  return (data || []).map((item: any) => ({
    ...item,
    distance_km: item.distance_meters ? item.distance_meters / 1000 : null,
  }));
}
