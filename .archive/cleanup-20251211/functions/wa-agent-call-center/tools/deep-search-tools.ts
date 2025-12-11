/**
 * Deep Search Tools for CallCenterAGI
 * Integrates OpenAI Deep Research API for real-time web search
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface DeepSearchParams {
  query: string;
  country?: string;
  context?: Record<string, any>;
}

interface SearchSource {
  name: string;
  url: string;
  search_url_template?: string;
  priority: number;
  trust_score: number;
}

/**
 * Call OpenAI Deep Research Service
 */
async function callDeepResearchService(
  domain: 'jobs' | 'real_estate' | 'farmers',
  query: string,
  userId?: string,
  country?: string,
  context?: Record<string, any>
): Promise<any> {
  const serviceUrl = Deno.env.get('DEEP_RESEARCH_SERVICE_URL') || 'http://localhost:3005';
  
  const response = await fetch(`${serviceUrl}/research`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SERVICE_AUTH_TOKEN') || 'dev-token'}`,
    },
    body: JSON.stringify({
      user_id: userId,
      agent_id: `${domain}_ai`,
      domain,
      query,
      input_context: context || {},
      country: country || 'RW',
    }),
  });

  if (!response.ok) {
    throw new Error(`Deep Research API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Deep Search Jobs Tool
 */
export async function deepSearchJobs(
  supabase: SupabaseClient,
  params: DeepSearchParams,
  userId?: string
): Promise<any> {
  const { query, country = 'RW', context = {} } = params;

  const { data: internalJobs } = await supabase
    .from('job_listings')
    .select('id, title, company, location, salary_range, description')
    .eq('status', 'active')
    .limit(10);

  const { data: sources } = await supabase.rpc('get_job_sources_for_deep_search', {
    p_country: country,
    p_category: context.category || null,
    p_limit: 5,
  });

  let webResults = null;
  try {
    webResults = await callDeepResearchService('jobs', query, userId, country, {
      ...context,
      target_sources: (sources || []).map((s: SearchSource) => s.url),
    });
  } catch (error) {
    console.error('Deep Search error:', error);
  }

  return {
    internal_count: internalJobs?.length || 0,
    internal_jobs: internalJobs || [],
    web_search_summary: webResults?.summary || 'Web search unavailable',
    total_results: (internalJobs?.length || 0) + (webResults?.matched_count || 0),
  };
}

/**
 * Deep Search Real Estate Tool
 */
export async function deepSearchRealEstate(
  supabase: SupabaseClient,
  params: DeepSearchParams,
  userId?: string
): Promise<any> {
  const { query, country = 'RW', context = {} } = params;

  const { data: internalProperties } = await supabase
    .from('properties')
    .select('id, title, price, location, bedrooms, property_type, description')
    .eq('status', 'active')
    .limit(10);

  const { data: sources } = await supabase.rpc('get_real_estate_sources_for_deep_search', {
    p_country: country,
    p_area: context.location || null,
    p_property_type: context.property_type || null,
    p_limit: 5,
  });

  let webResults = null;
  try {
    webResults = await callDeepResearchService('real_estate', query, userId, country, {
      ...context,
      target_sources: (sources || []).map((s: SearchSource) => s.url),
    });
  } catch (error) {
    console.error('Deep Search error:', error);
  }

  return {
    internal_count: internalProperties?.length || 0,
    internal_properties: internalProperties || [],
    web_search_summary: webResults?.summary || 'Web search unavailable',
    total_results: (internalProperties?.length || 0) + (webResults?.matched_count || 0),
  };
}

/**
 * Gemini Tool Definitions
 */
export const deepSearchToolDefinitions = [
  {
    name: 'deep_search_jobs',
    description: 'Search jobs from internal DB and web via Deep Research API',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Job search query' },
        country: { type: 'string', default: 'RW' },
        context: {
          type: 'object',
          properties: {
            category: { type: 'string' },
            min_salary: { type: 'number' },
            location: { type: 'string' },
          },
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'deep_search_real_estate',
    description: 'Search properties from internal DB and web via Deep Research API',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Property search query' },
        country: { type: 'string', default: 'RW' },
        context: {
          type: 'object',
          properties: {
            location: { type: 'string' },
            property_type: { type: 'string' },
            max_price: { type: 'number' },
            bedrooms: { type: 'integer' },
          },
        },
      },
      required: ['query'],
    },
  },
];
