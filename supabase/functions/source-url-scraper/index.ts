// =====================================================
// SOURCE URL SCRAPER - Daily Listing Updates
// =====================================================
// Scrapes job and property source URLs to populate listings
// Runs daily via cron job
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface ScrapeRequest {
  type: "jobs" | "properties" | "both";
  country_code?: string;
  limit?: number;
  source_id?: string; // optional: process a single source for testing
  fast?: boolean;     // optional: fast mode (SerpAPI-only where supported)
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type = "both", country_code, limit = 5, source_id, fast = false }: ScrapeRequest = await req.json();

    const results = {
      jobs: { scraped: 0, new_listings: 0, errors: 0 },
      properties: { scraped: 0, new_listings: 0, errors: 0 },
    };

    // Scrape jobs
    if (type === "jobs" || type === "both") {
      const jobResult = await scrapeJobSources(country_code, limit, source_id);
      results.jobs = jobResult;
    }

    // Scrape properties
    if (type === "properties" || type === "both") {
      const propertyResult = await scrapePropertySources(country_code, limit, source_id);
      results.properties = propertyResult;
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Scraper error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

// =====================================================
// JOB SCRAPING
// =====================================================

async function scrapeJobSources(country_code?: string, limit = 5, source_id?: string) {
  const stats = { scraped: 0, new_listings: 0, errors: 0 };

  try {
    // Get sources to scrape
    let sources: any[] = [];
    if (source_id) {
      const { data, error } = await supabase
        .from("job_source_urls")
        .select("*")
        .eq("id", source_id)
        .limit(1);
      if (error) throw error;
      sources = data || [];
    } else {
      const { data, error } = await supabase.rpc(
        "get_job_sources_to_scrape",
        { hours_threshold: 24 }
      );
      if (error) throw error;
      sources = data || [];
    }

    if (!sources || sources.length === 0) {
      console.log("No job sources need scraping");
      return stats;
    }

    // Filter by country if specified
    const sourcesToScrape = country_code
      ? sources.filter((s: any) => s.country_code === country_code).slice(0, limit)
      : sources.slice(0, limit);

    console.log(`Scraping ${sourcesToScrape.length} job sources`);

    // Scrape each source
    for (const source of sourcesToScrape) {
      try {
        console.log(`Scraping job source: ${source.name} (${source.url})`);
        const listings = await invokeDeepResearch("jobs", source, fast);

        let newCount = 0;
        for (const listing of listings) {
          const payload = normalizeJobListing(listing, source);
          if (!payload) continue;
          try {
            const { error: insertError } = await supabase
              .from("job_listings")
              .insert(payload);

            if (!insertError) {
              newCount++;
            }
          } catch (_) {
            // Duplicate or constraint violation
          }
        }

        await supabase.rpc("update_job_source_scrape_stats", {
          p_source_id: source.id,
          p_jobs_found: newCount,
          p_error: null,
        });

        stats.scraped++;
        stats.new_listings += newCount;
      } catch (error) {
        console.error(`Error scraping ${source.name}:`, error);
        
        await supabase.rpc("update_job_source_scrape_stats", {
          p_source_id: source.id,
          p_jobs_found: 0,
          p_error: error.message,
        });
        
        stats.errors++;
      }
    }
  } catch (error) {
    console.error("Job scraping error:", error);
    stats.errors++;
  }

  return stats;
}

// =====================================================
// PROPERTY SCRAPING
// =====================================================

async function scrapePropertySources(country_code?: string, limit = 5, source_id?: string) {
  const stats = { scraped: 0, new_listings: 0, errors: 0 };

  try {
    // Get sources to scrape
    let sources: any[] = [];
    if (source_id) {
      const { data, error } = await supabase
        .from("property_source_urls")
        .select("*")
        .eq("id", source_id)
        .limit(1);
      if (error) throw error;
      sources = data || [];
    } else {
      const { data, error } = await supabase.rpc(
        "get_property_sources_to_scrape",
        { hours_threshold: 24 }
      );
      if (error) throw error;
      sources = data || [];
    }

    if (!sources || sources.length === 0) {
      console.log("No property sources need scraping");
      return stats;
    }

    // Filter by country if specified
    const sourcesToScrape = country_code
      ? sources.filter((s: any) => s.country_code === country_code).slice(0, limit)
      : sources.slice(0, limit);

    console.log(`Scraping ${sourcesToScrape.length} property sources`);

    // Scrape each source
    for (const source of sourcesToScrape) {
      try {
        console.log(`Scraping property source: ${source.name} (${source.url})`);
        const listings = await invokeDeepResearch("properties", source, fast);
        const ownerId = await getPropertyOwnerId();

        let newCount = 0;
        for (const listing of listings) {
          const payload = normalizePropertyListing(listing, source, ownerId);
          if (!payload) continue;

          try {
            const { error: insertError } = await supabase
              .from("property_listings")
              .insert(payload);

            if (!insertError) {
              newCount++;
            }
          } catch (_) {
            // Duplicate or constraint violation
          }
        }

        await supabase.rpc("update_property_source_scrape_stats", {
          p_source_id: source.id,
          p_properties_found: newCount,
          p_error: null,
        });

        stats.scraped++;
        stats.new_listings += newCount;
      } catch (error) {
        console.error(`Error scraping ${source.name}:`, error);
        
        await supabase.rpc("update_property_source_scrape_stats", {
          p_source_id: source.id,
          p_properties_found: 0,
          p_error: error.message,
        });
        
        stats.errors++;
      }
    }
  } catch (error) {
    console.error("Property scraping error:", error);
    stats.errors++;
  }

  return stats;
}

// =====================================================
// ACTUAL SCRAPING LOGIC
// =====================================================

async function scrapeJobListings(source: any): Promise<any[]> {
  const listings = await invokeDeepResearch("jobs", source);
  return listings;
}

async function scrapePropertyListings(source: any): Promise<any[]> {
  const listings = await invokeDeepResearch("properties", source);
  return listings;
}

async function invokeDeepResearch(type: "jobs" | "properties", source: any, fast = false) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/openai-deep-research`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      action: "source_scrape",
      type,
      country: source.country_code,
      source_url: source.url,
      source_name: source.name,
      fast,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Deep research failed: ${errorText}`);
  }

  const data = await response.json();
  return data.listings || [];
}

