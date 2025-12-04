/**
 * Jobs Matching Tool
 * Searches job_posts table and creates match events for AI agent
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface JobSearchParams {
  location?: string;
  category?: string;
  min_salary?: number;
  max_salary?: number;
  employment_type?: string;
  experience_level?: string;
  limit?: number;
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

export async function searchJobs(
  supabase: SupabaseClient,
  params: JobSearchParams,
  userId: string
): Promise<{ matches: JobMatch[]; total: number }> {
  try {
    // Build query
    let query = supabase
      .from("job_posts")
      .select("*", { count: "exact" })
      .eq("status", "active")
      .order("created_at", { ascending: false });

    // Apply filters
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
