// =====================================================
// JOB SOURCES SYNC - External Job Ingestion
// =====================================================
// Daily scheduled function to ingest jobs from:
// - OpenAI Deep Search
// - SerpAPI
// - Other configured sources
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { logStructuredEvent } from "../_shared/observability.ts";
import { requireFirstMessageContent } from "../_shared/openaiGuard.ts";
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
  // Contact information
  contact_phone?: string;
  contact_email?: string;
  contact_whatsapp?: string;
  contact_linkedin?: string;
  contact_facebook?: string;
  contact_website?: string;
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
      await logStructuredEvent("DEEP_SEARCH_QUERY_START", {
        sourceId: source.id,
        query: queryConfig.query,
        country: queryConfig.country,
        correlationId
      });

      // ENHANCED: Use gpt-4o with web search capability
      const prompt = `You are a comprehensive job search engine. Find ALL current job postings matching: "${queryConfig.query}"

SEARCH STRATEGY:
${queryConfig.country === 'Malta' ? `
- Check JobsPlus Malta (jobsplus.gov.mt)
- Check KeepMePosted.com.mt
- Check LinkedIn Malta jobs
- Check Indeed Malta (mt.indeed.com)
- Check Castille Recruitment
- Check Konnekt recruitment
- Check JobsInMalta.com
- Check iGaming job boards
- Check hospitality job sites
` : queryConfig.country === 'Rwanda' ? `
- Check MyJobsinRwanda.com
- Check BrighterMonday Rwanda
- Check LinkedIn Rwanda jobs
- Check JobinRwanda.com
- Check Akazi Kanoze
- Check New Times classifieds
- Check local Facebook job groups
- Check casual work WhatsApp groups
- Check NGO job boards
` : ''}

For EACH job found, extract:
1. title (exact job title)
2. company (company/employer name)
3. description (detailed job description, 3-5 sentences minimum)
4. location (specific location: city, district)
5. url (direct link to job posting - CRITICAL)
6. contact (phone/WhatsApp number if available)
7. salary (exact amount or range with currency)
8. job_type (one_day, part_time, full_time, contract, short_term)
9. category (delivery, cooking, cleaning, security, construction, data_entry, sales, igaming, healthcare, tutoring, childcare, other)
10. requirements (list of required skills/qualifications)
11. posted_date (when job was posted)
12. expires_date (application deadline)

Return JSON object with "jobs" array. Each job must have title, company, location, url.
Aim for MINIMUM 20 jobs per query. Be comprehensive and thorough.

{
  "jobs": [
    {
      "title": "...",
      "company": "...",
      "description": "...",
      "location": "...",
      "url": "...",
      "contact": "+...",
      "salary": "...",
      "job_type": "...",
      "category": "...",
      "requirements": ["...", "..."],
      "posted_date": "2025-01-15",
      "expires_date": "2025-02-15"
    }
  ]
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // Better than gpt-4-turbo for web-aware tasks
        messages: [
          {
            role: "system",
            content: "You are an expert job market researcher with web search capability. Find comprehensive, accurate, current job listings from real job boards and company websites. Always include direct URLs to job postings. Return detailed JSON data."
          },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2, // Lower temperature for accuracy
      });

      const result = JSON.parse(
        requireFirstMessageContent(response, "Job source extraction") || "{}",
      );
      const jobs = result.jobs || [];

      await logStructuredEvent("DEEP_SEARCH_QUERY_RESULT", {
        sourceId: source.id,
        query: queryConfig.query,
        jobsFound: jobs.length,
        correlationId
      });

      if (jobs.length === 0) {
        await logStructuredEvent("DEEP_SEARCH_NO_RESULTS", {
          sourceId: source.id,
          query: queryConfig.query,
          correlationId
        });
      }

      for (const job of jobs) {
        try {
          // Enhanced validation
          if (!job.title || !job.url) {
            stats.skipped++;
            continue;
          }

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
      await logStructuredEvent("DEEP_SEARCH_QUERY_ERROR", {
        sourceId: source.id,
        query: queryConfig.query,
        error: error.message,
        correlationId
      });
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
    await logStructuredEvent("SERPAPI_KEY_MISSING", {
      sourceId: source.id,
      warning: "SERPAPI_API_KEY not configured, skipping SerpAPI source",
      correlationId
    });
    return stats;
  }
  
  const queries = source.config?.queries || [];
  
  for (const queryConfig of queries) {
    try {
      await logStructuredEvent("SERPAPI_QUERY_START", {
        sourceId: source.id,
        query: queryConfig.query,
        country: queryConfig.country,
        correlationId
      });

      // Use Google Jobs engine if specified, otherwise regular Google search
      const engine = queryConfig.engine || source.config?.engine || "google";
      const numResults = queryConfig.num_results || 30; // Increased from 10
      
      const url = new URL("https://serpapi.com/search");
      url.searchParams.set("engine", engine);
      url.searchParams.set("q", queryConfig.query);
      url.searchParams.set("api_key", apiKey);
      
      if (engine === "google") {
        url.searchParams.set("num", String(numResults));
        
        // Add location parameter for better geo-targeting
        if (queryConfig.country === "Malta") {
          url.searchParams.set("gl", "mt");
          url.searchParams.set("hl", "en");
        } else if (queryConfig.country === "Rwanda") {
          url.searchParams.set("gl", "rw");
          url.searchParams.set("hl", "en");
        }
      } else if (engine === "google_jobs") {
        // Google Jobs specific parameters
        url.searchParams.set("chips", "date_posted:today"); // Recent jobs
        if (queryConfig.country) {
          url.searchParams.set("location", queryConfig.country);
        }
      }
      
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`SerpAPI returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Handle both regular search and Google Jobs results
      const results = engine === "google_jobs" 
        ? (data.jobs_results || [])
        : (data.organic_results || []);
      
      await logStructuredEvent("SERPAPI_QUERY_RESULT", {
        sourceId: source.id,
        query: queryConfig.query,
        engine,
        resultsFound: results.length,
        correlationId
      });

      if (results.length === 0) {
        await logStructuredEvent("SERPAPI_NO_RESULTS", {
          sourceId: source.id,
          query: queryConfig.query,
          correlationId
        });
      }
      
      for (const result of results) {
        // Enhanced job validation
        const title = result.title || result.job_title || "";
        const snippet = result.snippet || result.description || "";
        const link = result.link || result.apply_link || result.url || "";
        
        if (!title || !link) {
          stats.skipped++;
          continue;
        }
        
        // For regular Google search, validate it's actually a job listing
        if (engine === "google" && !isJobListing(title, snippet)) {
          stats.skipped++;
          continue;
        }
        
        try {
          // Use OpenAI to extract structured data from the search result
          const extractedJob = await extractJobDetailsWithAI(
            title,
            snippet,
            link,
            queryConfig.country || "Unknown"
          );

          if (extractedJob) {
            const normalized: NormalizedJob = {
              title: extractedJob.title,
              description: extractedJob.description,
              company_name: extractedJob.company,
              location: extractedJob.location || queryConfig.country || "Unknown",
              category: extractedJob.category || inferCategory(title, snippet),
              job_type: extractedJob.job_type || "full_time",
              pay_min: extractedJob.pay_min,
              pay_max: extractedJob.pay_max,
              pay_type: extractedJob.pay_type || "negotiable",
              currency: extractedJob.currency,
              external_url: link,
              external_id: link,
              expires_at: extractedJob.expires_at,
              // Contact information
              contact_phone: extractedJob.contact_phone,
              contact_email: extractedJob.contact_email,
              contact_whatsapp: extractedJob.contact_whatsapp,
              contact_linkedin: extractedJob.contact_linkedin,
              contact_facebook: extractedJob.contact_facebook,
              contact_website: extractedJob.contact_website,
            };
            
            const jobStats = await upsertJob(normalized, source.id);
            
            if (jobStats.inserted) stats.inserted++;
            else if (jobStats.updated) stats.updated++;
            else stats.skipped++;
          } else {
            stats.skipped++;
          }
        } catch (error: any) {
          console.error("Error processing SerpAPI result:", error);
          stats.errors++;
        }
      }

      // Rate limiting between queries
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error: any) {
      await logStructuredEvent("SERPAPI_QUERY_ERROR", {
        sourceId: source.id,
        query: queryConfig.query,
        error: error.message,
        correlationId
      });
      stats.errors++;
    }
  }
  
  return stats;
}

