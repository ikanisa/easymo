import { detectLanguage, translateText } from "../_shared/multilingual-utils.ts";
import { transcribeAudio, textToSpeech } from "../_shared/voice-handler.ts";
// =====================================================
// JOB BOARD AI AGENT - Main Edge Function
// =====================================================
// WhatsApp-integrated job marketplace AI
// Matches job seekers with opportunities using OpenAI embeddings
// =====================================================

import { serve } from "$std/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { SYSTEM_PROMPT } from "./prompts.ts";
import { tools } from "./tools.ts";
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

// =====================================================
// Main Handler
// =====================================================

serve(async (req: Request) => {
  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();
  
  try {
    // Verify method
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { phone_number, message, conversation_history } = await req.json();

    if (!phone_number || !message) {
      return new Response(
        JSON.stringify({ error: "phone_number and message required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await logStructuredEvent("JOB_AGENT_REQUEST", {
      phoneNumber: phone_number,
      messageLength: message.length,
      correlationId,
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

    let assistantMessage = response.choices[0].message;
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
          correlationId,
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

      assistantMessage = response.choices[0].message;
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
      correlationId,
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
          "x-correlation-id": correlationId,
        },
      }
    );
  } catch (error: any) {
    await logStructuredEvent("ERROR", {
      event: "JOB_AGENT_ERROR",
      error: error.message,
      stack: error.stack,
      correlationId,
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
          "x-correlation-id": correlationId,
        },
      }
    );
  }
});
