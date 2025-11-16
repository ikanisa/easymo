// =====================================================
// JOB BOARD AI AGENT - WhatsApp Integration
// =====================================================
// Routes job board conversations to the AI agent
// Handles both job seekers and job posters
// Last updated: 2025-11-15
// =====================================================

import type { RouterContext } from "../../types.ts";
import { t } from "../../i18n/translator.ts";
import { sendListMessage } from "../../utils/reply.ts";
import { sendText } from "../../wa/client.ts";
import { logStructuredEvent } from "../../observe/log.ts";
import { setState, getState } from "../../state/store.ts";
import { IDS } from "../../wa/ids.ts";

// Helper function to send text messages
async function sendMessage(ctx: RouterContext, options: { text: string }): Promise<void> {
  await sendText(ctx.from, options.text);
}

interface JobConversation {
  conversationId: string;
  role: "job_seeker" | "job_poster" | "both";
  language: string;
  status: "active" | "completed";
}

/**
 * Show job board main menu
 */
export async function showJobBoardMenu(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  await logStructuredEvent("JOB_BOARD_MENU_SHOWN", {
    userId: ctx.profileId,
    language: ctx.locale,
  });

  const rows = [
    {
      id: IDS.JOB_FIND,
      title: t(ctx.locale, "jobs.menu.find.title"),
      description: t(ctx.locale, "jobs.menu.find.description"),
    },
    {
      id: IDS.JOB_POST,
      title: t(ctx.locale, "jobs.menu.post.title"),
      description: t(ctx.locale, "jobs.menu.post.description"),
    },
    {
      id: IDS.JOB_MY_APPLICATIONS,
      title: t(ctx.locale, "jobs.menu.myApplications.title"),
      description: t(ctx.locale, "jobs.menu.myApplications.description"),
    },
    {
      id: IDS.JOB_MY_JOBS,
      title: t(ctx.locale, "jobs.menu.myJobs.title"),
      description: t(ctx.locale, "jobs.menu.myJobs.description"),
    },
  ];

  const header = t(ctx.locale, "jobs.menu.title");
  const greeting = t(ctx.locale, "jobs.menu.greeting");

  await sendListMessage(ctx, {
    title: header,
    body: greeting,
    sectionTitle: t(ctx.locale, "jobs.menu.section"),
    rows,
    buttonText: t(ctx.locale, "jobs.menu.button"),
  });

  await setState(ctx.supabase, ctx.profileId, {
    key: "job_board_menu",
    data: { timestamp: new Date().toISOString() },
  });

  return true;
}

/**
 * Start job search conversation (job seeker)
 */
export async function startJobSearch(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  await logStructuredEvent("JOB_SEARCH_START", {
    userId: ctx.profileId,
    language: ctx.locale,
  });

  // Set state for AI agent conversation
  await setState(ctx.supabase, ctx.profileId, {
    key: "job_conversation",
    data: {
      conversationId: crypto.randomUUID(),
      role: "job_seeker",
      language: ctx.locale,
      status: "active",
      startedAt: new Date().toISOString(),
    },
  });

  // Send welcome message
  await sendMessage(ctx, {
    text: t(ctx.locale, "jobs.seeker.welcome"),
  });

  return true;
}

/**
 * Start job posting conversation (job poster)
 */
export async function startJobPosting(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  await logStructuredEvent("JOB_POST_START", {
    userId: ctx.profileId,
    language: ctx.locale,
  });

  // Set state for AI agent conversation
  await setState(ctx.supabase, ctx.profileId, {
    key: "job_conversation",
    data: {
      conversationId: crypto.randomUUID(),
      role: "job_poster",
      language: ctx.locale,
      status: "active",
      startedAt: new Date().toISOString(),
    },
  });

  // Send welcome message
  await sendMessage(ctx, {
    text: t(ctx.locale, "jobs.poster.welcome"),
  });

  return true;
}

/**
 * Handle ongoing job board conversation
 * Routes user messages to the job-board-ai-agent edge function
 */
export async function handleJobBoardText(
  ctx: RouterContext,
  messageText: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const state = await getState(ctx.supabase, ctx.profileId);
  if (!state || state.key !== "job_conversation") {
    return false;
  }

  const conversationData = (state.data || {}) as Partial<JobConversation> & { startedAt?: string };

  await logStructuredEvent("JOB_AGENT_MESSAGE", {
    userId: ctx.profileId,
    role: conversationData.role || "unknown",
    messageLength: messageText.length,
  });

  try {
    // Call job-board-ai-agent edge function
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/job-board-ai-agent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "x-correlation-id": crypto.randomUUID(),
        },
        body: JSON.stringify({
          phone_number: ctx.from,
          message: messageText,
          language: ctx.locale,
          role: conversationData.role,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Job agent error:", errorText);
      
      await sendMessage(ctx, {
        text: t(ctx.locale, "jobs.error.agent_failed"),
      });
      
      return true;
    }

    const data = await response.json();

    // Send agent's response
    if (data.message) {
      await sendMessage(ctx, {
        text: data.message,
      });
    }

    // Log tool calls if any
    if (data.tool_calls && data.tool_calls.length > 0) {
      await logStructuredEvent("JOB_AGENT_TOOLS", {
        userId: ctx.profileId,
        toolCount: data.tool_calls.length,
        tools: data.tool_calls.map((tc: any) => tc.name),
      });
    }

    return true;
  } catch (error: any) {
    console.error("Job board agent error:", error);
    
    await sendMessage(ctx, {
      text: t(ctx.locale, "jobs.error.something_wrong"),
    });
    
    return true;
  }
}

