/**
 * Jobs Matching Tool
 * Searches job_listings table with semantic matching and creates match events for AI agent
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface JobSearchParams {
  query?: string; // Natural language search query
  location?: string;
  category?: string;
  min_salary?: number;
  max_salary?: number;
  employment_type?: string;
  experience_level?: string;
  limit?: number;
  use_semantic_search?: boolean; // Enable semantic search with embeddings
}

export interface JobMatch {
  id: string;
  title: string;
  company: string;
  location: string;
  salary_range?: string;
  employment_type: string;
  description: string;
  posted_at: string;
  match_score: number;
}

/**
 * Generate embeddings using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  
  if (!openaiApiKey) {
    console.warn("OPENAI_API_KEY not set, falling back to traditional search");
    throw new Error("OpenAI API key not configured");
  }

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text,
        encoding_format: "float",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("OpenAI embedding error:", error);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error("Failed to generate embedding:", error);
    throw error;
  }
}

export async function searchJobs(
  supabase: SupabaseClient,
  params: JobSearchParams,
  userId: string
): Promise<{ matches: JobMatch[]; total: number }> {
  try {
    // Use semantic search if query provided and enabled
    if (params.query && params.use_semantic_search !== false) {
      return await semanticSearchJobs(supabase, params, userId);
    }

    // Fallback to traditional search
    return await traditionalSearchJobs(supabase, params, userId);
  } catch (error) {
    console.error("Job search error:", error);
    return { matches: [], total: 0 };
  }
}

/**
 * Semantic search using match_job_listings RPC with embeddings
 */
