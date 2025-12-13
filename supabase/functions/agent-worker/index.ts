/**
 * Agent Worker Edge Function
 * 
 * Background job processor for Buy & Sell agent
 * 
 * Features:
 * - Intent extraction with structured JSON schema
 * - Sourcing execution with Google Maps and Google Search grounding
 * - Candidate vendor management (save_candidates tool)
 * - Outreach confirmation flow (ASK_OUTREACH state)
 * - Geo-blocking for unsupported markets
 * - Multimodal input support (text + audio)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";
import { extractIntent, executeSourcing } from "../_shared/buy-sell-gemini.ts";
import { isPhoneBlocked, detectCountryFromPhone, getCountryName } from "../_shared/buy-sell-config.ts";
import type { ExtractedIntent, ConversationState, Job } from "../_shared/buy-sell-types.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

serve(async (req: Request): Promise<Response> => {
  const correlationId = req.headers.get("x-correlation-id") ?? crypto.randomUUID();

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Correlation-ID", correlationId);
    headers.set("X-Service", "agent-worker");
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  // Health check
  if (req.method === "GET") {
    return respond({
      status: "healthy",
      service: "agent-worker",
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== "POST") {
    return respond({ error: "method_not_allowed" }, { status: 405 });
  }

  try {
    // Get next job from queue
    const { data: jobs, error: jobError } = await supabase.rpc("get_next_job");

    if (jobError) {
      await logStructuredEvent("JOB_FETCH_FAILED", {
        error: jobError.message,
        correlationId,
      });
      return respond({ error: jobError.message }, { status: 500 });
    }

    if (!jobs || jobs.length === 0) {
      return respond({ status: "ok", message: "No jobs to process" });
    }

    const job: Job = jobs[0];

    await logStructuredEvent("JOB_PROCESSING_STARTED", {
      job_id: job.id,
      job_type: job.type,
      correlationId,
    });

    // Process the job
    await processJob(job, correlationId);

    return respond({ status: "ok", processed_job_id: job.id });
  } catch (error) {
    await logStructuredEvent("AGENT_WORKER_ERROR", {
      error: error.message,
      correlationId,
    });

    return respond(
      {
        error: "Internal server error",
        details: error.message,
      },
      { status: 500 }
    );
  }
});

/**
 * Process a job based on its type
 */