/**
 * Show user's job applications
 */
export async function showMyApplications(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  await logStructuredEvent("JOB_APPLICATIONS_VIEW", {
    userId: ctx.profileId,
  });

  try {
    // First, get the job_seeker record using phone number
    const { data: seeker, error: seekerError } = await ctx.supabase
      .from("job_seekers")
      .select("id")
      .eq("phone_number", ctx.from)
      .maybeSingle();

    if (seekerError) throw seekerError;

    if (!seeker) {
      await sendMessage(ctx, {
        text: t(ctx.locale, "jobs.applications.no_profile"),
      });
      return true;
    }

    // Query job_applications table using the seeker's id
    const { data: applications, error } = await ctx.supabase
      .from("job_applications")
      .select(`
        id,
        status,
        created_at,
        job_listings (
          id,
          title,
          location,
          pay_min,
          pay_max,
          pay_type,
          currency,
          job_type
        )
      `)
      .eq("seeker_id", seeker.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw error;

    if (!applications || applications.length === 0) {
      await sendMessage(ctx, {
        text: t(ctx.locale, "jobs.applications.none"),
      });
      return true;
    }

    // Format applications list
    let message = t(ctx.locale, "jobs.applications.header") + "\n\n";

    applications.forEach((app: any, index: number) => {
      const job = app.job_listings;
      const payInfo = job.pay_min && job.pay_max
        ? `${job.currency || "RWF"} ${job.pay_min}-${job.pay_max}/${job.pay_type}`
        : t(ctx.locale, "jobs.pay.negotiable");

      message += `${index + 1}. *${job.title}*\n`;
      message += `   📍 ${job.location}\n`;
      message += `   💰 ${payInfo}\n`;
      message += `   📋 ${t(ctx.locale, `jobs.type.${job.job_type}`)}\n`;
      message += `   Status: ${t(ctx.locale, `jobs.status.${app.status}`)}\n\n`;
    });

    message += t(ctx.locale, "jobs.applications.footer");

    await sendMessage(ctx, { text: message });

    return true;
  } catch (error: any) {
    console.error("Error fetching applications:", error);
    await sendMessage(ctx, {
      text: t(ctx.locale, "jobs.error.fetch_failed"),
    });
    return true;
  }
}

/**
 * Show user's posted jobs
 */
export async function showMyJobs(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  await logStructuredEvent("JOB_MY_JOBS_VIEW", {
    userId: ctx.profileId,
  });

  try {
    // Query job_listings table using phone number (posted_by is text field with phone)
    const { data: jobs, error } = await ctx.supabase
      .from("job_listings")
      .select(`
        id,
        title,
        location,
        status,
        job_type,
        pay_min,
        pay_max,
        pay_type,
        currency,
        created_at
      `)
      .eq("posted_by", ctx.from)  // Use phone number, not profileId
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw error;

    if (!jobs || jobs.length === 0) {
      await sendMessage(ctx, {
        text: t(ctx.locale, "jobs.myJobs.none"),
      });
      return true;
    }

    // Get application counts for each job
    const jobIds = jobs.map((j: any) => j.id);
    const { data: appCounts } = await ctx.supabase
      .from("job_applications")
      .select("job_id")
      .in("job_id", jobIds);

    // Count applications per job
    const countsByJob = (appCounts || []).reduce((acc: any, app: any) => {
      acc[app.job_id] = (acc[app.job_id] || 0) + 1;
      return acc;
    }, {});

    // Format jobs list
    let message = t(ctx.locale, "jobs.myJobs.header") + "\n\n";

    jobs.forEach((job: any, index: number) => {
      const payInfo = job.pay_min && job.pay_max
        ? `${job.currency || "RWF"} ${job.pay_min}-${job.pay_max}/${job.pay_type}`
        : t(ctx.locale, "jobs.pay.negotiable");

      const applicants = countsByJob[job.id] || 0;

      message += `${index + 1}. *${job.title}*\n`;
      message += `   📍 ${job.location}\n`;
      message += `   💰 ${payInfo}\n`;
      message += `   📋 ${t(ctx.locale, `jobs.type.${job.job_type}`)} | ${t(ctx.locale, `jobs.status.${job.status}`)}\n`;
      message += `   👥 ${applicants} applicant${applicants !== 1 ? "s" : ""}\n\n`;
    });

    message += t(ctx.locale, "jobs.myJobs.footer");

    await sendMessage(ctx, { text: message });

    return true;
  } catch (error: any) {
    console.error("Error fetching my jobs:", error);
    await sendMessage(ctx, {
      text: t(ctx.locale, "jobs.error.fetch_failed"),
    });
    return true;
  }
}
