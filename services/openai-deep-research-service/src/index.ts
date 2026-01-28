/**
 * OpenAI Deep Research Service
 * 
 * Provides autonomous web research capabilities powered by o3-class models.
 * Searches from: 1) Configured website sources  2) User listings in database
 */

import { createHash } from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import express, { Request, Response } from 'express';
import OpenAI from 'openai';
import pino from 'pino';

import './env';

const logger = pino({ name: 'deep-research-service' });

const app = express();
app.use(express.json());

// Clients
const supabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false } }
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================================================
// TYPES
// ============================================================================

interface DeepResearchRequest {
  user_id?: string;
  agent_id: string;
  domain: 'jobs' | 'real_estate' | 'farmers' | 'sales' | 'generic';
  query: string;
  input_context?: Record<string, unknown>;
  country?: string; // Filter sources by country
}

interface ExternalDiscoveryRequest {
  request_id: string;
  need: string;
  category?: string;
  location_text?: string;
  language?: "en" | "fr" | "rw";
  min_candidates?: number;
  max_results?: number;
}

type CandidateVendor = {
  name: string;
  phones: string[];
  website?: string;
  address?: string;
  area?: string;
  confidence: number;
  sources: Array<{ title?: string; url?: string; snippet?: string }>;
};

interface Source {
  id: string;
  name: string;
  url: string;
  search_url_template?: string;
  priority: number;
  trust_score: number;
}

// ============================================================================
// SOURCE MANAGEMENT
// ============================================================================

/**
 * Get search sources from database for a domain
 */
async function getSearchSources(
  domain: string,
  country?: string,
  context?: Record<string, unknown>
): Promise<Source[]> {
  let sources: Source[] = [];

  try {
    switch (domain) {
      case 'jobs':
        const { data: jobSources } = await supabase.rpc('get_job_search_sources', {
          p_country: country || null,
          p_category: (context?.category as string) || null,
          p_limit: 10,
        });
        sources = jobSources || [];
        break;

      case 'real_estate':
        const { data: reSources } = await supabase.rpc('get_real_estate_search_sources', {
          p_country: country || null,
          p_area: (context?.location as string) || null,
          p_property_type: (context?.property_type as string) || null,
          p_limit: 10,
        });
        sources = reSources || [];
        break;

      case 'farmers':
        const { data: farmerSources } = await supabase
          .from('farmers_sources')
          .select('id, name, url, priority, trust_score')
          .eq('is_active', true)
          .order('priority', { ascending: false })
          .limit(10);
        sources = farmerSources || [];
        break;
    }
  } catch (error) {
    logger.error({ domain, error, msg: 'sources.fetch_failed' });
  }

  return sources;
}

/**
 * Get internal database listings for a domain
 */
async function getInternalListings(
  domain: string,
  context: Record<string, unknown>
): Promise<any[]> {
  let listings: any[] = [];

  try {
    switch (domain) {
      case 'jobs':
        // Get job listings from database
        const { data: jobs } = await supabase
          .from('job_listings')
          .select('id, title, company, location, salary_range, description, requirements')
          .eq('status', 'active')
          .limit(20);
        listings = jobs || [];
        
        // Also get intake data from other users (for matching)
        const { data: jobIntakes } = await supabase
          .from('jobs_call_intakes')
          .select('call_id, role_title, category, location, skills, salary_min, salary_max, mode')
          .eq('mode', context.mode === 'seeking' ? 'hiring' : 'seeking')
          .limit(20);
        if (jobIntakes) listings = [...listings, ...jobIntakes];
        break;

      case 'real_estate':
        // Get properties from database
        const { data: properties } = await supabase
          .from('properties')
          .select('id, title, price, location, bedrooms, property_type, transaction_type, description')
          .eq('status', 'active')
          .limit(20);
        listings = properties || [];
        
        // Also get intake data from users (for matching)
        const { data: reIntakes } = await supabase
          .from('real_estate_call_intakes')
          .select('*')
          .eq('side', context.side === 'seeker' ? 'lister' : 'seeker')
          .limit(20);
        if (reIntakes) listings = [...listings, ...reIntakes];
        break;

      case 'farmers':
        // Get produce listings from other users
        const { data: produceListings } = await supabase
          .from('farmers_call_intakes')
          .select('*')
          .eq('side', context.side === 'farmer' ? 'buyer' : 'farmer')
          .limit(20);
        listings = produceListings || [];
        break;
    }
  } catch (error) {
    logger.error({ domain, error, msg: 'internal_listings.fetch_failed' });
  }

  return listings;
}

