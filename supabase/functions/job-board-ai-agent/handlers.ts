// =====================================================
// JOB BOARD AI AGENT - Tool Handlers
// =====================================================

import OpenAI from "openai";
import { SupabaseClient } from "@supabase/supabase-js";
import { JOB_EXTRACTION_PROMPT, SEEKER_EXTRACTION_PROMPT } from "./prompts.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import {
  requireEmbedding,
  requireFirstMessageContent,
} from "../_shared/openaiGuard.ts";

// =====================================================
// Helper: Generate Embeddings
// =====================================================

export async function generateEmbedding(
  openai: OpenAI,
  text: string
): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return requireEmbedding(response, "Job board embedding");
}

// =====================================================
// Helper: Parse Relative Dates
// =====================================================

function parseRelativeDate(dateStr: string): Date | null {
  const now = new Date();
  const lower = dateStr.toLowerCase();
  
  if (lower.includes("today")) {
    return now;
  } else if (lower.includes("tomorrow")) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  } else if (lower.match(/in (\d+) days?/)) {
    const days = parseInt(lower.match(/in (\d+) days?/)![1]);
    const future = new Date(now);
    future.setDate(future.getDate() + days);
    return future;
  } else if (lower.includes("next week")) {
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek;
  }
  
  try {
    return new Date(dateStr);
  } catch {
    return null;
  }
}

// =====================================================
// Tool Handlers
// =====================================================

export async function handleExtractJobMetadata(
  args: any,
  openai: OpenAI
): Promise<any> {
  const prompt = JOB_EXTRACTION_PROMPT.replace("{{USER_INPUT}}", args.user_input);
  
  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: "You are a job metadata extraction system. Return only valid JSON."
      },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });
  
  const extracted = JSON.parse(
    requireFirstMessageContent(response, "Job metadata extraction") || "{}"
  );
  
  return {
    success: true,
    metadata: extracted,
    message: "Job metadata extracted successfully"
  };
}

export async function handlePostJob(
  args: any,
  supabase: SupabaseClient,
  openai: OpenAI,
  phoneNumber: string
): Promise<any> {
  const correlationId = crypto.randomUUID();
  
  try {
    // Generate embedding for job skills
    const jobText = `
      ${args.title}
      ${args.description}
      ${args.category}
      Required skills: ${args.required_skills?.join(", ") || ""}
      Location: ${args.location}
      Pay: ${args.pay_min || ""}-${args.pay_max || ""} ${args.pay_type || ""}
    `.trim();
    
    const embedding = await generateEmbedding(openai, jobText);
    
    // Parse start date
    const startDate = args.start_date ? parseRelativeDate(args.start_date) : null;
    
    // Calculate expiration
    const expiresInDays = args.expires_in_days || (args.job_type === "gig" ? 7 : 30);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    
    // Insert job listing
    const { data: job, error } = await supabase
      .from("job_listings")
      .insert({
        posted_by: phoneNumber,
        title: args.title,
        description: args.description,
        job_type: args.job_type,
        category: args.category,
        location: args.location,
        location_details: args.location_details,
        pay_min: args.pay_min,
        pay_max: args.pay_max,
        pay_type: args.pay_type || "negotiable",
        duration: args.duration,
        start_date: startDate?.toISOString(),
        flexible_hours: args.flexible_hours || false,
        required_skills: args.required_skills || [],
        required_skills_embedding: embedding,
        experience_level: args.experience_level || "any",
        physical_demands: args.physical_demands,
        tools_needed: args.tools_needed,
        transport_provided: args.transport_provided || false,
        team_size: args.team_size,
        weather_dependent: args.weather_dependent || false,
        contact_phone: phoneNumber,
        status: "open",
        expires_at: expiresAt.toISOString(),
        metadata: {
          source: "whatsapp_ai",
          ai_extracted: true
        }
      })
      .select()
      .single();
    
    if (error) throw error;
    
    await logStructuredEvent("JOB_POSTED", {
      jobId: job.id,
      phoneNumber,
      category: args.category,
      jobType: args.job_type,
      correlationId
    });
    
    // Find and create automatic matches
    await createAutomaticMatches(supabase, openai, job.id, embedding, correlationId);
    
    return {
      success: true,
      job_id: job.id,
      message: `Job posted successfully! ID: ${job.id}. I'll notify matching job seekers.`,
      job: {
        title: job.title,
        category: job.category,
        location: job.location,
        expires_at: job.expires_at
      }
    };
    
  } catch (error: any) {
    await logStructuredEvent("ERROR", {
      event: "JOB_POST_FAILED",
      error: error.message,
      phoneNumber,
      correlationId
    });
    
    return {
      success: false,
      error: error.message
    };
  }
}