let cachedPropertyOwnerId: string | null = null;
async function getPropertyOwnerId(): Promise<string> {
  if (cachedPropertyOwnerId) return cachedPropertyOwnerId;
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "app.property_owner_id")
    .maybeSingle();
  cachedPropertyOwnerId = data?.value ??
    "c7a4b3da-a9b4-4dc8-92f3-6d457dd2f888";
  return cachedPropertyOwnerId!;
}

function normalizeJobListing(listing: any, source: any) {
  if (!listing?.title || !listing?.description || !listing?.location) {
    return null;
  }

  const jobType = normalizeJobType(listing.job_type);
  const payType = normalizePayType(listing.pay_type);
  const currency = listing.currency ||
    (source.country_code === "MT" ? "EUR" : "RWF");

  return {
    posted_by: listing.posted_by || source.url,
    poster_name: listing.company || listing.poster_name || source.name,
    title: listing.title,
    description: listing.description,
    job_type: jobType,
    category: listing.category || "other",
    location: listing.location,
    location_details: listing.location_details || null,
    pay_min: listing.pay_min || null,
    pay_max: listing.pay_max || null,
    pay_type: payType,
    currency,
    contact_method: listing.contact_method || (listing.contact_phone ? "phone" : null),
    contact_phone: listing.contact_phone || listing.contact || null,
    contact_email: listing.contact_email || null,
    status: "open",
    metadata: {
      source_url: listing.source_url || source.url,
      apply_url: listing.apply_url || null,
    },
  };
}

function normalizePropertyListing(listing: any, source: any, ownerId: string) {
  if (!listing?.title || !listing?.price) return null;

  const location = {
    address: listing.location?.address || listing.title,
    city: listing.location?.city || "",
    country: listing.location?.country || source.country_code,
    latitude: listing.location?.latitude || null,
    longitude: listing.location?.longitude || null,
  };

  return {
    owner_id: ownerId,
    rental_type: listing.rentalType || "long_term",
    bedrooms: listing.bedrooms || 1,
    bathrooms: listing.bathrooms || 1,
    price: listing.price,
    location,
    address: location.address,
    amenities: listing.amenities || [],
    images: listing.images || [],
    status: "available",
    available_from: listing.availableFrom || new Date().toISOString().slice(0, 10),
  };
}

function normalizeJobType(jobType?: string) {
  const normalized = (jobType || "").toLowerCase();
  if (["gig", "part_time", "full_time", "contract", "temporary"].includes(normalized)) {
    return normalized;
  }
  return "gig";
}

function normalizePayType(payType?: string) {
  const normalized = (payType || "").toLowerCase();
  if (["hourly", "daily", "weekly", "monthly", "fixed", "commission", "negotiable"].includes(normalized)) {
    return normalized;
  }
  return "negotiable";
}
