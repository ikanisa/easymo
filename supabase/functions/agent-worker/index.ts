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
 * Agent Worker - Background Job Processor
 * 
 * Processes queued jobs asynchronously with AI-powered sourcing:
 * - Intent extraction with structured JSON schema
 * - Google Maps/Search grounding for vendor discovery
 * - Candidate vendor management
 * - Outreach confirmation flow
 * - Geo-blocking for unsupported markets
 * - Conversation state management
 * 
 * Uses Gemini AI and WhatsApp Cloud Business API per GROUND_RULES.md
 * 
 * @see docs/GROUND_RULES.md
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../_shared/observability.ts";
import { 
  normalizePhoneNumber, 
  getCountryFromPhone, 
  isBlockedCountry,
  BLOCKED_COUNTRIES 
} from "../_shared/buy-sell-config.ts";
import { generateContent, extractIntent, SYSTEM_INSTRUCTION_RESPONSE } from "../_shared/gemini.ts";
import { SOURCING_TOOLS_CONFIG } from "../_shared/buy-sell-tools.ts";
import { sendText } from "../_shared/wa-webhook-shared/wa/client.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface JobPayload {
  message: string;
  messageId: string;
  messageType: string;
  from: string;
}

interface ConversationStep {
  step: "COLLECT_INTENT" | "PROCESS_INTENT" | "SEARCH_VENDORS" | "CONFIRM_OUTREACH" | "COMPLETED";
  data?: Record<string, any>;
}

// Process a single job
async function processJob(
  jobId: string,
  userId: string,
  payload: JobPayload,
  supabase: any,
  correlationId: string
) {
  const { message, from } = payload;

  try {
    // Get or create conversation state
    let { data: conversation } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!conversation) {
      // Create new conversation
      const { data: newConv } = await supabase
        .from("conversations")
        .insert({
          user_id: userId,
          state_json: { step: "COLLECT_INTENT" }
        })
        .select()
        .single();
      conversation = newConv;
    }

    const state: ConversationStep = conversation.state_json;

    // Check geo-blocking
    const userCountry = getCountryFromPhone(from);
    if (userCountry && isBlockedCountry(userCountry)) {
      await sendText(
        from,
        `Sorry, our service is not yet available in your country (${userCountry}). ` +
        `We currently don't support: ${BLOCKED_COUNTRIES.join(", ")}. ` +
        `We're working on expanding to more regions soon!`
      );

      await logStructuredEvent("USER_GEO_BLOCKED", {
        userId,
        country: userCountry,
        correlationId
      });

      return;
    }

    // Process based on current conversation step
    switch (state.step) {
      case "COLLECT_INTENT":
        await handleCollectIntent(message, from, userId, conversation, supabase, correlationId);
        break;

      case "CONFIRM_OUTREACH":
        await handleConfirmOutreach(message, from, userId, conversation, supabase, correlationId);
        break;

      default:
        // Fallback: treat as new intent collection
        await handleCollectIntent(message, from, userId, conversation, supabase, correlationId);
        break;
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
      .update({ status: "completed" })
      .eq("id", jobId);

  } catch (error) {
    await logStructuredEvent("JOB_PROCESSING_ERROR", {
      jobId,
      userId,
      error: (error as Error).message,
      correlationId
    }, "error");

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
        error_message: (error as Error).message
      })
      .eq("id", jobId);

    // Send error message to user
    await sendText(
      payload.from,
      "Sorry, I encountered an error processing your request. Please try again."
    );
  }
}