async function createAutomaticMatches(
  supabase: SupabaseClient,
  openai: OpenAI,
  jobId: string,
  jobEmbedding: number[],
  correlationId: string
): Promise<void> {
  try {
    // Find matching seekers using vector similarity
    const { data: matches } = await supabase.rpc("match_seekers_for_job", {
      query_embedding: jobEmbedding,
      match_threshold: 0.7,
      match_count: 20
    });
    
    if (!matches || matches.length === 0) return;
    
    // Create match records
    const matchInserts = matches.map((seeker: any) => ({
      job_id: jobId,
      seeker_id: seeker.id,
      similarity_score: seeker.similarity_score,
      match_type: "automatic",
      status: "suggested",
      match_reasons: {
        skills_match: seeker.similarity_score,
        auto_matched: true
      }
    }));
    
    await supabase.from("job_matches").insert(matchInserts);
    
    await logStructuredEvent("MATCHES_CREATED", {
      jobId,
      matchCount: matches.length,
      correlationId
    });
    
  } catch (error) {
    console.error("Auto-match error:", error);
  }
}

export async function handleSearchJobs(
  args: any,
  supabase: SupabaseClient,
  openai: OpenAI,
  phoneNumber: string
): Promise<any> {
  const correlationId = crypto.randomUUID();
  
  try {
    // Build skills_query if missing using seeker profile and user_memories
    let skillsQuery: string = String(args.skills_query || '').trim();
    if (!skillsQuery) {
      const parts: string[] = [];
      const { data: seeker } = await supabase
        .from('job_seekers')
        .select('skills, preferred_categories, preferred_job_types, preferred_locations, languages')
        .eq('phone_number', phoneNumber)
        .maybeSingle();
      if (Array.isArray(seeker?.skills) && seeker!.skills.length) parts.push(`skills: ${seeker!.skills.join(', ')}`);
      if (Array.isArray(seeker?.preferred_categories) && seeker!.preferred_categories.length) parts.push(`categories: ${seeker!.preferred_categories.join(', ')}`);
      if (Array.isArray(seeker?.preferred_job_types) && seeker!.preferred_job_types.length) parts.push(`types: ${seeker!.preferred_job_types.join(', ')}`);
      if (Array.isArray(seeker?.preferred_locations) && seeker!.preferred_locations.length) parts.push(`locations: ${seeker!.preferred_locations.join(', ')}`);
      if (Array.isArray(seeker?.languages) && seeker!.languages.length) parts.push(`languages: ${seeker!.languages.join(', ')}`);

      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('whatsapp_e164', phoneNumber)
        .maybeSingle();
      const userId = profile?.user_id as string | undefined;
      if (userId) {
        const { data: mems } = await supabase
          .from('user_memories')
          .select('mem_key, mem_value')
          .eq('user_id', userId)
          .eq('domain', 'job_board');
        for (const m of (mems || [])) {
          parts.push(`${m.mem_key}: ${JSON.stringify(m.mem_value)}`);
        }
      }
      skillsQuery = parts.join(' | ') || 'general worker; reliable; open to various gigs';
    }
    // Generate embedding from the constructed query
    const embedding = await generateEmbedding(openai, skillsQuery);
    
    // Search jobs using vector similarity
    const { data: jobs, error } = await supabase.rpc("match_jobs_for_seeker", {
      query_embedding: embedding,
      match_threshold: 0.65,
      match_count: args.max_results || 10,
      filter_job_types: args.job_types || null,
      filter_categories: args.categories || null,
      min_pay: args.min_pay || null
    });
    
    if (error) throw error;
    
    await logStructuredEvent("JOBS_SEARCHED", {
      phoneNumber,
      resultCount: jobs?.length || 0,
      correlationId
    });
    
    return {
      success: true,
      jobs: jobs || [],
      count: jobs?.length || 0,
      message: `Found ${jobs?.length || 0} matching jobs`
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

export async function handleUpdateSeekerProfile(
  args: any,
  supabase: SupabaseClient,
  openai: OpenAI,
  phoneNumber: string
): Promise<any> {
  const correlationId = crypto.randomUUID();
  
  try {
    // Generate bio embedding
    const bioText = `
      ${args.bio || ""}
      Skills: ${args.skills?.join(", ") || ""}
      Experience: ${args.experience_years || 0} years
      Looking for: ${args.preferred_job_types?.join(", ") || ""}
      Interests: ${args.preferred_categories?.join(", ") || ""}
    `.trim();
    
    const bioEmbedding = await generateEmbedding(openai, bioText);
    
    // Generate skills-specific embedding
    const skillsText = args.skills?.join(", ") || "";
    const skillsEmbedding = await generateEmbedding(openai, skillsText);
    
    // Upsert seeker profile
    const { data: seeker, error } = await supabase
      .from("job_seekers")
      .upsert({
        phone_number: phoneNumber,
        name: args.name,
        bio: args.bio,
        bio_embedding: bioEmbedding,
        skills: args.skills || [],
        skills_embedding: skillsEmbedding,
        experience_years: args.experience_years,
        certifications: args.certifications,
        languages: args.languages || ["English"],
        preferred_job_types: args.preferred_job_types,
        preferred_categories: args.preferred_categories,
        preferred_locations: args.preferred_locations,
        availability: args.availability || {},
        available_immediately: args.availability?.immediate !== false,
        min_pay: args.min_pay,
        profile_complete: true,
        last_active: new Date().toISOString(),
        metadata: {
          has_transportation: args.has_transportation,
          transportation_type: args.transportation_type
        }
      }, {
        onConflict: "phone_number"
      })
      .select()
      .single();
    
    if (error) throw error;
    
    await logStructuredEvent("SEEKER_PROFILE_UPDATED", {
      seekerId: seeker.id,
      phoneNumber,
      correlationId
    });

    // Persist preferences to user_memories if profile exists
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('whatsapp_e164', phoneNumber)
        .maybeSingle();
      const userId = profile?.user_id as string | undefined;
      if (userId) {
        const prefUpserts = [
          ['skills', { list: args.skills || [] }],
          ['job_types', { list: args.preferred_job_types || [] }],
          ['categories', { list: args.preferred_categories || [] }],
          ['locations', { list: args.preferred_locations || [] }],
          ['languages', { list: args.languages || [] }],
          ['availability', args.availability || {}],
          ['min_pay', { amount: args.min_pay || null }],
          ['transport', { has: !!args.has_transportation, type: args.transportation_type || null }],
        ] as Array<[string, any]>;
        for (const [key, value] of prefUpserts) {
          await supabase.from('user_memories').upsert({
            user_id: userId,
            domain: 'job_board',
            memory_type: 'preference',
            mem_key: key,
            mem_value: value,
            last_seen: new Date().toISOString(),
          }, { onConflict: 'user_id,domain,mem_key' });
        }
      }
    } catch (_) { /* ignore memory errors */ }
    
    // Find matching jobs
    const { data: jobs } = await supabase.rpc("match_jobs_for_seeker", {
      query_embedding: skillsEmbedding,
      match_threshold: 0.7,
      match_count: 5
    });
    
    return {
      success: true,
      seeker_id: seeker.id,
      message: "Profile updated successfully!",
      matching_jobs_count: jobs?.length || 0,
      matching_jobs: jobs?.slice(0, 3) || []
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

export async function handleExpressInterest(
  args: any,
  supabase: SupabaseClient,
  phoneNumber: string
): Promise<any> {
  const correlationId = crypto.randomUUID();
  
  try {
    // Get seeker ID
    const { data: seeker } = await supabase
      .from("job_seekers")
      .select("id")
      .eq("phone_number", phoneNumber)
      .single();
    
    if (!seeker) {
      return {
        success: false,
        error: "Please create your profile first by telling me about your skills."
      };
    }
    
    // Get job details
    const { data: job } = await supabase
      .from("job_listings")
      .select("*, posted_by")
      .eq("id", args.job_id)
      .single();
    
    if (!job) {
      return { success: false, error: "Job not found" };
    }
    
    // Create or update match
    const { error: matchError } = await supabase
      .from("job_matches")
      .upsert({
        job_id: args.job_id,
        seeker_id: seeker.id,
        seeker_interested: true,
        seeker_message: args.message,
        status: "contacted",
        contacted_at: new Date().toISOString(),
        match_type: "manual",
        similarity_score: 0.8
      }, {
        onConflict: "job_id,seeker_id"
      });
    
    if (matchError) throw matchError;
    
    // Create application
    await supabase.from("job_applications").insert({
      job_id: args.job_id,
      seeker_id: seeker.id,
      cover_message: args.message,
      proposed_rate: args.proposed_rate,
      status: "pending"
    });
    
    await logStructuredEvent("INTEREST_EXPRESSED", {
      jobId: args.job_id,
      seekerId: seeker.id,
      phoneNumber,
      correlationId
    });
    
    // TODO: Notify job poster via WhatsApp
    
    return {
      success: true,
      message: `Interest registered! The employer (${job.posted_by}) will be notified.`,
      job_title: job.title,
      poster_contact: job.contact_phone || job.posted_by
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

export async function handleViewApplicants(
  args: any,
  supabase: SupabaseClient,
  phoneNumber: string
): Promise<any> {
  try {
    // Verify job ownership
    const { data: job } = await supabase
      .from("job_listings")
      .select("id")
      .eq("id", args.job_id)
      .eq("posted_by", phoneNumber)
      .single();
    
    if (!job) {
      return {
        success: false,
        error: "Job not found or you don't have permission."
      };
    }
    
    // Get matches with seeker details
    const { data: matches } = await supabase
      .from("job_matches")
      .select(`
        *,
        job_seekers (
          name,
          phone_number,
          bio,
          skills,
          experience_years,
          rating,
          total_jobs_completed
        )
      `)
      .eq("job_id", args.job_id)
      .gte("similarity_score", args.min_match_score || 0.7)
      .order("similarity_score", { ascending: false });
    
    return {
      success: true,
      applicants: matches || [],
      count: matches?.length || 0
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

export async function handleGetMyJobs(
  args: any,
  supabase: SupabaseClient,
  phoneNumber: string
): Promise<any> {
  try {
    let query = supabase
      .from("job_listings")
      .select("*")
      .eq("posted_by", phoneNumber)
      .order("created_at", { ascending: false });
    
    if (args.status && args.status !== "all") {
      query = query.eq("status", args.status);
    }
    
    const { data: jobs } = await query;
    
    return {
      success: true,
      jobs: jobs || [],
      count: jobs?.length || 0
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

export async function handleGetMyApplications(
  args: any,
  supabase: SupabaseClient,
  phoneNumber: string
): Promise<any> {
  try {
    // Get seeker ID
    const { data: seeker } = await supabase
      .from("job_seekers")
      .select("id")
      .eq("phone_number", phoneNumber)
      .single();
    
    if (!seeker) {
      return {
        success: false,
        error: "No seeker profile found."
      };
    }
    
    let query = supabase
      .from("job_matches")
      .select(`
        *,
        job_listings (
          id,
          title,
          description,
          category,
          location,
          pay_min,
          pay_max,
          pay_type,
          status
        )
      `)
      .eq("seeker_id", seeker.id)
      .order("created_at", { ascending: false });
    
    if (args.status && args.status !== "all") {
      query = query.eq("status", args.status);
    }
    
    const { data: applications } = await query;
    
    return {
      success: true,
      applications: applications || [],
      count: applications?.length || 0
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

export async function handleUpdateJobStatus(
  args: any,
  supabase: SupabaseClient,
  phoneNumber: string
): Promise<any> {
  try {
    const updateData: any = {
      status: args.status,
      updated_at: new Date().toISOString()
    };
    
    if (args.status === "filled") {
      updateData.filled_at = new Date().toISOString();
    }
    
    const { error } = await supabase
      .from("job_listings")
      .update(updateData)
      .eq("id", args.job_id)
      .eq("posted_by", phoneNumber);
    
    if (error) throw error;
    
    return {
      success: true,
      message: `Job status updated to: ${args.status}`
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

export async function handleGetJobDetails(
  args: any,
  supabase: SupabaseClient
): Promise<any> {
  try {
    const { data: job } = await supabase
      .from("job_listings")
      .select("*")
      .eq("id", args.job_id)
      .single();
    
    if (!job) {
      return { success: false, error: "Job not found" };
    }
    
    return {
      success: true,
      job
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}
