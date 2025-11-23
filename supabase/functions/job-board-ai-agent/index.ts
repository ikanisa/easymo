import { detectLanguage, translateText } from "../_shared/multilingual-utils.ts";
import { transcribeAudio, textToSpeech } from "../_shared/voice-handler.ts";
// =====================================================
// JOB BOARD AI AGENT - Main Edge Function
// =====================================================
// WhatsApp-integrated job marketplace AI
// Matches job seekers with opportunities using OpenAI embeddings
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { SYSTEM_PROMPT } from "./prompts.ts";
import { tools } from "./tools.ts";
import { requireFirstChoice } from "../_shared/openaiGuard.ts";
import {
  handleExtractJobMetadata,
  handlePostJob,
  handleSearchJobs,
  handleUpdateSeekerProfile,
  handleExpressInterest,
  handleViewApplicants,
  handleGetMyJobs,
  handleGetMyApplications,
  handleUpdateJobStatus,
  handleGetJobDetails,
} from "./handlers.ts";
import { logStructuredEvent } from "../_shared/observability.ts";

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY")!,
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const healthMetrics = {
  success: 0,
  failure: 0,
  latencyMsTotal: 0,
};

const renderHealthMetrics = (service: string): string => [
  `agent_health_checks_total{service="${service}",status="success"} ${healthMetrics.success}`,
  `agent_health_checks_total{service="${service}",status="failure"} ${healthMetrics.failure}`,
  `agent_health_latency_ms_sum{service="${service}"} ${healthMetrics.latencyMsTotal}`,
].join("\n");

// =====================================================
// Main Handler
// =====================================================

serve(async (req: Request) => {
  const url = new URL(req.url);
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const startedAt = Date.now();

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers({
      "Content-Type": "application/json",
      "X-Request-ID": requestId,
      ...(init.headers || {}),
    });
    return new Response(
      typeof body === "string" ? body : JSON.stringify(body),
      { ...init, headers },
    );
  };

  if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/ping")) {
    try {
      const { error } = await supabase.from("job_conversations").select("id").limit(1);
      const healthy = !error;
      const durationMs = Date.now() - startedAt;
      healthMetrics.latencyMsTotal += durationMs;
      healthy ? healthMetrics.success++ : healthMetrics.failure++;

      await logStructuredEvent("JOB_AGENT_HEALTH", {
        requestId,
        healthy,
        durationMs,
        error: error?.message,
      });

      return respond({
        status: healthy ? "ok" : "degraded",
        service: "job-board-ai-agent",
        requestId,
        latency_ms: durationMs,
        timestamp: new Date().toISOString(),
        checks: { database: healthy ? "connected" : "error" },
      }, { status: healthy ? 200 : 503 });
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      healthMetrics.failure++;
      healthMetrics.latencyMsTotal += durationMs;
      await logStructuredEvent("JOB_AGENT_HEALTH_ERROR", {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        durationMs,
      }, "error");

      return respond({
        status: "unhealthy",
        service: "job-board-ai-agent",
        requestId,
        latency_ms: durationMs,
      }, { status: 503 });
    }
  }

  if (req.method === "GET" && url.pathname === "/metrics") {
    return new Response(renderHealthMetrics("job-board-ai-agent"), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; version=0.0.4",
        "X-Request-ID": requestId,
      },
    });
  }

  try {
    // Verify method
    if (req.method !== "POST") {
      return respond({ error: "Method not allowed" }, { status: 405 });
    }

    const { phone_number, message, conversation_history } = await req.json();

    if (!phone_number || !message) {
      return respond({ error: "phone_number and message required" }, { status: 400 });
    }

    await logStructuredEvent("JOB_AGENT_REQUEST", {
      phoneNumber: phone_number,
      messageLength: message.length,
      requestId,
    });

    // Load or create conversation
    const { data: conversation } = await supabase
      .from("job_conversations")
      .select("*")
      .eq("phone_number", phone_number)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Build messages array
    const messages: any[] = [
      {
        role: "system",
        content: SYSTEM_PROMPT.replace(
          "{{CURRENT_TIME}}",
          new Date().toISOString()
        ),
      },
    ];

    // Add conversation history (last 10 messages)
    if (conversation?.messages) {
      const recentMessages = conversation.messages.slice(-10);
      messages.push(...recentMessages);
    }

    // Add current user message
    messages.push({ role: "user", content: message });

    // Call OpenAI with function calling
    let response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.7,
      max_tokens: 1000,
    });

    let assistantMessage = requireFirstChoice(
      response,
      "Job board chat completion"
    ).message;
    const toolCalls: any[] = [];

    // Handle function calls iteratively
    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      messages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        await logStructuredEvent("TOOL_CALL", {
          functionName,
          phoneNumber: phone_number,
          requestId,
        });

        let result: any;

        // Route to appropriate handler
        switch (functionName) {
          case "extract_job_metadata":
            result = await handleExtractJobMetadata(functionArgs, openai);
            break;

          case "post_job":
            result = await handlePostJob(
              functionArgs,
              supabase,
              openai,
              phone_number
            );
            break;

          case "search_jobs":
            result = await handleSearchJobs(
              functionArgs,
              supabase,
              openai,
              phone_number
            );
            break;

          case "update_seeker_profile":
            result = await handleUpdateSeekerProfile(
              functionArgs,
              supabase,
              openai,
              phone_number
            );
            break;

          case "express_interest":
            result = await handleExpressInterest(
              functionArgs,
              supabase,
              phone_number
            );
            break;

          case "view_applicants":
            result = await handleViewApplicants(
              functionArgs,
              supabase,
              phone_number
            );
            break;

          case "get_my_jobs":
            result = await handleGetMyJobs(functionArgs, supabase, phone_number);
            break;

          case "get_my_applications":
            result = await handleGetMyApplications(
              functionArgs,
              supabase,
              phone_number
            );
            break;

          case "update_job_status":
            result = await handleUpdateJobStatus(
              functionArgs,
              supabase,
              phone_number
            );
            break;

          case "get_job_details":
            result = await handleGetJobDetails(functionArgs, supabase);
            break;

          default:
            result = {
              success: false,
              error: `Unknown function: ${functionName}`,
            };
        }

        toolCalls.push({ name: functionName, result });

        // Add tool result to messages
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      // Get next response
      response = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0.7,
        max_tokens: 1000,
      });

      assistantMessage = requireFirstChoice(
        response,
        "Job board tool follow-up"
      ).message;
    }

    const finalResponse = assistantMessage.content || "I'm here to help with jobs!";

    // Save conversation
    const newMessages = [
      { role: "user", content: message, timestamp: new Date().toISOString() },
      {
        role: "assistant",
        content: finalResponse,
        timestamp: new Date().toISOString(),
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      },
    ];

    await supabase.from("job_conversations").upsert(
      {
        phone_number,
        messages: [...(conversation?.messages || []), ...newMessages],
        message_count: (conversation?.message_count || 0) + 2,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        role: conversation?.role || "job_seeker",
      },
      { onConflict: "phone_number" }
    );

    await logStructuredEvent("JOB_AGENT_RESPONSE", {
      phoneNumber: phone_number,
      toolCallCount: toolCalls.length,
      responseLength: finalResponse.length,
      requestId,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: finalResponse,
        tool_calls: toolCalls,
        conversation_id: conversation?.id,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "x-correlation-id": requestId,
        },
      }
    );
  } catch (error: any) {
    await logStructuredEvent("ERROR", {
      event: "JOB_AGENT_ERROR",
      error: error.message,
      stack: error.stack,
      requestId,
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "x-correlation-id": requestId,
        },
      }
    );
  }
});