// Handle intent collection and vendor search
async function handleCollectIntent(
  message: string,
  from: string,
  userId: string,
  conversation: any,
  supabase: any,
  correlationId: string
) {
  // Extract intent using Gemini
  const intent = await extractIntent(message, {}, correlationId);

  await logStructuredEvent("INTENT_EXTRACTED", {
    userId,
    intentType: intent.need_type,
    confidence: intent.confidence,
    correlationId
  });

  // Check confidence
  if (intent.confidence < 0.6) {
    await sendText(
      from,
      "I'm not sure I understood your request. Could you please provide more details about what you're looking for?"
    );
    return;
  }

  // Create sourcing request
  const { data: sourcingRequest } = await supabase
    .from("sourcing_requests")
    .insert({
      user_id: userId,
      intent_json: intent,
      status: "pending"
    })
    .select()
    .single();

  // Search for vendors using Gemini with grounding
  const searchPrompt = `Find businesses that can help with this request:

Need: ${intent.description}
Type: ${intent.need_type}
${intent.location ? `Location: ${intent.location}` : ""}
${intent.quantity ? `Quantity: ${intent.quantity}` : ""}
${intent.special_requirements ? `Requirements: ${intent.special_requirements.join(", ")}` : ""}

Search for relevant businesses and save the top candidates using the save_candidates function.
Focus on businesses that are most likely to fulfill this need.`;

  const searchResult = await generateContent(
    searchPrompt,
    {
      model: "gemini-2.0-flash-exp",
      systemInstruction: SYSTEM_INSTRUCTION_RESPONSE,
      tools: SOURCING_TOOLS_CONFIG.tools,
      toolConfig: SOURCING_TOOLS_CONFIG.toolConfig,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      },
      correlationId
    }
  );

  // Check for function calls (save_candidates)
  if (searchResult.functionCalls && searchResult.functionCalls.length > 0) {
    for (const call of searchResult.functionCalls) {
      if (call.name === "save_candidates") {
        const candidates = call.args.candidates || [];
        
        // Save candidates to database
        if (candidates.length > 0) {
          const candidateRecords = candidates.map((c: any) => ({
            request_id: sourcingRequest.id,
            name: c.name,
            phone: c.phone,
            address: c.address,
            place_id: c.place_id,
            source: c.source,
            score: c.score || 0
          }));

          await supabase
            .from("candidate_vendors")
            .insert(candidateRecords);

          await logStructuredEvent("CANDIDATES_SAVED", {
            userId,
            requestId: sourcingRequest.id,
            count: candidates.length,
            correlationId
          });

          // Ask user for confirmation to reach out
          await sendText(
            from,
            `I found ${candidates.length} businesses that might help:\n\n` +
            candidates.slice(0, 3).map((c: any, i: number) => 
              `${i + 1}. ${c.name}${c.address ? `\n   ${c.address}` : ""}`
            ).join("\n\n") +
            `\n\nWould you like me to contact them on your behalf? Reply YES to proceed.`
          );

          // Update conversation state
          await supabase
            .from("conversations")
            .update({
              state_json: {
                step: "CONFIRM_OUTREACH",
                data: {
                  sourcingRequestId: sourcingRequest.id,
                  candidateCount: candidates.length
                }
              }
            })
            .eq("user_id", userId);

          return;
        }
      }
    }
  }

  // No candidates found
  await sendText(
    from,
    "I couldn't find any businesses matching your request at the moment. " +
    "Try being more specific or check back later."
  );

  await supabase
    .from("sourcing_requests")
    .update({ status: "completed" })
    .eq("id", sourcingRequest.id);
}

