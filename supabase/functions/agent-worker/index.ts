/**
 * Agent Worker - Background Job Processor for Buy & Sell Agent
 * 
 * Processes queued jobs asynchronously with AI-powered sourcing:
 * - Intent extraction with structured JSON schema (Gemini)
 * - Google Maps/Search grounding for vendor discovery
 * - Candidate vendor management (save_candidates tool)
 * - Outreach confirmation flow (CONFIRM_OUTREACH state)
 * - Geo-blocking for unsupported markets (UG, KE, NG, ZA)
 * - Conversation state management
 * 
 * Uses Gemini AI and WhatsApp Cloud Business API per GROUND_RULES.md
 * 
 * @see docs/GROUND_RULES.md for observability and security requirements
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";
// Country blocking removed - Rwanda-only system
import { generateContent, extractIntent, SYSTEM_INSTRUCTION_RESPONSE } from "../_shared/gemini.ts";
import { SOURCING_TOOLS_CONFIG } from "../_shared/buy-sell-tools.ts";
import { sendText } from "../_shared/wa-webhook-shared/wa/client.ts";
import { corsHeaders } from "../_shared/cors.ts";

// =====================================================
// TYPES
// =====================================================

interface JobPayload {
  message: string;
  messageId: string;
  messageType: string;
  from: string;
}

interface ConversationStep {
  step: "COLLECT_INTENT" | "PROCESS_INTENT" | "SEARCH_VENDORS" | "CONFIRM_OUTREACH" | "COMPLETED";
  data?: Record<string, unknown>;
}

interface Job {
  id: string;
  user_id: string;
  type: string;
  payload_json: JobPayload;
  status: string;
}

async function callExternalDiscoveryFallback(payload: {
  request_id: string;
  need: string;
  category?: string;
  location_text?: string;
  language?: "en" | "fr" | "rw";
}) {
  const enabled = (Deno.env.get("EXTERNAL_DISCOVERY_ENABLED") ?? "false").toLowerCase() === "true";
  if (!enabled) return null;

  const serviceUrl = Deno.env.get("EXTERNAL_DISCOVERY_SERVICE_URL");
  if (!serviceUrl) return null;

  const key = Deno.env.get("EXTERNAL_DISCOVERY_SERVICE_KEY");
  const response = await fetch(`${serviceUrl.replace(/\/$/, "")}/marketplace/external-discovery`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) return null;
  return await response.json();
}

// =====================================================
// JOB PROCESSING
// =====================================================

/**
 * Process a single job from the queue
 */
async function processJob(
  jobId: string,
  userId: string,
  payload: JobPayload,
  supabase: SupabaseClient,
  correlationId: string
): Promise<void> {
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

    const state: ConversationStep = conversation?.state_json || { step: "COLLECT_INTENT" };

    // Rwanda-only system - no geo-blocking needed

      await logStructuredEvent("USER_GEO_BLOCKED", {
        userId,
        country: userCountry,
        correlationId
      });

      // Mark job as completed (geo-blocked)
      await supabase
        .from("jobs")
        .update({ status: "completed" })
        .eq("id", jobId);

      await recordMetric("job.geo_blocked", 1, { country: userCountry });
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
      .update({ status: "completed" })
      .eq("id", jobId);

    await recordMetric("job.completed", 1, { type: "process_user_message" });

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
        error_message: (error as Error).message
      })
      .eq("id", jobId);

    await recordMetric("job.failed", 1, { type: "process_user_message" });

    // Send error message to user
    await sendText(
      from,
      "Sorry, I encountered an error processing your request. Please try again."
    );
  }
}

// =====================================================
// INTENT COLLECTION
// =====================================================

/**
 * Handle intent collection and vendor search using Gemini AI
 */
