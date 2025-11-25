/**
 * WA-Webhook-Jobs Microservice
 * 
 * Handles WhatsApp webhook events for the Job Board domain.
 * Part of Phase 2 webhook decomposition strategy.
 * 
 * Features:
 * - Job listings search
 * - Job applications  
 * - Job alerts
 * - Employer postings
 * - Job categories
 * 
 * @see docs/GROUND_RULES.md for observability requirements
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../_shared/observability.ts";
import { sendText, sendList } from "../_shared/wa-webhook-shared/wa/client.ts";
import type { WhatsAppMessage, WhatsAppWebhookPayload } from "../_shared/wa-webhook-shared/types.ts";
import { getRoutingText } from "../_shared/wa-webhook-shared/utils/messages.ts";
import { t } from "./utils/i18n.ts";
import { detectJobIntent, shouldRouteToJobAgent } from "./jobs/utils.ts";

// Initialize Supabase client
const supabase: SupabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

// Service configuration
const SERVICE_NAME = "wa-webhook-jobs";
const WA_VERIFY_TOKEN = Deno.env.get("WA_VERIFY_TOKEN") ?? Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "";

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") ?? requestId;

  const logEvent = (
    event: string,
    details: Record<string, unknown> = {},
    level: "info" | "warn" | "error" = "info"
  ) => {
    logStructuredEvent(event, { service: SERVICE_NAME, requestId, correlationId, ...details }, level);
  };

  // Standard response helper with correlation headers
  const json = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Request-ID", requestId);
    headers.set("X-Correlation-ID", correlationId);
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  // Health check endpoint
  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    return handleHealthCheck(supabase, requestId, correlationId);
  }

  // WhatsApp webhook verification (GET request)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === WA_VERIFY_TOKEN) {
      logEvent("JOBS_WEBHOOK_VERIFIED");
      return new Response(challenge ?? "", { 
        status: 200, 
        headers: { "X-Request-ID": requestId, "X-Correlation-ID": correlationId } 
      });
    }

    logEvent("JOBS_WEBHOOK_VERIFICATION_FAILED", { mode, tokenProvided: !!token }, "warn");
    return json({ error: "forbidden" }, { status: 403 });
  }

  // Main webhook handler (POST request)
  if (req.method === "POST") {
    try {
      const payload: WhatsAppWebhookPayload = await req.json();
      const message = getFirstMessage(payload);

      if (!message?.from) {
        logEvent("JOBS_NO_MESSAGE", { ignored: true });
        return json({ success: true, ignored: "no_message" });
      }

      const input = extractInput(message);
      const text = input ?? "";
      const locale = detectLocale(payload) || "en";

      logEvent("JOBS_MESSAGE_RECEIVED", { 
        from: maskPhone(message.from), 
        type: message.type,
        inputLength: text.length 
      });

      // Detect job intent for better routing
      const intent = detectJobIntent(text);
      logEvent("JOBS_INTENT_DETECTED", { 
        intentType: intent.type, 
        confidence: intent.confidence 
      });

      // Handle different message scenarios
      if (!text) {
        // Welcome message for empty/initial contact
        await sendText(message.from, t(locale, "jobs.menu.greeting"));
      } else if (isMenuTrigger(text)) {
        // Show job board menu
        await showJobBoardMenu(message.from, locale);
      } else if (text === "1" || text === "job_find" || intent.type === "find_job") {
        // Find jobs
        await sendText(message.from, t(locale, "jobs.seeker.welcome"));
      } else if (text === "2" || text === "job_post" || intent.type === "post_job") {
        // Post a job
        await sendText(message.from, t(locale, "jobs.poster.welcome"));
      } else if (text === "3" || text === "job_my_applications" || intent.type === "view_applications") {
        // View applications
        await handleMyApplications(message.from, locale);
      } else if (text === "4" || text === "job_my_jobs" || intent.type === "view_jobs") {
        // View my posted jobs
        await handleMyJobs(message.from, locale);
      } else if (shouldRouteToJobAgent(text)) {
        // Route to AI agent for complex queries
        await handleJobAgentQuery(message.from, text, locale, correlationId);
      } else {
        // Echo with menu prompt
        await sendText(
          message.from, 
          `You said: "${text}"\n\n${t(locale, "jobs.menu.greeting")}`
        );
      }

      logEvent("JOBS_MESSAGE_PROCESSED", { success: true });
      return json({ success: true });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logEvent("JOBS_ERROR", { error: errorMessage }, "error");
      return json({ error: "internal_error" }, { status: 500 });
    }
  }

  // Method not allowed
  return json({ error: "method_not_allowed" }, { status: 405 });
});

/**
 * Health check handler - verifies database connectivity and table access
 */