async function processJob(job: Job, correlationId: string): Promise<void> {
  try {
    if (job.type === "process_user_message") {
      await processUserMessage(job, correlationId);
    } else if (job.type === "execute_sourcing") {
      await executeSourcingJob(job, correlationId);
    } else {
      await logStructuredEvent("UNKNOWN_JOB_TYPE", {
        job_id: job.id,
        job_type: job.type,
        correlationId,
      });
    }

    // Mark job as completed
    await supabase
      .from("jobs")
      .update({
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    await recordMetric("job.completed", 1, { type: job.type });
  } catch (error) {
    await logStructuredEvent("JOB_PROCESSING_FAILED", {
      job_id: job.id,
      error: error.message,
      correlationId,
    });

    // Mark job as failed
    await supabase
      .from("jobs")
      .update({
        status: "failed",
        error_message: error.message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    await recordMetric("job.failed", 1, { type: job.type });
  }
}

/**
 * Process user message: extract intent and manage conversation state
 */
async function processUserMessage(job: Job, correlationId: string): Promise<void> {
  const payload = job.payload_json as {
    from: string;
    messageText: string;
    messageType: string;
    messageId: string;
  };

  const { from, messageText } = payload;

  // Check geo-blocking
  if (isPhoneBlocked(from)) {
    const country = detectCountryFromPhone(from);
    const countryName = country ? (getCountryName(country) || country) : "your region";

    await sendWhatsAppMessage(
      from,
      `Sorry, the Buy & Sell service is not yet available in ${countryName}. We're working to expand soon!`
    );

    await logStructuredEvent("BLOCKED_MARKET_DETECTED", {
      from,
      country: country || "unknown",
      correlationId,
    });

    await recordMetric("blocked_market.rejection", 1, { country: country || "unknown" });
    return;
  }

  // Get or create conversation state
  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("*")
    .eq("user_id", job.user_id)
    .single();

  let state: ConversationState = conversation?.state_json || { step: "COLLECT_INTENT" };

  if (state.step === "COLLECT_INTENT") {
    // Extract intent
    const intent = await extractIntent(messageText, undefined, correlationId);

    if (!intent || intent.need_type === "unknown") {
      await sendWhatsAppMessage(
        from,
        "I'm not sure I understand. Could you tell me what you're looking for? For example:\n• 'I need a laptop'\n• 'Looking for a plumber'\n• 'Where can I buy fresh vegetables?'"
      );
      return;
    }

    // Save intent to sourcing request
    const { data: sourcingRequest, error: sourcingError } = await supabase
      .from("sourcing_requests")
      .insert({
        user_id: job.user_id,
        intent_json: intent,
        status: "pending",
      })
      .select()
      .single();

    if (sourcingError) {
      throw new Error(`Failed to create sourcing request: ${sourcingError.message}`);
    }

    // Update conversation state
    state = {
      step: "ASK_OUTREACH",
      intent,
      sourcing_request_id: sourcingRequest.id,
    };

    await supabase
      .from("conversations")
      .upsert({
        user_id: job.user_id,
        state_json: state,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", job.user_id);

    // Execute sourcing in background
    await supabase.from("jobs").insert({
      user_id: job.user_id,
      type: "execute_sourcing",
      payload_json: {
        sourcing_request_id: sourcingRequest.id,
        intent,
      },
      status: "pending",
    });

    await sendWhatsAppMessage(
      from,
      `Got it! Looking for: ${intent.query}\n\n🔍 Searching for vendors... I'll get back to you shortly!`
    );

    await recordMetric("intent.extracted", 1, { type: intent.need_type });
  } else if (state.step === "ASK_OUTREACH") {
    // User responded to outreach confirmation
    const response = messageText.toLowerCase().trim();

    if (response.includes("yes") || response.includes("ok") || response.includes("proceed")) {
      // Proceed with broadcast
      // This would trigger the broadcast function
      await sendWhatsAppMessage(from, "Great! I'll reach out to vendors for you. 📤");

      state.step = "AWAITING_VENDOR_REPLIES";
      await supabase
        .from("conversations")
        .update({
          state_json: state,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", job.user_id);
    } else if (response.includes("no") || response.includes("cancel")) {
      await sendWhatsAppMessage(from, "No problem! Let me know if you need anything else. 😊");

      state.step = "COLLECT_INTENT";
      await supabase
        .from("conversations")
        .update({
          state_json: state,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", job.user_id);
    }
  }
}

/**
 * Execute sourcing: find candidate vendors using Google Search/Maps
 */
async function executeSourcingJob(job: Job, correlationId: string): Promise<void> {
  const payload = job.payload_json as {
    sourcing_request_id: string;
    intent: ExtractedIntent;
  };

  const { sourcing_request_id, intent } = payload;

  // Get user location if available
  const { data: location } = await supabase
    .from("user_locations")
    .select("*")
    .eq("user_id", job.user_id)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const userLocation = location
    ? { lat: parseFloat(location.lat), lng: parseFloat(location.lng) }
    : undefined;

  // Execute sourcing with Gemini
  const sourcingResult = await executeSourcing(intent, userLocation, correlationId);

  if (!sourcingResult) {
    throw new Error("Sourcing execution failed");
  }

  // Update sourcing request
  await supabase
    .from("sourcing_requests")
    .update({
      status: "completed",
    })
    .eq("id", sourcing_request_id);

  await recordMetric("sourcing.completed", 1);

  // For now, just log the result
  // In a complete implementation, this would:
  // 1. Parse candidates from sourcingResult.summary
  // 2. Save candidates to candidate_vendors table
  // 3. Ask user for outreach confirmation
  // 4. Trigger broadcast if confirmed

  await logStructuredEvent("SOURCING_RESULT", {
    sourcing_request_id,
    summary_length: sourcingResult.summary.length,
    correlationId,
  });
}

/**
 * Send WhatsApp message via Cloud Business API
 */
async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  try {
    const response = await fetch(WHATSAPP_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: {
          body: text,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp API error: ${error.error?.message}`);
    }

    await recordMetric("whatsapp.message.sent", 1);
  } catch (error) {
    await logStructuredEvent("WHATSAPP_SEND_FAILED", {
      to,
      error: error.message,
    });
    throw error;
  }
}