async function handleCollectIntent(
  message: string,
  from: string,
  userId: string,
  conversation: Record<string, unknown>,
  supabase: SupabaseClient,
  correlationId: string
): Promise<void> {
  // Extract intent using Gemini with structured output
  const intent = await extractIntent(message, {}, correlationId);

  await logStructuredEvent("INTENT_EXTRACTED", {
    userId,
    intentType: intent.need_type,
    confidence: intent.confidence,
    correlationId
  });

  // Check confidence threshold
  if (intent.confidence < 0.6) {
    await sendText(
      from,
      "I'm not sure I understood your request. Could you please provide more details about what you're looking for?"
    );
    return;
  }

  // Create sourcing request record
  const { data: sourcingRequest } = await supabase
    .from("sourcing_requests")
    .insert({
      user_id: userId,
      intent_json: intent,
      status: "pending"
    })
    .select()
    .single();

  if (!sourcingRequest) {
    throw new Error("Failed to create sourcing request");
  }

  // Search for vendors using Gemini with Google Search/Maps grounding
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
      model: "gemini-3-flash", // Complex reasoning for agent worker
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

  // Process function calls (save_candidates)
  if (searchResult.functionCalls && searchResult.functionCalls.length > 0) {
    for (const call of searchResult.functionCalls) {
      if (call.name === "save_candidates") {
        const candidates = call.args.candidates || [];
        
        if (candidates.length > 0) {
          // Save candidates to database
          const candidateRecords = candidates.map((c: Record<string, unknown>) => ({
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

          if (candidates.length < 2) {
            const fallback = await callExternalDiscoveryFallback({
              request_id: sourcingRequest.id,
              need: intent.description || "User request",
              category: intent.need_type,
              location_text: intent.location,
            });

            if (fallback?.message) {
              await sendText(
                from,
                `${fallback.message}\n\n(These are external options; please contact them directly.)`
              );
            }
          }

          // Ask user for confirmation to reach out
          await sendText(
            from,
            `I found ${candidates.length} businesses that might help:\n\n` +
            candidates.slice(0, 3).map((c: Record<string, unknown>, i: number) => 
              `${i + 1}. ${c.name}${c.address ? `\n   ${c.address}` : ""}`
            ).join("\n\n") +
            `\n\nWould you like me to contact them on your behalf? Reply YES to proceed.`
          );

          // Update conversation state to await consent
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

// =====================================================
// OUTREACH CONFIRMATION
// =====================================================

/**
 * Handle user confirmation for vendor outreach
 */
async function handleConfirmOutreach(
  message: string,
  from: string,
  userId: string,
  conversation: Record<string, unknown>,
  supabase: SupabaseClient,
  correlationId: string
): Promise<void> {
  const state = conversation.state_json as ConversationStep;
  const normalized = message.toLowerCase().trim();

  // User confirmed outreach
  if (normalized.includes("yes") || normalized.includes("yeah") || normalized.includes("sure") || normalized === "y") {
    const sourcingRequestId = state.data?.sourcingRequestId as string;

    if (!sourcingRequestId) {
      await sendText(from, "Sorry, I lost track of your request. Please start over.");
      
      // Reset conversation
      await supabase
        .from("conversations")
        .update({ state_json: { step: "COLLECT_INTENT", data: {} } })
        .eq("user_id", userId);
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

    const intent = sourcingRequest?.intent_json;

    // Trigger broadcast via whatsapp-broadcast function
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const bridgeApiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
      
      if (!bridgeApiKey) {
        throw new Error("WHATSAPP_BRIDGE_API_KEY not configured");
      }

      const broadcastPayload = {
        requestId: `sourcing-${sourcingRequestId}`,
        userLocationLabel: intent?.location || undefined,
        needDescription: intent?.description,
        vendorFilter: {
          tags: intent?.special_requirements || []
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

    // Update conversation state to completed
    await supabase
      .from("conversations")
      .update({
        state_json: { step: "COMPLETED", data: {} }
      })
      .eq("user_id", userId);

    // Update sourcing request
    await supabase
      .from("sourcing_requests")
      .update({ status: "completed" })
      .eq("id", sourcingRequestId);

  } else if (normalized.includes("no") || normalized === "n") {
    // User declined outreach
    await sendText(
      from,
      "No problem! Let me know if you need anything else."
    );

    // Reset conversation state
    await supabase
      .from("conversations")
      .update({
        state_json: { step: "COLLECT_INTENT", data: {} }
      })
      .eq("user_id", userId);
  } else {
    // Unclear response
    await sendText(
      from,
      "Please reply YES to proceed with outreach, or NO to cancel."
    );
  }
}

// =====================================================
// MAIN HANDLER
// =====================================================

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();

  // Health check
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        status: "healthy",
        service: "agent-worker",
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "method_not_allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      const missing = [];
      if (!supabaseUrl) missing.push("SUPABASE_URL");
      if (!supabaseKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
      throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get next pending job from queue (using atomic locking)
    const { data: jobs } = await supabase.rpc("get_next_job");

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending jobs" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const job: Job = jobs[0];

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
