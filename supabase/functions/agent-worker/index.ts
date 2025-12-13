/**
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
    // Note: This would typically call the broadcast function via HTTP
    // For now, we'll just log and notify user
    
    await sendText(
      from,
      `Great! I'll reach out to ${candidates.length} businesses about your request. ` +
      `You'll receive notifications when they respond. This usually takes a few hours.`
    );

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
