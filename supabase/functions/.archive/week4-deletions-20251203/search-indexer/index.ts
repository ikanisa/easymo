/**
 * Search Indexer Edge Function
 * Automatically indexes content from various domains for semantic search
 * 
 * Triggered by:
 * - Database triggers on insert/update
 * - Manual indexing requests
 * - Scheduled batch jobs
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { indexForSearch, type SearchIndexEntry } from "../_shared/embedding-service.ts";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { action, domain, entityId } = await req.json();

    switch (action) {
      case "index_single":
        await indexSingleEntity(supabase, domain, entityId);
        return new Response(
          JSON.stringify({ success: true, message: "Entity indexed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      case "index_batch":
        const count = await indexDomainBatch(supabase, domain);
        return new Response(
          JSON.stringify({ success: true, indexed: count }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      case "reindex_all":
        const totals = await reindexAllDomains(supabase);
        return new Response(
          JSON.stringify({ success: true, totals }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Indexing error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function indexSingleEntity(supabase: any, domain: string, entityId: string): Promise<void> {
  let entry: SearchIndexEntry | null = null;
  switch (domain) {
    case "marketplace": entry = await indexMarketplaceListing(supabase, entityId); break;
    case "jobs": entry = await indexJobPosting(supabase, entityId); break;
    case "properties": entry = await indexPropertyListing(supabase, entityId); break;
    case "produce": entry = await indexProduceListing(supabase, entityId); break;
    case "businesses": entry = await indexBusiness(supabase, entityId); break;
    default: throw new Error(`Unknown domain: ${domain}`);
  }
  if (entry) await indexForSearch(entry, supabaseUrl, supabaseKey);
}

async function indexMarketplaceListing(supabase: any, id: string): Promise<SearchIndexEntry | null> {
  const { data } = await supabase.from("marketplace_listings").select("*").eq("id", id).single();
  if (!data) return null;
  return {
    domain: "marketplace", entityId: data.id, entityType: "listing", title: data.title,
    description: data.description, fullText: `${data.title} ${data.description || ""}`,
    metadata: { price: data.price, category: data.category }, relevanceScore: 1.0,
  };
}

async function indexJobPosting(supabase: any, id: string): Promise<SearchIndexEntry | null> {
  const { data } = await supabase.from("job_posts").select("*").eq("id", id).single();
  if (!data) return null;
  return {
    domain: "jobs", entityId: data.id, entityType: "job", title: data.title,
    description: data.description, fullText: `${data.title} ${data.description || ""}`,
    metadata: { company: data.company, salary: data.salary_range }, relevanceScore: 1.0,
  };
}

async function indexPropertyListing(supabase: any, id: string): Promise<SearchIndexEntry | null> {
  const { data } = await supabase.from("property_listings").select("*").eq("id", id).single();
  if (!data) return null;
  return {
    domain: "properties", entityId: data.id, entityType: "property", title: data.title,
    description: data.description, fullText: `${data.title} ${data.description || ""}`,
    metadata: { price: data.price, bedrooms: data.bedrooms }, relevanceScore: 1.0,
  };
}

async function indexProduceListing(supabase: any, id: string): Promise<SearchIndexEntry | null> {
  const { data } = await supabase.from("produce_listings").select("*").eq("id", id).single();
  if (!data) return null;
  return {
    domain: "produce", entityId: data.id, entityType: "produce", title: data.produce_name,
    description: data.description, fullText: `${data.produce_name} ${data.description || ""}`,
    metadata: { quantity: data.quantity, price: data.price }, relevanceScore: 1.0,
  };
}

async function indexBusiness(supabase: any, id: string): Promise<SearchIndexEntry | null> {
  const { data } = await supabase.from("businesses").select("*").eq("id", id).single();
  if (!data) return null;
  return {
    domain: "businesses", entityId: data.id, entityType: "business", title: data.name,
    description: data.description, fullText: `${data.name} ${data.description || ""}`,
    metadata: { category: data.category, verified: data.is_verified }, relevanceScore: 1.5,
  };
}

async function indexDomainBatch(supabase: any, domain: string): Promise<number> {
  let count = 0;
  const tables: Record<string, string> = {
    marketplace: "marketplace_listings", jobs: "job_posts",
    properties: "property_listings", produce: "produce_listings",
    businesses: "businesses",
  };
  const { data } = await supabase.from(tables[domain]).select("id").limit(1000);
  if (data) {
    for (const item of data) {
      try { await indexSingleEntity(supabase, domain, item.id); count++; }
      catch (e) { console.error(e); }
    }
  }
  return count;
}

async function reindexAllDomains(supabase: any): Promise<Record<string, number>> {
  const domains = ["marketplace", "jobs", "properties", "produce", "businesses"];
  const totals: Record<string, number> = {};
  for (const domain of domains) {
    totals[domain] = await indexDomainBatch(supabase, domain);
  }
  return totals;
}