async function handleHealthCheck(
  supabase: SupabaseClient,
  requestId: string,
  correlationId: string
): Promise<Response> {
  const checks: Record<string, { status: "ok" | "error"; message?: string }> = {};
  let overallHealthy = true;

  // Check job_listings table
  try {
    const { error } = await supabase.from("job_listings").select("id").limit(1);
    checks.job_listings = error ? { status: "error", message: error.message } : { status: "ok" };
    if (error) overallHealthy = false;
  } catch (e) {
    checks.job_listings = { status: "error", message: e instanceof Error ? e.message : String(e) };
    overallHealthy = false;
  }

  // Check job_seekers table
  try {
    const { error } = await supabase.from("job_seekers").select("id").limit(1);
    checks.job_seekers = error ? { status: "error", message: error.message } : { status: "ok" };
    if (error) overallHealthy = false;
  } catch (e) {
    checks.job_seekers = { status: "error", message: e instanceof Error ? e.message : String(e) };
    overallHealthy = false;
  }

  // Check job_applications table
  try {
    const { error } = await supabase.from("job_applications").select("id").limit(1);
    checks.job_applications = error ? { status: "error", message: error.message } : { status: "ok" };
    if (error) overallHealthy = false;
  } catch (e) {
    checks.job_applications = { status: "error", message: e instanceof Error ? e.message : String(e) };
    overallHealthy = false;
  }

  const response = {
    status: overallHealthy ? "healthy" : "unhealthy",
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
    checks,
  };

  logStructuredEvent(overallHealthy ? "JOBS_HEALTH_OK" : "JOBS_HEALTH_DEGRADED", {
    service: SERVICE_NAME,
    requestId,
    correlationId,
    checks,
  }, overallHealthy ? "info" : "warn");

  return new Response(JSON.stringify(response, null, 2), {
    status: overallHealthy ? 200 : 503,
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": requestId,
      "X-Correlation-ID": correlationId,
    },
  });
}

/**
 * Show job board menu with WhatsApp list message
 */
async function showJobBoardMenu(phone: string, locale: string): Promise<void> {
  const rows = [
    {
      id: "job_find",
      title: t(locale, "jobs.menu.find.title"),
      description: t(locale, "jobs.menu.find.description"),
    },
    {
      id: "job_post",
      title: t(locale, "jobs.menu.post.title"),
      description: t(locale, "jobs.menu.post.description"),
    },
    {
      id: "job_my_applications",
      title: t(locale, "jobs.menu.myApplications.title"),
      description: t(locale, "jobs.menu.myApplications.description"),
    },
    {
      id: "job_my_jobs",
      title: t(locale, "jobs.menu.myJobs.title"),
      description: t(locale, "jobs.menu.myJobs.description"),
    },
  ];

  await sendList(phone, {
    title: "EasyMO Jobs",
    body: t(locale, "jobs.menu.greeting"),
    buttonText: t(locale, "jobs.menu.button"),
    sectionTitle: t(locale, "jobs.menu.section"),
    rows,
  });
}

/**
 * Handle my applications query
 */