// Helper: Extract job details using OpenAI
async function extractJobDetailsWithAI(
  title: string,
  snippet: string,
  url: string,
  country: string
): Promise<any | null> {
  try {
    const prompt = `Extract job details from this search result:

Title: ${title}
Description: ${snippet}
URL: ${url}
Country: ${country}

Return JSON with:
{
  "title": "clean job title",
  "company": "company name or null",
  "description": "expanded description (2-3 sentences)",
  "location": "specific location (city, area) or null",
  "category": "delivery|cooking|cleaning|security|construction|data_entry|sales|igaming|healthcare|tutoring|childcare|technology|customer_service|agriculture|manufacturing|other",
  "job_type": "one_day|part_time|full_time|contract|short_term",
  "pay_min": number or null,
  "pay_max": number or null,
  "pay_type": "hour|day|week|month|negotiable",
  "currency": "RWF|EUR|USD" or null,
  "expires_at": "YYYY-MM-DD" or null,
  "contact_phone": "phone number with country code (e.g., +250788123456) or null",
  "contact_email": "email address or null",
  "contact_whatsapp": "WhatsApp number with country code or null",
  "contact_linkedin": "LinkedIn URL or profile name or null",
  "contact_facebook": "Facebook page/profile URL or null",
  "contact_website": "company website (if different from job URL) or null"
}

CRITICAL - Extract ALL contact information present:
- Look for phone numbers, emails, WhatsApp mentions, social media links
- For phone numbers, add country code: +250 for Rwanda, +356 for Malta
- If "WhatsApp" is mentioned separately, put in contact_whatsapp
- Extract LinkedIn, Facebook, Twitter mentions
- Look for "Apply at:", "Contact:", "Email:", "Call:", "WhatsApp:", etc.

If this doesn't look like a real job posting, return null.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Fast and cheap for extraction
      messages: [
        {
          role: "system",
          content: "You extract structured job data from search results. ALWAYS extract all contact information (phone, email, WhatsApp, social media). Return only valid JSON."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 700, // Increased for contact fields
    });

    const content = requireFirstMessageContent(
      response,
      "Job board response summarization",
    ).trim();
    if (!content || content === "null") return null;

    const result = JSON.parse(content);
    
    // Validate required fields
    if (!result.title || result.title.length < 5) {
      return null;
    }
    
    // At least one contact method or URL must be present
    const hasContact = result.contact_phone || result.contact_email || 
                      result.contact_whatsapp || result.contact_linkedin ||
                      url; // URL itself is a contact method
    
    if (!hasContact) {
      console.log(`Skipping job without contact: ${result.title}`);
      return null;
    }

    return result;
  } catch (error) {
    console.error("AI extraction error:", error);
    return null;
  }
}

function normalizeJob(raw: any, queryConfig: any): NormalizedJob {
  // Build location string with country context
  let location = raw.location || queryConfig.city || queryConfig.country || "Unknown";
  if (queryConfig.country && !location.toLowerCase().includes(queryConfig.country.toLowerCase())) {
    location = `${location}, ${queryConfig.country}`;
  }
  
  // Enhanced category inference
  const category = raw.category || 
                   queryConfig.category || 
                   inferCategory(raw.title || "", raw.description || "");
  
  // Parse salary/pay information
  const payInfo = parsePay(
    raw.salary || raw.pay_range || raw.compensation,
    queryConfig.currency
  );
  
  // Determine currency
  let currency = raw.currency || queryConfig.currency;
  if (!currency) {
    currency = queryConfig.country === "Malta" ? "EUR" :
               queryConfig.country === "Rwanda" ? "RWF" : "USD";
  }
  
  return {
    title: (raw.title || "Job Opportunity").substring(0, 200),
    description: (raw.description || raw.title || "").substring(0, 2000),
    company_name: raw.company || raw.company_name,
    location: location,
    location_details: raw.location_details,
    category: category,
    job_type: raw.job_type || queryConfig.kind || queryConfig.job_type || "full_time",
    pay_min: raw.pay_min || payInfo?.min,
    pay_max: raw.pay_max || payInfo?.max,
    pay_type: raw.pay_type || payInfo?.unit || "negotiable",
    currency: currency,
    external_url: raw.url || raw.link || raw.external_url,
    external_id: raw.url || raw.link || raw.external_url,
    expires_at: raw.expires_date || raw.deadline || raw.expires_at,
  };
}

function inferCategory(title: string, description: string): string {
  const text = (title + " " + description).toLowerCase();
  
  // Hospitality & Food Service
  if (text.match(/cook|chef|waiter|waitress|restaurant|hospitality|bar staff|barista|bartender|food service|kitchen/)) return "cooking";
  
  // Delivery & Logistics
  if (text.match(/delivery|driver|courier|logistics|dispatch|transport/)) return "delivery";
  
  // Cleaning & Housekeeping
  if (text.match(/clean|housekeep|janitor|maintenance|sanitation/)) return "cleaning";
  
  // Construction & Manual Labor
  if (text.match(/construction|build|labor|labour|carpenter|plumber|electrician|mason|welder/)) return "construction";
  
  // Security
  if (text.match(/security|guard|watchman|surveillance|protection/)) return "security";
  
  // Data Entry & Admin
  if (text.match(/data entry|admin|office|receptionist|secretary|clerk|assistant/)) return "data_entry";
  
  // Sales & Marketing
  if (text.match(/sales|marketing|retail|merchandiser|promoter|agent|business development/)) return "sales";
  
  // iGaming & Casino (Malta specific)
  if (text.match(/igaming|gaming|casino|betting|dealer|croupier|online gaming|poker|slots/)) return "igaming";
  
  // Healthcare & Medical
  if (text.match(/healthcare|nurse|doctor|medical|carer|caregiver|pharmacy|clinical/)) return "healthcare";
  
  // Childcare & Education
  if (text.match(/child|babysit|nanny|daycare|kindergarten|preschool/)) return "childcare";
  if (text.match(/tutor|teach|education|instructor|trainer|professor|lecturer/)) return "tutoring";
  
  // IT & Technology
  if (text.match(/developer|programmer|software|IT|tech|engineer|computer|web|mobile|app/)) return "technology";
  
  // Customer Service
  if (text.match(/customer service|call center|support|helpdesk|client service/)) return "customer_service";
  
  // Agriculture & Farming
  if (text.match(/farm|agriculture|crop|livestock|harvest|agronomist/)) return "agriculture";
  
  // Manufacturing & Production
  if (text.match(/manufacturing|factory|production|assembly|operator|machinist/)) return "manufacturing";
  
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
      // Contact information
      contact_phone: normalized.contact_phone,
      contact_email: normalized.contact_email,
      contact_whatsapp: normalized.contact_whatsapp,
      contact_linkedin: normalized.contact_linkedin,
      contact_facebook: normalized.contact_facebook,
      contact_website: normalized.contact_website,
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
