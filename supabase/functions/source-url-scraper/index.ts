// =====================================================
// SOURCE URL SCRAPER - Daily Listing Updates
// =====================================================
// Scrapes job and property source URLs to populate listings
// Runs daily via cron job
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface ScrapeRequest {
  type: "jobs" | "properties" | "both";
  country_code?: string;
  limit?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type = "both", country_code, limit = 5 }: ScrapeRequest = await req.json();

    const results = {
      jobs: { scraped: 0, new_listings: 0, errors: 0 },
      properties: { scraped: 0, new_listings: 0, errors: 0 },
    };

    // Scrape jobs
    if (type === "jobs" || type === "both") {
      const jobResult = await scrapeJobSources(country_code, limit);
      results.jobs = jobResult;
    }

    // Scrape properties
    if (type === "properties" || type === "both") {
      const propertyResult = await scrapePropertySources(country_code, limit);
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

async function scrapeJobSources(country_code?: string, limit = 5) {
  const stats = { scraped: 0, new_listings: 0, errors: 0 };

  try {
    // Get sources to scrape
    const { data: sources, error } = await supabase.rpc(
      "get_job_sources_to_scrape",
      { hours_threshold: 24 }
    );

    if (error) throw error;
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
        
        const listings = await scrapeJobListings(source);
        
        // Insert new listings (avoiding duplicates)
        let newCount = 0;
        for (const listing of listings) {
          try {
            const { error: insertError } = await supabase
              .from("job_listings")
              .insert({
                ...listing,
                source_url: source.url,
                source_name: source.name,
              });

            if (!insertError) {
              newCount++;
            }
          } catch (e) {
            // Likely duplicate, skip
          }
        }

        // Update stats
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

async function scrapePropertySources(country_code?: string, limit = 5) {
  const stats = { scraped: 0, new_listings: 0, errors: 0 };

  try {
    // Get sources to scrape
    const { data: sources, error } = await supabase.rpc(
      "get_property_sources_to_scrape",
      { hours_threshold: 24 }
    );

    if (error) throw error;
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
        
        const listings = await scrapePropertyListings(source);
        
        // Insert new listings (avoiding duplicates)
        let newCount = 0;
        for (const listing of listings) {
          try {
            const { error: insertError } = await supabase
              .from("property_listings")
              .insert({
                ...listing,
                source_url: source.url,
                source_name: source.name,
              });

            if (!insertError) {
              newCount++;
            }
          } catch (e) {
            // Likely duplicate, skip
          }
        }

        // Update stats
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
  // This will be enhanced with actual scraping logic
  // For now, trigger OpenAI deep research
  
  const response = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/openai-deep-research`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        country: source.country_code,
        type: "jobs",
        source_url: source.url,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Deep research failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.listings || [];
}

async function scrapePropertyListings(source: any): Promise<any[]> {
  // This will be enhanced with actual scraping logic
  // For now, trigger OpenAI deep research
  
  const response = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/openai-deep-research`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        country: source.country_code,
        type: "properties",
        source_url: source.url,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Deep research failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.listings || [];
}
