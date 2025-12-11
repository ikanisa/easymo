// =====================================================
// OPENAI REALTIME API - MTN SIP HANDLER
// =====================================================
// Handles incoming MTN SIP calls via OpenAI Realtime API
// MTN SIP trunk integration for Rwanda
// =====================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import { getServiceClient } from "../_shared/supabase.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const OPENAI_REALTIME_MODEL = Deno.env.get("OPENAI_REALTIME_MODEL") || "gpt-4o-realtime-preview-2024-10-01";

interface CallSession {
  callId: string;
  sessionId: string;
  from: string;
  to: string;
  locale: string;
}

/**
 * Initialize OpenAI Realtime session
 */
async function createRealtimeSession(
  callId: string,
  instructions: string,
  voice: string = "alloy",
  tools?: any[]
): Promise<{ sessionId: string; session: any }> {
  const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_REALTIME_MODEL,
      voice,
      instructions,
      modalities: ["text", "audio"],
      input_audio_format: "pcm16",
      output_audio_format: "pcm16",
      input_audio_transcription: {
        model: "whisper-1"
      },
      turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500
      },
      tools: tools || [],
      temperature: 0.8,
      max_response_output_tokens: 4096
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI session creation failed: ${error}`);
  }

  const session = await response.json();
  return { sessionId: session.id, session };
}

/**
 * Build agent instructions based on locale and context
 */
function buildInstructions(locale: string, userContext?: any): string {
  const baseInstructions = {
    en: `You are EasyMO, a helpful AI assistant for mobility, marketplace, and service requests in Rwanda.
Be conversational, friendly, and concise. Ask clarifying questions when needed.
Always confirm important details before taking actions.`,
    
    sw: `Wewe ni EasyMO, msaidizi wa AI wa kusaidia usafiri, soko, na maombi ya huduma nchini Rwanda.
Kuwa wa mazungumzo, rafiki, na mfupi. Uliza maswali ya kufafanua inapohitajika.
Thibitisha maelezo muhimu kabla ya kuchukua hatua.`,
    
    fr: `Vous êtes EasyMO, un assistant IA utile pour la mobilité, le marché et les demandes de services au Rwanda.
Soyez conversationnel, amical et concis. Posez des questions de clarification si nécessaire.
Confirmez toujours les détails importants avant d'agir.`,
    
    rw: `Uri EasyMO, umufasha wa AI ufasha mu gutwara abantu, isoko, n'ibisabwa bya serivisi mu Rwanda.
Kugira ngo uganire, ukagire ubucuti, kandi ukagere ku ngingo. Baza ibibazo bisobanura iyo bikenewe.
Emeza burundu amakuru y'ingenzi mbere yo gufata ingamba.`
  };

  return baseInstructions[locale as keyof typeof baseInstructions] || baseInstructions.en;
}

/**
 * Available tools for the agent
 */