// ============================================================================
// EXTERNAL DISCOVERY HELPERS
// ============================================================================

const PHONE_REGEX = /(?:\+?\d[\d\s().-]{6,}\d)/g;

function extractPhones(text?: string): string[] {
  if (!text) return [];
  const matches = text.match(PHONE_REGEX) ?? [];
  return matches
    .map((raw) => raw.replace(/[\s().-]/g, ""))
    .filter((value) => value.length >= 8)
    .slice(0, 3);
}

function normalizeName(result: { title?: string; url?: string }) {
  if (result.title && result.title.trim().length > 0) return result.title.trim();
  if (result.url && result.url.trim().length > 0) return result.url.replace(/^https?:\/\//, "");
  return "Unknown vendor";
}

function baseConfidence(result: { url?: string }, phones: string[]): number {
  if (phones.length > 0) return 0.55;
  if (result.url) return 0.35;
  return 0.2;
}

function normalizeSearchResults(
  results: Array<{ title?: string; url?: string; snippet?: string }>
): CandidateVendor[] {
  const seen = new Set<string>();
  const candidates: CandidateVendor[] = [];

  for (const result of results) {
    const key = result.url ?? result.title ?? "";
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const phones = extractPhones(result.snippet);
    candidates.push({
      name: normalizeName(result),
      phones,
      website: result.url,
      confidence: baseConfidence(result, phones),
      sources: [result],
    });
  }

  return candidates;
}

function buildDedupeKey(input: { name?: string; phones?: string[]; website?: string }): string {
  const normalizedName = (input.name ?? "").trim().toLowerCase();
  const normalizedWebsite = (input.website ?? "").trim().toLowerCase();
  const normalizedPhones = (input.phones ?? [])
    .map((phone) => phone.replace(/\D/g, ""))
    .filter(Boolean)
    .sort()
    .join("|");

  const seed = [normalizedName, normalizedWebsite, normalizedPhones].join("::");
  return createHash("sha256").update(seed).digest("hex");
}

function formatExternalOptionsMessage(
  candidates: CandidateVendor[],
  language: ExternalDiscoveryRequest["language"]
) {
  const MAX_OPTIONS = 5;
  const templates = {
    en: {
      header: "Additional options (not yet verified in our network):",
      footer: "You can contact them directly to confirm availability and pricing.",
    },
    fr: {
      header: "Options supplémentaires (pas encore vérifiées dans notre réseau) :",
      footer: "Vous pouvez les contacter directement pour confirmer disponibilité et prix.",
    },
    rw: {
      header: "Amahitamo y’inyongera (ataragenzuwe mu bafatanyabikorwa bacu):",
      footer: "Mushobora kubavugisha mubonye amakuru y’ibiciro n’uko bahagaze.",
    },
  };
  const lang = language === "fr" || language === "rw" ? language : "en";
  const template = templates[lang];
  const lines = candidates.slice(0, MAX_OPTIONS).map((candidate, idx) => {
    const phone = candidate.phones?.[0];
    const location = candidate.address ?? candidate.area;
    const parts = [
      `${idx + 1}) ${candidate.name}`,
      location ? `— ${location}` : null,
      phone ? `— ${phone}` : null,
      candidate.website ? `— ${candidate.website}` : null,
    ].filter(Boolean);
    return parts.join(" ");
  });

  if (!lines.length) return "";
  return [template.header, ...lines, template.footer].join("\n");
}

async function searchWithOpenAIWeb(query: string) {
  const response = await openai.responses.create({
    model: process.env.OPENAI_WEB_SEARCH_MODEL || "gpt-4o",
    input: [{ role: "user", content: query }],
    tools: [{ type: "web_search" }],
  });

  const results: Array<{ title?: string; url?: string; snippet?: string }> = [];
  for (const item of response.output ?? []) {
    if (item?.type !== "web_search_call") continue;
    if (Array.isArray(item.results)) {
      for (const entry of item.results) {
        results.push({
          title: entry?.title,
          url: entry?.url,
          snippet: entry?.snippet,
        });
      }
    }
    const sources = item.action?.sources;
    if (Array.isArray(sources)) {
      for (const source of sources) {
        results.push({
          title: source?.title,
          url: source?.url,
          snippet: source?.snippet ?? source?.description,
        });
      }
    }
  }

  return results;
}

async function searchWithGeminiWeb(query: string) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return [];

  const model = process.env.GEMINI_SEARCH_MODEL || "gemini-2.0-flash-exp";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: query }] }],
        tools: [{ googleSearch: {} }],
      }),
    }
  );

  if (!response.ok) {
    return [];
  }

  const payload = await response.json();
  const grounding = payload?.candidates?.[0]?.groundingMetadata;
  const chunks = grounding?.groundingChunks ?? [];
  const results: Array<{ title?: string; url?: string; snippet?: string }> = [];
  for (const chunk of chunks) {
    const web = chunk?.web;
    if (!web?.uri && !web?.title) continue;
    results.push({
      title: web?.title,
      url: web?.uri,
      snippet: web?.snippet,
    });
  }

  return results;
}