// Handle outreach confirmation
async function handleConfirmOutreach(
  message: string,
  from: string,
  userId: string,
  conversation: any,
  supabase: any,
  correlationId: string
) {
  const state: ConversationStep = conversation.state_json;
  const normalized = message.toLowerCase().trim();

  if (normalized.includes("yes") || normalized.includes("yeah") || normalized.includes("sure")) {
    // User confirmed - trigger broadcast
    const sourcingRequestId = state.data?.sourcingRequestId;

    if (!sourcingRequestId) {
      await sendText(from, "Sorry, I lost track of your request. Please start over.");
      return;
    }

    // Get candidates
    const { data: candidates } = await supabase
      .from("candidate_vendors")
      .select("*")
      .eq("request_id", sourcingRequestId);

    if (!candidates || candidates.length === 0) {
      await sendText(from, "No candidates available for outreach.");
      return;
    }

    // Get sourcing request details
    const { data: sourcingRequest } = await supabase
      .from("sourcing_requests")
      .select("*")
      .eq("id", sourcingRequestId)
      .single();

    const intent = sourcingRequest.intent_json;

    // Trigger broadcast via whatsapp-broadcast function
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const bridgeApiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
      
      if (!bridgeApiKey) {
        throw new Error("WHATSAPP_BRIDGE_API_KEY not configured");
      }

      const broadcastPayload = {
        requestId: `sourcing-${sourcingRequestId}`,
        userLocationLabel: intent.location || undefined,
        needDescription: intent.description,
        vendorFilter: {
          tags: intent.special_requirements || []
        }
      };

      const broadcastResponse = await fetch(
        `${supabaseUrl}/functions/v1/whatsapp-broadcast`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": bridgeApiKey,
            "x-correlation-id": correlationId
          },
          body: JSON.stringify(broadcastPayload)
        }
      );

      if (!broadcastResponse.ok) {
        throw new Error(`Broadcast failed: ${broadcastResponse.status}`);
      }

      const broadcastResult = await broadcastResponse.json();
      
      await sendText(
        from,
        `Great! I've reached out to ${broadcastResult.sentCount} businesses about your request. ` +
        `You'll receive notifications when they respond. This usually takes a few hours.`
      );

      await logStructuredEvent("BROADCAST_TRIGGERED", {
        userId,
        sourcingRequestId,
        sentCount: broadcastResult.sentCount,
        correlationId
      });

    } catch (error) {
      await logStructuredEvent("BROADCAST_TRIGGER_ERROR", {
        userId,
        sourcingRequestId,
        error: (error as Error).message,
        correlationId
      }, "error");

      await sendText(
        from,
        `I found ${candidates.length} businesses for you, but I'm having trouble reaching out to them right now. ` +
        `Please try again in a moment.`
      );
    }

    await logStructuredEvent("OUTREACH_CONFIRMED", {
      userId,
      sourcingRequestId,
      candidateCount: candidates.length,
      correlationId
    });

    // Update conversation state
    await supabase
      .from("conversations")
      .update({
        state_json: {
          step: "COMPLETED",
          data: {}
        }
      })
      .eq("user_id", userId);

    // Update sourcing request
    await supabase
      .from("sourcing_requests")
      .update({ status: "completed" })
      .eq("id", sourcingRequestId);

  } else if (normalized.includes("no")) {
    await sendText(
      from,
      "No problem! Let me know if you need anything else."
    );

    // Reset conversation state
    await supabase
      .from("conversations")
      .update({
        state_json: {
          step: "COLLECT_INTENT",
          data: {}
        }
      })
      .eq("user_id", userId);
  } else {
    await sendText(
      from,
      "Please reply YES to proceed with outreach, or NO to cancel."
    );
  }
}

// Main handler
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();

  try {
    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get next pending job
    const { data: jobs } = await supabase.rpc("get_next_job");

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending jobs" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const job = jobs[0];

    await logStructuredEvent("JOB_PROCESSING_STARTED", {
      jobId: job.id,
      jobType: job.type,
      userId: job.user_id,
      correlationId
    });

    // Process the job
    await processJob(
      job.id,
      job.user_id,
      job.payload_json,
      supabase,
      correlationId
    );

    return new Response(
      JSON.stringify({ 
        success: true,
        jobId: job.id
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    await logStructuredEvent("AGENT_WORKER_ERROR", {
      error: (error as Error).message,
      stack: (error as Error).stack,
      correlationId
    }, "error");

    return new Response(
      JSON.stringify({
        error: "Worker error",
        details: (error as Error).message
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