async function semanticSearchJobs(
  supabase: SupabaseClient,
  params: JobSearchParams,
  userId: string
): Promise<{ matches: JobMatch[]; total: number }> {
  try {
    // Build search query string from all parameters
    const searchTerms = [
      params.query,
      params.location && `in ${params.location}`,
      params.category,
    ].filter(Boolean).join(' ');

    console.log('Generating embedding for:', searchTerms);

    // Generate embedding for the search query
    const embedding = await generateEmbedding(searchTerms);

    // Call match_job_listings RPC with the embedding
    const { data, error } = await supabase.rpc('match_job_listings', {
      query_embedding: embedding,
      match_threshold: 0.6, // Lower threshold for more results
      match_count: params.limit || 10,
      filter: {},
    });

    if (error) {
      console.error("RPC match_job_listings error:", error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.log("No semantic matches found, trying traditional search");
      return await traditionalSearchJobs(supabase, params, userId);
    }

    // Apply additional filters
    let filteredJobs = data;

    if (params.min_salary) {
      filteredJobs = filteredJobs.filter((job: any) => 
        job.salary_min && job.salary_min >= params.min_salary!
      );
    }

    if (params.max_salary) {
      filteredJobs = filteredJobs.filter((job: any) => 
        job.salary_max && job.salary_max <= params.max_salary!
      );
    }

    if (params.employment_type) {
      filteredJobs = filteredJobs.filter((job: any) => 
        job.job_type === params.employment_type
      );
    }

    // Map to JobMatch format
    const matches: JobMatch[] = filteredJobs.map((job: any) => ({
      id: job.id,
      title: job.title,
      company: job.company || job.posted_by || "Company",
      location: job.location || "Not specified",
      salary_range: job.salary_min && job.salary_max
        ? `${job.salary_min} - ${job.salary_max} ${job.currency || "RWF"}`
        : undefined,
      employment_type: job.job_type || "Full-time",
      description: job.description?.substring(0, 200) || "",
      posted_at: job.created_at,
      match_score: job.similarity || 0,
    }));

    console.log(`Semantic search found ${matches.length} matches`);

    return {
      matches,
      total: matches.length,
    };
  } catch (error) {
    console.error("Semantic search error:", error);
    // Fallback to traditional search
    console.log("Falling back to traditional search");
    return await traditionalSearchJobs(supabase, params, userId);
  }
}

/**
 * Traditional keyword-based search
 */
async function traditionalSearchJobs(
  supabase: SupabaseClient,
  params: JobSearchParams,
  userId: string
): Promise<{ matches: JobMatch[]; total: number }> {
  try {
    // Build query
    let query = supabase
      .from("job_listings")
      .select("*", { count: "exact" })
      .eq("status", "active")
      .order("created_at", { ascending: false });

    // Apply filters
    if (params.query) {
      // Search in title and description
      query = query.or(`title.ilike.%${params.query}%,description.ilike.%${params.query}%`);
    }

    if (params.location) {
      query = query.ilike("location", `%${params.location}%`);
    }

    if (params.category) {
      query = query.eq("category", params.category);
    }

    if (params.min_salary) {
      query = query.gte("salary_min", params.min_salary);
    }

    if (params.max_salary) {
      query = query.lte("salary_max", params.max_salary);
    }

    if (params.employment_type) {
      query = query.eq("employment_type", params.employment_type);
    }

    if (params.experience_level) {
      query = query.eq("experience_level", params.experience_level);
    }

    // Limit results
    const limit = params.limit || 10;
    query = query.limit(limit);

    const { data: jobs, error, count } = await query;

    if (error) {
      console.error("Job search error:", error);
      return { matches: [], total: 0 };
    }

    // Calculate match scores based on criteria alignment
    const matches: JobMatch[] = (jobs || []).map((job) => {
      let matchScore = 0.5; // Base score

      // Boost score for location match
      if (params.location && job.location?.toLowerCase().includes(params.location.toLowerCase())) {
        matchScore += 0.2;
      }

      // Boost score for category match
      if (params.category && job.category === params.category) {
        matchScore += 0.2;
      }

      // Boost score for salary match
      if (params.min_salary && job.salary_min && job.salary_min >= params.min_salary) {
        matchScore += 0.1;
      }

      return {
        id: job.id,
        title: job.title,
        company: job.company_name || "Company",
        location: job.location || "Not specified",
        salary_range: job.salary_min && job.salary_max
          ? `${job.salary_min} - ${job.salary_max} ${job.currency || "RWF"}`
          : undefined,
        employment_type: job.employment_type || "Full-time",
        description: job.description?.substring(0, 200) || "",
        posted_at: job.created_at,
        match_score: Math.min(matchScore, 1.0),
      };
    });

    // Sort by match score
    matches.sort((a, b) => b.match_score - a.match_score);

    return {
      matches,
      total: count || 0,
    };
  } catch (error) {
    console.error("Job search exception:", error);
    return { matches: [], total: 0 };
  }
}

export async function createJobMatchEvents(
  supabase: SupabaseClient,
  userId: string,
  agentId: string,
  conversationId: string,
  matches: JobMatch[]
): Promise<void> {
  try {
    // Create match events for each job
    const matchEvents = matches.map((job) => ({
      user_id: userId,
      agent_id: agentId,
      conversation_id: conversationId,
      match_type: "job",
      entity_id: job.id,
      entity_type: "job_post",
      match_score: job.match_score,
      match_reason: `Job: ${job.title} at ${job.company}`,
      metadata: {
        title: job.title,
        company: job.company,
        location: job.location,
        salary_range: job.salary_range,
        employment_type: job.employment_type,
      },
      status: "pending",
    }));

    if (matchEvents.length > 0) {
      const { error } = await supabase
        .from("ai_agent_match_events")
        .insert(matchEvents);

      if (error) {
        console.error("Error creating job match events:", error);
      } else {
        console.log(`Created ${matchEvents.length} job match events`);
      }
    }
  } catch (error) {
    console.error("Exception creating job match events:", error);
  }
}

export function formatJobsForWhatsApp(matches: JobMatch[], limit: number = 5): string {
  if (matches.length === 0) {
    return "😔 No jobs found matching your criteria.\n\nTry adjusting your search or check back later!";
  }

  const topMatches = matches.slice(0, limit);
  let message = `🎯 Found ${matches.length} job${matches.length > 1 ? "s" : ""}!\n\n`;
  message += `Here are the top ${topMatches.length}:\n\n`;

  topMatches.forEach((job, index) => {
    message += `${index + 1}. *${job.title}*\n`;
    message += `   🏢 ${job.company}\n`;
    message += `   📍 ${job.location}\n`;
    if (job.salary_range) {
      message += `   💰 ${job.salary_range}\n`;
    }
    message += `   📋 ${job.employment_type}\n`;
    message += `   ⭐ Match: ${Math.round(job.match_score * 100)}%\n\n`;
  });

  if (matches.length > limit) {
    message += `_...and ${matches.length - limit} more matches!_\n\n`;
  }

  message += `Reply with a number to see details, or "apply" to start an application! 📝`;

  return message;
}
