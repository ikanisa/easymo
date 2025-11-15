// =====================================================
// JOB SOURCES SYNC - External Job Ingestion
// =====================================================
// Daily scheduled function to ingest jobs from:
// - OpenAI Deep Search
// - SerpAPI
// - Other configured sources
// =====================================================

import { serve } from "$std/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { logStructuredEvent } from "../_shared/observability.ts";
import { generateEmbedding } from "../job-board-ai-agent/handlers.ts";

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY")!,
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface NormalizedJob {
  title: string;
  description: string;
  company_name?: string;
  location: string;
  location_details?: string;
  category: string;
  job_type: string;
  pay_min?: number;
  pay_max?: number;
  pay_type: string;
  currency?: string;
  external_url?: string;
  external_id?: string;
  expires_at?: string;
}

serve(async (req: Request) => {
  const correlationId = crypto.randomUUID();
  
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    await logStructuredEvent("JOB_SOURCES_SYNC_START", { correlationId });

    const stats = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    // Load active job sources
    const { data: sources, error: sourcesError } = await supabase
      .from("job_sources")
      .select("*")
      .eq("is_active", true);

    if (sourcesError) throw sourcesError;

    for (const source of sources || []) {
      try {
        await logStructuredEvent("PROCESSING_SOURCE", {
          sourceId: source.id,
          sourceName: source.name,
          sourceType: source.source_type,
          correlationId,
        });

        if (source.source_type === "openai_deep_search") {
          const sourceStats = await processDeepSearch(source, correlationId);
          stats.inserted += sourceStats.inserted;
          stats.updated += sourceStats.updated;
          stats.skipped += sourceStats.skipped;
          stats.errors += sourceStats.errors;
        } else if (source.source_type === "serpapi") {
          const sourceStats = await processSerpAPI(source, correlationId);
          stats.inserted += sourceStats.inserted;
          stats.updated += sourceStats.updated;
          stats.skipped += sourceStats.skipped;
          stats.errors += sourceStats.errors;
        }
      } catch (error: any) {
        await logStructuredEvent("SOURCE_ERROR", {
          sourceId: source.id,
          error: error.message,
          correlationId,
        });
        stats.errors++;
      }
    }

    await logStructuredEvent("JOB_SOURCES_SYNC_COMPLETE", {
      ...stats,
      correlationId,
    });

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        correlationId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    await logStructuredEvent("ERROR", {
      event: "JOB_SOURCES_SYNC_ERROR",
      error: error.message,
      stack: error.stack,
      correlationId,
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

async function processDeepSearch(
  source: any,
  correlationId: string
): Promise<{ inserted: number; updated: number; skipped: number; errors: number }> {
  const stats = { inserted: 0, updated: 0, skipped: 0, errors: 0 };
  
  const queries = source.config?.queries || [];
  
  for (const queryConfig of queries) {
    try {
      const prompt = `Find recent job postings for "${queryConfig.query}".
Focus on legitimate job boards and classified ads.
Return a JSON array with these fields for each job:
- title: string
- description: string (2-3 sentences)
- company: string (if mentioned)
- location: string
- url: string (job posting URL)
- pay_range: string (if mentioned)
- job_type: one of (one_day, short_term, part_time, full_time, contract)
- posted_date: string (ISO date if available)
- expires_date: string (ISO date if available)

Return only the JSON array, no additional text.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You are a job data extraction assistant. Return only valid JSON arrays."
          },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      const jobs = result.jobs || [];

      for (const job of jobs) {
        try {
          const normalized = normalizeJob(job, queryConfig);
          const jobStats = await upsertJob(normalized, source.id);
          
          if (jobStats.inserted) stats.inserted++;
          else if (jobStats.updated) stats.updated++;
          else stats.skipped++;
        } catch (error: any) {
          console.error("Error processing job:", error);
          stats.errors++;
        }
      }
    } catch (error: any) {
      console.error("Deep Search query error:", error);
      stats.errors++;
    }
  }
  
  return stats;
}

async function processSerpAPI(
  source: any,
  correlationId: string
): Promise<{ inserted: number; updated: number; skipped: number; errors: number }> {
  const stats = { inserted: 0, updated: 0, skipped: 0, errors: 0 };
  
  const apiKey = Deno.env.get("SERPAPI_API_KEY");
  if (!apiKey) {
    console.warn("SERPAPI_API_KEY not configured");
    return stats;
  }
  
  const queries = source.config?.queries || [];
  
  for (const queryConfig of queries) {
    try {
      const url = new URL("https://serpapi.com/search");
      url.searchParams.set("engine", "google");
      url.searchParams.set("q", queryConfig.query + " jobs");
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("num", "10");
      
      const response = await fetch(url.toString());
      const data = await response.json();
      
      const organicResults = data.organic_results || [];
      
      for (const result of organicResults) {
        if (!isJobListing(result.title, result.snippet)) {
          continue;
        }
        
        try {
          const normalized: NormalizedJob = {
            title: result.title,
            description: result.snippet || result.title,
            location: extractLocation(result.snippet) || queryConfig.country || "Unknown",
            category: "other",
            job_type: "full_time",
            pay_type: "negotiable",
            external_url: result.link,
            external_id: result.link,
          };
          
          const jobStats = await upsertJob(normalized, source.id);
          
          if (jobStats.inserted) stats.inserted++;
          else if (jobStats.updated) stats.updated++;
          else stats.skipped++;
        } catch (error: any) {
          console.error("Error processing SerpAPI result:", error);
          stats.errors++;
        }
      }
    } catch (error: any) {
      console.error("SerpAPI query error:", error);
      stats.errors++;
    }
  }
  
  return stats;
}

function normalizeJob(raw: any, queryConfig: any): NormalizedJob {
  // Build location string with country context
  let location = raw.location || queryConfig.city || "Unknown";
  if (queryConfig.country && !location.includes(queryConfig.country)) {
    location = `${location}, ${queryConfig.country}`;
  }
  
  return {
    title: raw.title || "Job Opportunity",
    description: raw.description || raw.title,
    company_name: raw.company,
    location: location,
    category: queryConfig.category || inferCategory(raw.title, raw.description),
    job_type: raw.job_type || queryConfig.kind || "full_time",
    pay_min: parsePay(raw.pay_range, queryConfig.currency)?.min,
    pay_max: parsePay(raw.pay_range, queryConfig.currency)?.max,
    pay_type: parsePay(raw.pay_range, queryConfig.currency)?.unit || "negotiable",
    currency: queryConfig.currency,
    external_url: raw.url,
    external_id: raw.url,
    expires_at: raw.expires_date,
  };
}

function inferCategory(title: string, description: string): string {
  const text = (title + " " + description).toLowerCase();
  
  if (text.match(/delivery|driver|courier/)) return "delivery";
  if (text.match(/clean|housekeep/)) return "cleaning";
  if (text.match(/construction|build|labor|labour/)) return "construction";
  if (text.match(/security|guard/)) return "security";
  if (text.match(/cook|chef|waiter|waitress|restaurant|hospitality|bar staff|barista/)) return "cooking";
  if (text.match(/child|babysit|nanny/)) return "childcare";
  if (text.match(/tutor|teach|education/)) return "tutoring";
  if (text.match(/data entry|admin|office|receptionist/)) return "data_entry";
  if (text.match(/sales|marketing|retail/)) return "sales";
  if (text.match(/igaming|gaming|casino|betting/)) return "igaming";
  if (text.match(/healthcare|nurse|carer|medical/)) return "healthcare";
  
  return "other";
}

function parsePay(payRange?: string, currency?: string): { min?: number; max?: number; unit: string } | null {
  if (!payRange) return null;
  
  // Try to extract numbers and time unit
  const match = payRange.match(/(\d+(?:,\d{3})*(?:\.\d+)?)(?:-(\d+(?:,\d{3})*(?:\.\d+)?))?.*?(hour|day|week|month|annual|year)/i);
  if (match) {
    const parseNum = (str: string) => parseFloat(str.replace(/,/g, ''));
    return {
      min: parseNum(match[1]),
      max: match[2] ? parseNum(match[2]) : undefined,
      unit: match[3].toLowerCase().replace('annual', 'month').replace('year', 'month'),
    };
  }
  
  return null;
}

function extractLocation(text: string): string | null {
  const match = text.match(/in ([A-Z][a-z]+(?:,?\s+[A-Z][a-z]+)*)/);
  return match ? match[1] : null;
}

function isJobListing(title: string, snippet: string): boolean {
  const text = (title + " " + snippet).toLowerCase();
  const jobKeywords = ["job", "hiring", "career", "position", "opening", "vacancy", "employment"];
  return jobKeywords.some(keyword => text.includes(keyword));
}

async function upsertJob(
  normalized: NormalizedJob,
  sourceId: string
): Promise<{ inserted: boolean; updated: boolean; skipped: boolean }> {
  // Generate embedding
  const embeddingText = `
    ${normalized.title}
    ${normalized.description}
    ${normalized.category}
    Location: ${normalized.location}
  `.trim();
  
  const embedding = await generateEmbedding(openai, embeddingText);
  
  // Generate hash for deduplication
  const jobHash = await generateJobHash(
    normalized.title,
    normalized.company_name || "",
    normalized.location,
    normalized.external_url || ""
  );
  
  // Check if job already exists
  const { data: existing } = await supabase
    .from("job_listings")
    .select("id")
    .eq("source_id", sourceId)
    .eq("job_hash", jobHash)
    .single();
  
  if (existing) {
    // Update last_seen_at
    await supabase
      .from("job_listings")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", existing.id);
    
    return { inserted: false, updated: true, skipped: false };
  }
  
  // Detect country code from location
  const { data: countryData } = await supabase
    .rpc('detect_country_from_location', { location_text: normalized.location })
    .single();
  
  // Insert new job
  const { data: job, error } = await supabase
    .from("job_listings")
    .insert({
      source_id: sourceId,
      title: normalized.title,
      description: normalized.description,
      company_name: normalized.company_name,
      location: normalized.location,
      location_details: normalized.location_details,
      category: normalized.category,
      job_type: normalized.job_type,
      pay_min: normalized.pay_min,
      pay_max: normalized.pay_max,
      pay_type: normalized.pay_type,
      currency: normalized.currency,
      country_code: countryData || null,
      external_url: normalized.external_url,
      external_id: normalized.external_id,
      is_external: true,
      status: "open",
      posted_by: "system",
      required_skills_embedding: embedding,
      discovered_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      expires_at: normalized.expires_at,
      job_hash: jobHash,
    })
    .select()
    .single();
  
  if (error) throw error;
  
  return { inserted: true, updated: false, skipped: false };
}

async function generateJobHash(...parts: string[]): Promise<string> {
  const text = parts.map(p => (p || "").toLowerCase()).join("|");
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}