const AGENT_TOOLS = [
  {
    type: "function",
    name: "search_services",
    description: "Search for available services (transport, marketplace items, etc.)",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "What the user is looking for"
        },
        category: {
          type: "string",
          enum: ["transport", "marketplace", "food", "shopping", "services"],
          description: "Service category"
        },
        location: {
          type: "string",
          description: "User's location or destination"
        }
      },
      required: ["query"]
    }
  },
  {
    type: "function",
    name: "book_transport",
    description: "Book a transport service (moto, car, bus)",
    parameters: {
      type: "object",
      properties: {
        vehicle_type: {
          type: "string",
          enum: ["moto", "car", "bus"],
          description: "Type of vehicle"
        },
        pickup_location: {
          type: "string",
          description: "Pickup location"
        },
        dropoff_location: {
          type: "string",
          description: "Destination"
        },
        passengers: {
          type: "integer",
          description: "Number of passengers",
          default: 1
        }
      },
      required: ["vehicle_type", "pickup_location", "dropoff_location"]
    }
  },
  {
    type: "function",
    name: "transfer_to_human",
    description: "Transfer the call to a human agent when the AI cannot help",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Why the transfer is needed"
        },
        department: {
          type: "string",
          enum: ["support", "sales", "technical"],
          description: "Which department to transfer to"
        }
      },
      required: ["reason"]
    }
  }
];

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const supabase = getServiceClient();

  // =====================================================
  // ROUTE: POST /openai-realtime - Create session
  // =====================================================
  if (req.method === "POST" && url.pathname === "/openai-realtime") {
    try {
      const body = await req.json();
      const { callSid, from, to, locale = "en" } = body;

      if (!callSid || !from || !to) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: callSid, from, to" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Create call record
      const { data: call, error: callError } = await supabase
        .from("voice_calls")
        .insert({
          mtn_call_sid: callSid,
          direction: "inbound",
          from_e164: from,
          to_e164: to,
          locale,
          status: "in_progress"
        })
        .select()
        .single();

      if (callError) throw callError;

      // Create OpenAI Realtime session
      const instructions = buildInstructions(locale);
      const { sessionId, session } = await createRealtimeSession(
        call.id,
        instructions,
        "alloy",
        AGENT_TOOLS
      );

      // Store session details
      await supabase.from("openai_sessions").insert({
        call_id: call.id,
        session_id: sessionId,
        model: session.model,
        voice: session.voice,
        instructions,
        modalities: session.modalities,
        input_audio_format: session.input_audio_format,
        output_audio_format: session.output_audio_format,
        turn_detection: session.turn_detection,
        tools: AGENT_TOOLS,
        temperature: session.temperature,
        max_response_output_tokens: session.max_response_output_tokens,
        status: "active",
        metadata: { callSid, from, to }
      });

      // Log session created event
      await supabase.from("voice_events").insert({
        call_id: call.id,
        type: "openai_session_created",
        payload: { sessionId, model: session.model }
      });

      return new Response(
        JSON.stringify({
          success: true,
          callId: call.id,
          sessionId,
          ephemeralKey: session.client_secret.value
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

    } catch (error) {
      await logStructuredEvent("ERROR", { data: "Error creating OpenAI session:", error });
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // =====================================================
  // ROUTE: POST /openai-realtime/events - Handle events
  // =====================================================
  if (req.method === "POST" && url.pathname === "/openai-realtime/events") {
    try {
      const body = await req.json();
      const { callId, event } = body;

      if (!callId || !event) {
        return new Response(
          JSON.stringify({ error: "Missing callId or event" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Log the event
      await supabase.from("voice_events").insert({
        call_id: callId,
        type: event.type,
        payload: event
      });

      // Handle specific event types
      switch (event.type) {
        case "conversation.item.input_audio_transcription.completed":
          // Store transcript
          await supabase.from("transcripts").insert({
            call_id: callId,
            role: "user",
            content: event.transcript,
            lang: event.language
          });
          break;

        case "response.audio_transcript.done":
          // Store assistant response
          await supabase.from("transcripts").insert({
            call_id: callId,
            role: "assistant",
            content: event.transcript
          });
          break;

        case "response.function_call_arguments.done":
          // Store tool call
          await supabase.from("mcp_tool_calls").insert({
            call_id: callId,
            server: "openai_realtime",
            tool: event.name,
            args: event.arguments,
            success: null // Will be updated when result comes
          });
          break;

        case "error":
          await logStructuredEvent("ERROR", { data: "OpenAI error:", event });
          await supabase.from("voice_calls").update({
            status: "failed"
          }).eq("id", callId);
          break;
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

    } catch (error) {
      await logStructuredEvent("ERROR", { data: "Error handling event:", error });
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // =====================================================
  // ROUTE: POST /openai-realtime/end - End session
  // =====================================================
  if (req.method === "POST" && url.pathname === "/openai-realtime/end") {
    try {
      const body = await req.json();
      const { callId, duration } = body;

      if (!callId) {
        return new Response(
          JSON.stringify({ error: "Missing callId" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Update call record
      await supabase.from("voice_calls").update({
        status: "completed",
        ended_at: new Date().toISOString(),
        duration_seconds: duration
      }).eq("id", callId);

      // Update session
      await supabase.from("openai_sessions").update({
        status: "completed",
        ended_at: new Date().toISOString()
      }).eq("call_id", callId);

      // Log end event
      await supabase.from("voice_events").insert({
        call_id: callId,
        type: "call_ended",
        payload: { duration }
      });

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

    } catch (error) {
      await logStructuredEvent("ERROR", { data: "Error ending call:", error });
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // =====================================================
  // ROUTE: GET /openai-realtime/health
  // =====================================================
  if (req.method === "GET" && url.pathname === "/openai-realtime/health") {
    return new Response(
      JSON.stringify({
        status: "ok",
        service: "openai-realtime-mtn-sip",
        timestamp: new Date().toISOString(),
        features: {
          mtn_sip: "active",
          openai_realtime: "active"
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ error: "Not found" }),
    { status: 404, headers: { "Content-Type": "application/json" } }
  );
});