async function generateExternalMessageWithMoltbot(
  candidates: CandidateVendor[],
  language: ExternalDiscoveryRequest["language"]
): Promise<string | null> {
  const baseUrl = process.env.MOLTBOT_BASE_URL || DEFAULT_MOLTBOT_BASE_URL;

  const token = process.env.MOLTBOT_BEARER_TOKEN;
  const model = process.env.MOLTBOT_MODEL || "gpt-4o-mini";
  const prompt = [
    "You are a marketplace concierge.",
    "Create a short WhatsApp message listing external options.",
    "Do NOT claim availability or pricing. State they are not verified.",
    "Keep it concise and numbered.",
    "End with a short line encouraging the user to contact them directly.",
  ].join(" ");

  const payload = {
    model,
    messages: [
      { role: "system", content: prompt },
      {
        role: "user",
        content: JSON.stringify({
          language: language ?? "en",
          options: candidates.map((c) => ({
            name: c.name,
            phone: c.phones?.[0],
            website: c.website,
            location: c.address ?? c.area,
          })),
        }),
      },
    ],
  };

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) return null;
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content.trim() : null;
}

async function checkMoltbotHealth(): Promise<{
  reachable: boolean;
  status: string;
  http_status?: number;
  message?: string;
}> {
  const baseUrl = process.env.MOLTBOT_BASE_URL || DEFAULT_MOLTBOT_BASE_URL;
  const token = process.env.MOLTBOT_BEARER_TOKEN;
  const model = process.env.MOLTBOT_MODEL || "moltbot";

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "ping" }],
      }),
    });

    if (response.ok) {
      return { reachable: true, status: "ok", http_status: response.status };
    }

    if (response.status === 401 || response.status === 403) {
      return { reachable: true, status: "auth_required", http_status: response.status };
    }

    return { reachable: false, status: "error", http_status: response.status };
  } catch (error) {
    return {
      reachable: false,
      status: "unreachable",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * POST /marketplace/external-discovery
 *
 * Lightweight external vendor discovery (web + maps) with lead storage.
 */
app.post('/marketplace/external-discovery', async (req: Request, res: Response) => {
  try {
    const payload = req.body as ExternalDiscoveryRequest;

    if (!payload?.request_id || !payload?.need) {
      return res.status(400).json({ error: 'request_id and need required' });
    }

    if ((process.env.EXTERNAL_DISCOVERY_ENABLED ?? 'false').toLowerCase() !== 'true') {
      return res.json({
        disabled: true,
        message: '',
        candidates: [],
        lead_ids: [],
      });
    }

    const maxResults = Math.min(Math.max(payload.max_results ?? 10, 1), 10);
    const queryParts = [
      payload.need,
      payload.category ? `category: ${payload.category}` : null,
      payload.location_text ? `location: ${payload.location_text}` : null,
    ].filter(Boolean);
    const query = `Find vendors or businesses for: ${queryParts.join(' ')}. Provide names and contact info.`;

    const openAiResults = await searchWithOpenAIWeb(query);
    const geminiResults = openAiResults.length < maxResults ? await searchWithGeminiWeb(query) : [];
    const mergedResults = [...openAiResults, ...geminiResults].slice(0, maxResults);

    const candidates = normalizeSearchResults(mergedResults);
    const leadIds: string[] = [];

    for (const candidate of candidates) {
      const dedupeKey = buildDedupeKey({
        name: candidate.name,
        phones: candidate.phones,
        website: candidate.website,
      });

      const { data, error } = await supabase
        .from('vendor_leads')
        .upsert({
          request_id: payload.request_id,
          source: 'external_discovery',
          name: candidate.name,
          category_guess: payload.category ?? null,
          area: candidate.area ?? null,
          address: candidate.address ?? null,
          phones: candidate.phones,
          website: candidate.website ?? null,
          social_links: {},
          confidence: candidate.confidence,
          status: 'new',
          dedupe_key: dedupeKey,
          raw_sources: candidate.sources,
        }, { onConflict: 'dedupe_key' })
        .select('id')
        .single();

      if (error) {
        logger.warn({ error, msg: 'vendor_lead.upsert_failed' });
        continue;
      }

      if (data?.id) leadIds.push(data.id);
    }

    const fallbackMessage = formatExternalOptionsMessage(candidates, payload.language);
    const moltbotMessage = await generateExternalMessageWithMoltbot(candidates, payload.language);

    return res.json({
      message: moltbotMessage || fallbackMessage,
      candidates,
      lead_ids: leadIds,
    });
  } catch (error) {
    logger.error({ error, msg: 'external_discovery_failed' });
    return res.status(500).json({ error: 'external_discovery_failed' });
  }
});

/**
 * GET /marketplace/moltbot-health
 *
 * Check Moltbot gateway reachability.
 */
app.get('/marketplace/moltbot-health', async (_req: Request, res: Response) => {
  const health = await checkMoltbotHealth();
  res.json({
    base_url: process.env.MOLTBOT_BASE_URL || DEFAULT_MOLTBOT_BASE_URL,
    ...health,
  });
});

/**
 * GET /sources/:domain
 * 
 * Get configured search sources for a domain
 */
app.get('/sources/:domain', async (req: Request, res: Response) => {
  const { domain } = req.params;
  const { country } = req.query;

  const sources = await getSearchSources(domain, country as string);
  res.json({ domain, sources });
});

/**
 * POST /deep-research/start
 * 
 * Start a new deep research job using configured sources + internal DB
 */
app.post('/deep-research/start', async (req: Request, res: Response) => {
  try {
    const { user_id, agent_id, domain, query, input_context = {}, country }: DeepResearchRequest = req.body;

    if (!agent_id || !domain || !query) {
      return res.status(400).json({ error: 'agent_id, domain, and query required' });
    }

    // Create job record
    const { data: job, error } = await supabase
      .from('deep_research_jobs')
      .insert({
        user_id,
        agent_id,
        domain,
        query,
        input_context: { ...input_context, country },
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      logger.error({ error, msg: 'deep_research.create_failed' });
      return res.status(500).json({ error: 'Failed to create research job' });
    }

    // Start the research async with dynamic sources
    startResearch(job.id, domain, query, { ...input_context, country }).catch((err) => {
      logger.error({ jobId: job.id, error: err, msg: 'deep_research.async_failed' });
    });

    res.status(202).json({
      job_id: job.id,
      status: 'pending',
      message: 'Deep research job started. Poll /deep-research/:id/status for updates.',
    });
  } catch (error) {
    logger.error({ error, msg: 'deep_research.start.error' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /deep-research/:id/status
 */
app.get('/deep-research/:id/status', async (req: Request, res: Response) => {
  const { id } = req.params;

  const { data: job, error } = await supabase
    .from('deep_research_jobs')
    .select('id, status, domain, query, created_at, started_at, finished_at, error_message')
    .eq('id', id)
    .single();

  if (error || !job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json(job);
});

/**
 * GET /deep-research/:id/result
 */
app.get('/deep-research/:id/result', async (req: Request, res: Response) => {
  const { id } = req.params;

  const { data: job } = await supabase
    .from('deep_research_jobs')
    .select('id, status, domain, query')
    .eq('id', id)
    .single();

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (job.status !== 'succeeded') {
    return res.status(400).json({ 
      error: 'Results not available', 
      status: job.status,
      message: job.status === 'running' ? 'Research still in progress' : 'Research failed' 
    });
  }

  const { data: result } = await supabase
    .from('deep_research_results')
    .select('*')
    .eq('job_id', id)
    .single();

  if (!result) {
    return res.status(500).json({ error: 'Result not found despite job success' });
  }

  res.json({
    job_id: id,
    domain: job.domain,
    query: job.query,
    summary: result.summary,
    citations: result.citations,
    follow_up_actions: result.follow_up_actions,
    source_count: result.source_count,
    word_count: result.word_count,
    internal_matches: result.raw_report?.internal_matches || [],
    external_sources: result.raw_report?.sources_used || [],
  });
});

/**
 * POST /deep-research/:id/cancel
 */
app.post('/deep-research/:id/cancel', async (req: Request, res: Response) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('deep_research_jobs')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .in('status', ['pending', 'running']);

  if (error) {
    return res.status(500).json({ error: 'Failed to cancel job' });
  }

  res.json({ job_id: id, status: 'cancelled' });
});

// ============================================================================
// RESEARCH LOGIC
// ============================================================================

async function startResearch(
  jobId: string,
  domain: string,
  query: string,
  context: Record<string, unknown>
): Promise<void> {
  // Update status to running
  await supabase
    .from('deep_research_jobs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', jobId);

  try {
    // 1. Get configured external sources from database
    const sources = await getSearchSources(domain, context.country as string, context);
    logger.info({ jobId, domain, sourceCount: sources.length, msg: 'sources.loaded' });

    // 2. Get internal database listings
    const internalListings = await getInternalListings(domain, context);
    logger.info({ jobId, domain, internalCount: internalListings.length, msg: 'internal_listings.loaded' });

    // 3. Build enhanced prompt with sources
    const sourceList = sources.map((s) => `- ${s.name}: ${s.url}`).join('\n');
    const internalSummary = internalListings.length > 0
      ? `\n\nINTERNAL DATABASE (${internalListings.length} listings):\n${JSON.stringify(internalListings.slice(0, 5), null, 2)}`
      : '';

    const systemPrompt = buildResearchPrompt(domain, context, sourceList, internalSummary);
    
    // 4. Execute research with OpenAI web search
    const response = await openai.responses.create({
      model: 'gpt-4o',
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ],
      tools: [{ type: 'web_search' }],
    });

    // Extract text content
    const textContent = response.output
      .filter((item: any) => item.type === 'message')
      .map((item: any) => item.content?.map((c: any) => c.text).join(''))
      .join('\n');

    // Extract citations from web search results
    const citations = response.output
      .filter((item: any) => item.type === 'web_search_call')
      .flatMap((item: any) => 
        item.results?.map((r: any) => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
        })) || []
      );

    // 5. Generate structured summary
    const summary = await generateStructuredSummary(domain, query, textContent, context, internalListings);

    // 6. Save result with source info
    await supabase.from('deep_research_results').insert({
      job_id: jobId,
      summary: summary.summary,
      raw_report: { 
        full_text: textContent, 
        openai_response: response,
        sources_used: sources.map((s) => ({ name: s.name, url: s.url })),
        internal_matches: summary.internalMatches,
      },
      citations,
      follow_up_actions: summary.actions,
      source_count: citations.length + (summary.internalMatches?.length || 0),
      word_count: textContent.split(/\s+/).length,
    });

    // 7. Parse domain-specific results
    await parseDomainResults(jobId, domain, textContent, citations);

    // 8. Mark success
    await supabase
      .from('deep_research_jobs')
      .update({ status: 'succeeded', finished_at: new Date().toISOString() })
      .eq('id', jobId);

    logger.info({ 
      jobId, 
      domain, 
      externalCitations: citations.length,
      internalMatches: summary.internalMatches?.length || 0,
      msg: 'deep_research.completed' 
    });

  } catch (error) {
    logger.error({ jobId, error, msg: 'deep_research.failed' });
    
    await supabase
      .from('deep_research_jobs')
      .update({ 
        status: 'failed', 
        finished_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : 'Unknown error' 
      })
      .eq('id', jobId);
  }
}

function buildResearchPrompt(
  domain: string,
  context: Record<string, unknown>,
  sourceList: string,
  internalSummary: string
): string {
  const domainPrompts: Record<string, string> = {
    jobs: `You are a job market researcher. 
PRIORITY SOURCES TO SEARCH (search these first):
${sourceList}

Search for current job listings matching the user's requirements. Also consider the internal database listings below.
${internalSummary}

Context: ${JSON.stringify(context)}

Provide results from BOTH external websites AND internal database matches. Clearly label which source each listing came from.`,
    
    real_estate: `You are a real estate researcher.
PRIORITY SOURCES TO SEARCH (search these first):
${sourceList}

Search for property listings matching the user's requirements. Also consider the internal database listings below.
${internalSummary}

Context: ${JSON.stringify(context)}

Provide results from BOTH external websites AND internal database matches. Include price, location, bedrooms, and property type for each listing.`,
    
    farmers: `You are an agricultural market researcher.
PRIORITY SOURCES TO SEARCH:
${sourceList}

Search for market prices, buyers, and suppliers. Also consider user listings from the internal database.
${internalSummary}

Context: ${JSON.stringify(context)}

Provide market intel from both external sources and internal user listings.`,
    
    sales: `You are a business intelligence researcher.
SOURCES:
${sourceList}

Find company information and contact details for sales prospecting.
${internalSummary}

Context: ${JSON.stringify(context)}`,
    
    generic: `You are a general researcher.
SOURCES TO SEARCH:
${sourceList}

${internalSummary}

Find comprehensive information and cite all sources.`,
  };

  return domainPrompts[domain] || domainPrompts.generic;
}

async function generateStructuredSummary(
  domain: string,
  query: string,
  fullText: string,
  context: Record<string, unknown>,
  internalListings: any[]
): Promise<{ summary: string; actions: any[]; internalMatches: any[] }> {
  // Score internal listings for relevance
  const internalMatches = internalListings.slice(0, 5).map((listing) => ({
    ...listing,
    source: 'internal_database',
    relevance: 0.8, // TODO: Calculate actual relevance score
  }));

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Summarize the research findings in 2-3 paragraphs. Mention both external search results and internal database matches. Then suggest follow-up actions as JSON array with format: [{"type": "action_type", "priority": "high/medium/low", "description": "..."}]`,
      },
      {
        role: 'user',
        content: `Domain: ${domain}\nQuery: ${query}\nContext: ${JSON.stringify(context)}\n\nExternal research:\n${fullText.slice(0, 3000)}\n\nInternal matches:\n${JSON.stringify(internalMatches)}`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  try {
    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      summary: result.summary || fullText.slice(0, 500),
      actions: result.actions || [],
      internalMatches,
    };
  } catch {
    return { summary: fullText.slice(0, 500), actions: [], internalMatches };
  }
}

async function parseDomainResults(
  jobId: string,
  domain: string,
  text: string,
  citations: any[]
): Promise<void> {
  switch (domain) {
    case 'real_estate':
      for (const citation of citations.slice(0, 10)) {
        await supabase.from('real_estate_external_listings').insert({
          research_job_id: jobId,
          source_url: citation.url,
          source_name: new URL(citation.url).hostname,
          title: citation.title,
          description: citation.snippet,
          raw_data: citation,
        }).catch(() => {});
      }
      break;

    case 'jobs':
      for (const citation of citations.slice(0, 10)) {
        await supabase.from('jobs_external_listings').insert({
          research_job_id: jobId,
          source_url: citation.url,
          source_name: new URL(citation.url).hostname,
          title: citation.title,
          description: citation.snippet,
          raw_data: citation,
        }).catch(() => {});
      }
      break;

    case 'farmers':
      await supabase.from('farmers_market_intel').insert({
        research_job_id: jobId,
        produce_type: 'various',
        source_url: citations[0]?.url,
        source_name: citations[0] ? new URL(citations[0].url).hostname : 'research',
        raw_data: { citations, text_preview: text.slice(0, 1000) },
      }).catch(() => {});
      break;
  }
}

// ============================================================================
// START SERVER
// ============================================================================

const PORT = parseInt(process.env.DEEP_RESEARCH_PORT || '3033', 10);

app.listen(PORT, () => {
  logger.info({ port: PORT, msg: 'deep-research-service.started' });
});
const DEFAULT_MOLTBOT_BASE_URL = "http://127.0.0.1:18789";