async function handleMyApplications(phone: string, locale: string): Promise<void> {
  try {
    // First get the job_seeker record
    const { data: seeker } = await supabase
      .from("job_seekers")
      .select("id")
      .eq("phone_number", phone)
      .maybeSingle();

    if (!seeker) {
      await sendText(phone, "You haven't created a job seeker profile yet. Reply with your skills to get started!");
      return;
    }

    // Get applications
    const { data: applications, error } = await supabase
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
          currency
        )
      `)
      .eq("seeker_id", seeker.id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) throw error;

    if (!applications || applications.length === 0) {
      await sendText(phone, "📋 *My Applications*\n\nYou haven't applied to any jobs yet. Reply '1' to search for jobs!");
      return;
    }

    let message = "📋 *My Applications*\n\n";
    applications.forEach((app: any, i: number) => {
      const job = app.job_listings;
      const pay = job.pay_min && job.pay_max 
        ? `${job.currency || "RWF"} ${job.pay_min}-${job.pay_max}` 
        : "Negotiable";
      message += `${i + 1}. *${job.title}*\n   📍 ${job.location}\n   💰 ${pay}\n   Status: ${app.status}\n\n`;
    });

    await sendText(phone, message);
  } catch (error) {
    logStructuredEvent("JOBS_APPLICATIONS_ERROR", { error: String(error) }, "error");
    await sendText(phone, "Sorry, I couldn't fetch your applications. Please try again.");
  }
}

/**
 * Handle my posted jobs query
 */
async function handleMyJobs(phone: string, locale: string): Promise<void> {
  try {
    const { data: jobs, error } = await supabase
      .from("job_listings")
      .select(`
        id,
        title,
        location,
        status,
        pay_min,
        pay_max,
        currency,
        created_at
      `)
      .eq("posted_by", phone)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) throw error;

    if (!jobs || jobs.length === 0) {
      await sendText(phone, "💼 *My Posted Jobs*\n\nYou haven't posted any jobs yet. Reply '2' to post a job!");
      return;
    }

    let message = "💼 *My Posted Jobs*\n\n";
    jobs.forEach((job: any, i: number) => {
      const pay = job.pay_min && job.pay_max 
        ? `${job.currency || "RWF"} ${job.pay_min}-${job.pay_max}` 
        : "Negotiable";
      message += `${i + 1}. *${job.title}*\n   📍 ${job.location}\n   💰 ${pay}\n   Status: ${job.status}\n\n`;
    });

    await sendText(phone, message);
  } catch (error) {
    logStructuredEvent("JOBS_MY_JOBS_ERROR", { error: String(error) }, "error");
    await sendText(phone, "Sorry, I couldn't fetch your jobs. Please try again.");
  }
}

/**
 * Route complex queries to job-board-ai-agent
 */
async function handleJobAgentQuery(
  phone: string,
  message: string,
  locale: string,
  correlationId: string
): Promise<void> {
  try {
    const agentUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/job-board-ai-agent`;
    
    const response = await fetch(agentUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "x-correlation-id": correlationId,
      },
      body: JSON.stringify({
        phone_number: phone,
        message,
        language: locale,
      }),
    });

    if (!response.ok) {
      throw new Error(`Agent returned ${response.status}`);
    }

    const data = await response.json();
    
    if (data.message) {
      await sendText(phone, data.message);
    } else {
      await sendText(phone, "I'm processing your request. Please wait a moment...");
    }
  } catch (error) {
    logStructuredEvent("JOBS_AGENT_ERROR", { error: String(error) }, "error");
    // Fallback to menu
    await sendText(phone, `I couldn't process that request.\n\n${t(locale, "jobs.menu.greeting")}`);
  }
}

/**
 * Extract text/selection from WhatsApp message
 */
function extractInput(message: WhatsAppMessage): string | null {
  if (message.type === "interactive") {
    const interactive = (message as Record<string, unknown>).interactive as Record<string, unknown> | undefined;
    const buttonReply = interactive?.button_reply as Record<string, unknown> | undefined;
    const listReply = interactive?.list_reply as Record<string, unknown> | undefined;
    
    const id = buttonReply?.id ?? listReply?.id;
    if (typeof id === "string" && id.trim()) return id.trim().toLowerCase();
    
    const title = buttonReply?.title ?? listReply?.title;
    if (typeof title === "string" && title.trim()) return title.trim().toLowerCase();
    
    return null;
  }
  
  if (message.type === "text") {
    const text = (message as Record<string, unknown>).text as Record<string, unknown> | undefined;
    const body = text?.body;
    return typeof body === "string" ? body.trim().toLowerCase() : null;
  }
  
  return null;
}

/**
 * Get first message from webhook payload
 */
function getFirstMessage(payload: WhatsAppWebhookPayload): WhatsAppMessage | null {
  const messages = payload.entry?.[0]?.changes?.[0]?.value?.messages;
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const raw = messages[0];
  if (!raw?.id || !raw?.from || !raw?.type) return null;
  return raw as WhatsAppMessage;
}

/**
 * Detect user locale from payload
 */
function detectLocale(payload: WhatsAppWebhookPayload): string {
  const contacts = payload.entry?.[0]?.changes?.[0]?.value?.contacts;
  if (Array.isArray(contacts) && contacts.length > 0) {
    const lang = contacts[0]?.language || contacts[0]?.locale || contacts[0]?.profile?.language;
    if (typeof lang === "string") {
      const code = lang.split("-")[0].toLowerCase();
      if (["en", "fr", "rw"].includes(code)) return code;
    }
  }
  return "en";
}

/**
 * Check if text is a menu trigger
 */
function isMenuTrigger(text: string): boolean {
  const triggers = ["jobs", "jobs_agent", "menu", "job", "work", "hiring", "find work"];
  return triggers.some(t => text === t || text.startsWith(t + " "));
}

/**
 * Mask phone number for logging (privacy)
 */
function maskPhone(phone: string): string {
  if (!phone || phone.length < 8) return "***";
  return phone.slice(0, 4) + "***" + phone.slice(-3);
}

console.log(`✅ ${SERVICE_NAME} service started`);
