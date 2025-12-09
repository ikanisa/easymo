/**
 * job-board-ai-agent - AI-powered Job Board Agent
 * 
 * Handles job searching, posting, applications, and matching via WhatsApp.
 * Uses OpenAI function calling for intelligent job matching.
 * 
 * Features:
 * - GPT-4 with function calling for job search and posting
 * - Location-based job search
 * - Skills matching between jobs and seekers
 * - Application tracking
 * - Database-driven configuration
 * 
 * @see docs/GROUND_RULES.md for observability requirements
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4.24.1";

import { logStructuredEvent } from "../_shared/observability.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY") ?? "",
});

// =====================================================================
// TOOL DEFINITIONS FOR FUNCTION CALLING
// =====================================================================

const JOB_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_jobs",
      description: "Search for job listings by keyword, location, type, or salary range. Use when user is looking for work.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search keywords for job title or description (e.g., 'driver', 'construction', 'delivery')"
          },
          location: {
            type: "string",
            description: "City or area name (e.g., 'Kigali', 'Remera')"
          },
          job_type: {
            type: "string",
            enum: ["full_time", "part_time", "contract", "daily", "temporary"],
            description: "Type of employment"
          },
          category: {
            type: "string",
            enum: ["transport", "construction", "domestic", "retail", "hospitality", "delivery", "tech", "agriculture", "other"],
            description: "Job category"
          },
          salary_min: {
            type: "number",
            description: "Minimum daily/monthly pay in RWF"
          },
          skills: {
            type: "array",
            items: { type: "string" },
            description: "Required skills to filter by"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_job_details",
      description: "Get full details for a specific job listing including requirements and how to apply",
      parameters: {
        type: "object",
        properties: {
          job_id: {
            type: "string",
            description: "The job ID to get details for"
          }
        },
        required: ["job_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_job_listing",
      description: "Create a new job posting. Use when employer wants to hire/post a job.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Job title (e.g., 'Delivery Driver', 'House Cleaner')"
          },
          description: {
            type: "string",
            description: "Full job description and requirements"
          },
          location: {
            type: "string",
            description: "Where the work will be done"
          },
          category: {
            type: "string",
            enum: ["transport", "construction", "domestic", "retail", "hospitality", "delivery", "tech", "agriculture", "other"],
            description: "Job category"
          },
          job_type: {
            type: "string",
            enum: ["full_time", "part_time", "contract", "daily", "temporary"],
            description: "Type of employment"
          },
          pay_min: {
            type: "number",
            description: "Minimum pay in RWF"
          },
          pay_max: {
            type: "number",
            description: "Maximum pay in RWF"
          },
          pay_type: {
            type: "string",
            enum: ["hourly", "daily", "weekly", "monthly"],
            description: "How pay is calculated"
          },
          skills_required: {
            type: "array",
            items: { type: "string" },
            description: "Skills needed for this job"
          },
          start_date: {
            type: "string",
            description: "When work should start (immediate, specific date)"
          }
        },
        required: ["title", "location"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "apply_to_job",
      description: "Submit application for a job on behalf of the user",
      parameters: {
        type: "object",
        properties: {
          job_id: {
            type: "string",
            description: "Job ID to apply for"
          },
          message: {
            type: "string",
            description: "Cover message or introduction from applicant"
          }
        },
        required: ["job_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_my_applications",
      description: "Get list of jobs the user has applied to with status updates",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["all", "pending", "accepted", "rejected"],
            description: "Filter by application status"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_my_job_postings",
      description: "Get jobs posted by this user (for employers)",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["all", "active", "filled", "expired"],
            description: "Filter by job status"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_seeker_profile",
      description: "Create or update job seeker profile with skills and preferences",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Seeker's name"
          },
          skills: {
            type: "array",
            items: { type: "string" },
            description: "List of skills"
          },
          experience_years: {
            type: "number",
            description: "Years of experience"
          },
          preferred_job_types: {
            type: "array",
            items: { type: "string" },
            description: "Types of work interested in"
          },
          available_days: {
            type: "array",
            items: { type: "string" },
            description: "Days available to work"
          },
          has_vehicle: {
            type: "boolean",
            description: "Has own vehicle/motorcycle for transport jobs"
          }
        }
      }
    }
  }
];

// =====================================================================
// TOOL EXECUTION HANDLERS
// =====================================================================

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

async function executeSearchJobs(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    let query = supabase
      .from("job_listings")
      .select(`
        id, title, description, location, category, job_type,
        pay_min, pay_max, pay_type, currency, skills_required,
        posted_by, status, created_at, expires_at
      `)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString());

    if (args.query) {
      const q = args.query as string;
      query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
    }

    if (args.location) {
      query = query.ilike("location", `%${args.location}%`);
    }

    if (args.job_type) {
      query = query.eq("job_type", args.job_type);
    }

    if (args.category) {
      query = query.eq("category", args.category);
    }

    if (args.salary_min) {
      query = query.gte("pay_min", args.salary_min);
    }

    const { data: jobs, error } = await query
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      await logStructuredEvent("JOB_SEARCH_ERROR", { error: error.message }, "error");
      return { success: false, error: error.message };
    }

    // Format for display
    const formatted = jobs?.map(j => ({
      id: j.id,
      title: j.title,
      location: j.location,
      category: j.category,
      type: j.job_type,
      pay: j.pay_min && j.pay_max 
        ? `${j.pay_min.toLocaleString()}-${j.pay_max.toLocaleString()} ${j.currency || 'RWF'}/${j.pay_type || 'month'}`
        : j.pay_min
          ? `${j.pay_min.toLocaleString()}+ ${j.currency || 'RWF'}/${j.pay_type || 'month'}`
          : "Negotiable",
      skills: j.skills_required?.slice(0, 5) || [],
      posted: new Date(j.created_at).toLocaleDateString()
    })) || [];

    await logStructuredEvent("JOB_SEARCH_SUCCESS", { count: formatted.length, filters: args });

    return {
      success: true,
      data: {
        count: formatted.length,
        jobs: formatted,
        message: formatted.length > 0
          ? `Found ${formatted.length} jobs matching your search`
          : "No jobs found matching your criteria. Try adjusting your search."
      }
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Search failed" };
  }
}

async function executeGetJobDetails(args: Record<string, unknown>): Promise<ToolResult> {
  const jobId = args.job_id as string;

  const { data: job, error } = await supabase
    .from("job_listings")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error || !job) {
    return { success: false, error: "Job not found" };
  }

  return {
    success: true,
    data: {
      ...job,
      formatted_pay: job.pay_min && job.pay_max
        ? `${job.pay_min.toLocaleString()}-${job.pay_max.toLocaleString()} ${job.currency || 'RWF'}/${job.pay_type || 'month'}`
        : "Negotiable",
      is_active: job.status === "active" && new Date(job.expires_at) > new Date()
    }
  };
}

async function executeCreateJobListing(args: Record<string, unknown>, userPhone: string): Promise<ToolResult> {
  const { data: job, error } = await supabase
    .from("job_listings")
    .insert({
      title: args.title as string,
      description: args.description as string || null,
      location: args.location as string,
      category: args.category as string || "other",
      job_type: args.job_type as string || "temporary",
      pay_min: args.pay_min as number || null,
      pay_max: args.pay_max as number || null,
      pay_type: args.pay_type as string || "daily",
      currency: "RWF",
      skills_required: args.skills_required as string[] || [],
      posted_by: userPhone,
      status: "active",
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      created_at: new Date().toISOString()
    })
    .select("id, title")
    .single();

  if (error) {
    await logStructuredEvent("JOB_CREATE_ERROR", { error: error.message }, "error");
    return { success: false, error: "Failed to create job listing" };
  }

  await logStructuredEvent("JOB_CREATED", { jobId: job?.id, title: args.title });

  return {
    success: true,
    data: {
      job_id: job?.id,
      title: job?.title,
      message: `Job "${job?.title}" posted successfully! Job seekers can now apply. I'll notify you when someone expresses interest.`
    }
  };
}

async function executeApplyToJob(args: Record<string, unknown>, userPhone: string): Promise<ToolResult> {
  const jobId = args.job_id as string;

  // Check if job exists and is active
  const { data: job, error: jobError } = await supabase
    .from("job_listings")
    .select("id, title, posted_by")
    .eq("id", jobId)
    .eq("status", "active")
    .single();

  if (jobError || !job) {
    return { success: false, error: "Job not found or no longer available" };
  }

  // Get or create seeker profile
  let { data: seeker } = await supabase
    .from("job_seekers")
    .select("id")
    .eq("phone_number", userPhone)
    .single();

  if (!seeker) {
    const { data: newSeeker, error: createError } = await supabase
      .from("job_seekers")
      .insert({
        phone_number: userPhone,
        created_at: new Date().toISOString()
      })
      .select("id")
      .single();

    if (createError) {
      return { success: false, error: "Failed to create profile" };
    }
    seeker = newSeeker;
  }

  // Check for existing application
  const { data: existing } = await supabase
    .from("job_applications")
    .select("id")
    .eq("job_id", jobId)
    .eq("seeker_id", seeker?.id)
    .single();

  if (existing) {
    return {
      success: true,
      data: {
        message: "You've already applied to this job. We'll notify you when the employer responds."
      }
    };
  }

  // Create application
  const { data: application, error } = await supabase
    .from("job_applications")
    .insert({
      job_id: jobId,
      seeker_id: seeker?.id,
      message: args.message as string || null,
      status: "pending",
      created_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (error) {
    await logStructuredEvent("JOB_APPLICATION_ERROR", { error: error.message }, "error");
    return { success: false, error: "Failed to submit application" };
  }

  await logStructuredEvent("JOB_APPLICATION_CREATED", { 
    applicationId: application?.id,
    jobId,
    jobTitle: job.title
  });

  return {
    success: true,
    data: {
      application_id: application?.id,
      job_title: job.title,
      message: `Applied to "${job.title}" successfully! The employer will be notified and can contact you directly.`
    }
  };
}

async function executeGetMyApplications(args: Record<string, unknown>, userPhone: string): Promise<ToolResult> {
  // Get seeker ID
  const { data: seeker } = await supabase
    .from("job_seekers")
    .select("id")
    .eq("phone_number", userPhone)
    .single();

  if (!seeker) {
    return {
      success: true,
      data: {
        count: 0,
        applications: [],
        message: "You haven't applied to any jobs yet. Would you like me to help you find work?"
      }
    };
  }

  let query = supabase
    .from("job_applications")
    .select(`
      id, status, message, created_at,
      job_listings (id, title, location, pay_min, pay_max, currency, pay_type)
    `)
    .eq("seeker_id", seeker.id);

  if (args.status && args.status !== "all") {
    query = query.eq("status", args.status);
  }

  const { data: applications, error } = await query
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    return { success: false, error: error.message };
  }

  interface JobData {
    title?: string;
    location?: string;
    pay_min?: number;
    pay_max?: number;
    currency?: string;
    pay_type?: string;
  }

  const formatted = applications?.map(app => {
    const job = (app.job_listings || {}) as JobData;
    return {
      application_id: app.id,
      job_title: job.title || "Unknown",
      job_location: job.location || "Unknown",
      pay: job.pay_min && job.pay_max
        ? `${job.pay_min.toLocaleString()}-${job.pay_max.toLocaleString()} RWF`
        : "Negotiable",
      status: app.status,
      applied_date: new Date(app.created_at).toLocaleDateString()
    };
  }) || [];

  return {
    success: true,
    data: {
      count: formatted.length,
      applications: formatted,
      message: formatted.length > 0
        ? `You have ${formatted.length} job applications`
        : "No applications found"
    }
  };
}

async function executeGetMyJobPostings(args: Record<string, unknown>, userPhone: string): Promise<ToolResult> {
  let query = supabase
    .from("job_listings")
    .select(`
      id, title, location, status, pay_min, pay_max, currency, pay_type, created_at,
      job_applications (count)
    `)
    .eq("posted_by", userPhone);

  if (args.status && args.status !== "all") {
    query = query.eq("status", args.status);
  }

  const { data: jobs, error } = await query
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    return { success: false, error: error.message };
  }

  const formatted = jobs?.map(j => ({
    job_id: j.id,
    title: j.title,
    location: j.location,
    status: j.status,
    pay: j.pay_min && j.pay_max
      ? `${j.pay_min.toLocaleString()}-${j.pay_max.toLocaleString()} RWF`
      : "Negotiable",
    applicants: (j.job_applications as unknown as Array<Record<string, number>>)?.[0]?.count || 0,
    posted_date: new Date(j.created_at).toLocaleDateString()
  })) || [];

  return {
    success: true,
    data: {
      count: formatted.length,
      jobs: formatted,
      message: formatted.length > 0
        ? `You have ${formatted.length} job postings`
        : "You haven't posted any jobs yet"
    }
  };
}

async function executeUpdateSeekerProfile(args: Record<string, unknown>, userPhone: string): Promise<ToolResult> {
  const updateData: Record<string, unknown> = {
    phone_number: userPhone,
    updated_at: new Date().toISOString()
  };

  if (args.name) updateData.name = args.name;
  if (args.skills) updateData.skills = args.skills;
  if (args.experience_years) updateData.experience_years = args.experience_years;
  if (args.preferred_job_types) updateData.preferred_job_types = args.preferred_job_types;
  if (args.available_days) updateData.available_days = args.available_days;
  if (args.has_vehicle !== undefined) updateData.has_vehicle = args.has_vehicle;

  const { data, error } = await supabase
    .from("job_seekers")
    .upsert(updateData, { onConflict: "phone_number" })
    .select("id")
    .single();

  if (error) {
    await logStructuredEvent("SEEKER_PROFILE_ERROR", { error: error.message }, "error");
    return { success: false, error: "Failed to update profile" };
  }

  return {
    success: true,
    data: {
      profile_id: data?.id,
      message: "Profile updated! This helps me find better job matches for you."
    }
  };
}

// =====================================================================
// MAIN HANDLER
// =====================================================================

interface JobAgentRequest {
  phone_number: string;
  message: string;
  language?: string;
  conversation_history?: Array<{ role: string; content: string }>;
}

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-correlation-id",
  };
  const correlationId = req.headers.get("x-correlation-id") ?? crypto.randomUUID();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Health check
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ 
        status: "healthy", 
        service: "job-board-ai-agent",
        version: "1.0.0",
        features: ["function_calling", "job_search", "job_posting", "applications"]
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body: JobAgentRequest = await req.json();
    const { phone_number, message, conversation_history } = body;

    await logStructuredEvent("JOB_AGENT_REQUEST", {
      phone: phone_number?.slice(-4) || "unknown",
      messageLength: message?.length || 0,
      correlationId
    });

    // Load agent config from database
    const { data: agentConfig } = await supabase
      .from("ai_agents")
      .select(`
        *,
        ai_agent_personas (*),
        ai_agent_system_instructions (*)
      `)
      .eq("slug", "jobs")
      .eq("is_active", true)
      .single();

    const dbInstructions = agentConfig?.ai_agent_system_instructions?.[0]?.instructions;
    const dbPersona = agentConfig?.ai_agent_personas?.[0];

    // Build system prompt
    let systemPrompt = dbInstructions || `You are easyMO's Jobs AI Agent - helping job seekers find work and employers find talent via WhatsApp.

YOUR ROLE:
- Help job seekers find relevant opportunities
- Help employers post jobs and manage listings
- Match candidates with jobs based on skills
- Track applications and statuses

JOB SEEKER WORKFLOW:
1. Understand their skills and preferences
2. Search for matching jobs
3. Help them apply
4. Track application status

EMPLOYER WORKFLOW:
1. Help create job postings
2. Show applicants for their jobs
3. Facilitate contact with candidates

CAPABILITIES:
- search_jobs: Find jobs by keyword, location, type
- get_job_details: Full job description
- create_job_listing: Post a new job
- apply_to_job: Submit application
- get_my_applications: View application statuses
- get_my_job_postings: View posted jobs
- update_seeker_profile: Update skills and preferences

Be encouraging and helpful. Use simple language. Keep responses concise for WhatsApp.`;

    if (dbPersona) {
      systemPrompt = `Role: ${dbPersona.role_name || 'Career Assistant'}
Tone: ${dbPersona.tone_style || 'Encouraging, professional, supportive'}

${systemPrompt}`;
    }

    // Build messages
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt }
    ];

    // Add conversation history
    if (conversation_history && conversation_history.length > 0) {
      for (const msg of conversation_history.slice(-6)) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    messages.push({ role: "user", content: message });

    // Call OpenAI with function calling
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      tools: JOB_TOOLS,
      tool_choice: "auto",
      max_tokens: 600, // Optimized for WhatsApp conciseness
      temperature: 0.7,
    });

    const assistantMessage = response.choices[0]?.message;
    const toolCalls = assistantMessage?.tool_calls;
    const toolsUsed: string[] = [];
    const toolResults: Record<string, unknown> = {};

    // Execute tool calls
    if (toolCalls && toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        const toolName = toolCall.function.name;
        toolsUsed.push(toolName);

        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          await logStructuredEvent("JOB_TOOL_PARSE_ERROR", { toolName }, "warn");
        }

        await logStructuredEvent("JOB_TOOL_CALL", { toolName, args, correlationId });

        let result: ToolResult;
        switch (toolName) {
          case "search_jobs":
            result = await executeSearchJobs(args);
            break;
          case "get_job_details":
            result = await executeGetJobDetails(args);
            break;
          case "create_job_listing":
            result = await executeCreateJobListing(args, phone_number);
            break;
          case "apply_to_job":
            result = await executeApplyToJob(args, phone_number);
            break;
          case "get_my_applications":
            result = await executeGetMyApplications(args, phone_number);
            break;
          case "get_my_job_postings":
            result = await executeGetMyJobPostings(args, phone_number);
            break;
          case "update_seeker_profile":
            result = await executeUpdateSeekerProfile(args, phone_number);
            break;
          default:
            result = { success: false, error: `Unknown tool: ${toolName}` };
        }

        toolResults[toolName] = result;
      }

      // Get final response with tool results
      messages.push(assistantMessage as OpenAI.Chat.Completions.ChatCompletionMessageParam);

      for (const toolCall of toolCalls) {
        const result = toolResults[toolCall.function.name];
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }

      const finalResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        max_tokens: 800,
        temperature: 0.7,
      });

      const finalMessage = finalResponse.choices[0]?.message?.content ||
        "I've processed your request. Let me know if you need anything else!";

      await logStructuredEvent("JOB_AGENT_RESPONSE", {
        toolsUsed,
        correlationId
      });

      return new Response(
        JSON.stringify({
          message: finalMessage,
          tool_calls: toolsUsed,
          results: toolResults
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No tool calls - direct response
    const directMessage = assistantMessage?.content ||
      "I'm here to help you find work or hire someone. What do you need?";

    return new Response(
      JSON.stringify({
        message: directMessage,
        tool_calls: []
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    await logStructuredEvent("JOB_AGENT_ERROR", {
      error: error instanceof Error ? error.message : String(error),
      correlationId
    }, "error");

    return new Response(
      JSON.stringify({
        error: "Job agent error",
        message: "Sorry, I encountered an issue. Please try again."
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
