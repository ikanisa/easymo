/**
 * Supabase Edge Function: call-webhook
 * 
 * Accepts POST requests with call metadata, transcripts, and intents,
 * and stores them in the Supabase database.
 * 
 * Expected payload:
 * {
 *   callSid: string,
 *   from: string,
 *   to: string,
 *   direction: string,
 *   transcript?: string,
 *   intent?: string,
 *   metadata?: object
 * }
 * 
 * Tables used:
 * - calls: Main call records
 * - call_events: Individual events during calls
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface CallWebhookPayload {
  callSid: string;
  from: string;
  to: string;
  direction: string;
  transcript?: string;
  intent?: string;
  metadata?: Record<string, any>;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse request body
    const payload: CallWebhookPayload = await req.json();

    // Validate required fields
    if (!payload.callSid || !payload.from || !payload.to) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: callSid, from, to",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Upsert call record
    const { error: callError } = await supabase
      .from("calls")
      .upsert(
        {
          call_sid: payload.callSid,
          from_number: payload.from,
          to_number: payload.to,
          direction: payload.direction,
          transcript: payload.transcript || null,
          intent: payload.intent || null,
          meta: payload.metadata || {},
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "call_sid",
        },
      );

    if (callError) {
      console.error("Error upserting call:", callError);
      return new Response(
        JSON.stringify({
          error: "Failed to store call record",
          details: callError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Insert call event
    const { error: eventError } = await supabase
      .from("call_events")
      .insert({
        call_sid: payload.callSid,
        event_type: "webhook",
        payload: payload.metadata || {},
        created_at: new Date().toISOString(),
      });

    if (eventError) {
      console.error("Error inserting call event:", eventError);
      // Don't fail the request if event logging fails
    }

    // Log structured event
    console.log(
      JSON.stringify({
        event: "CALL_WEBHOOK_PROCESSED",
        timestamp: new Date().toISOString(),
        callSid: payload.callSid,
        from: payload.from,
        to: payload.to,
        direction: payload.direction,
        hasTranscript: Boolean(payload.transcript),
        hasIntent: Boolean(payload.intent),
      }),
    );

    return new Response(
      JSON.stringify({
        success: true,
        callSid: payload.callSid,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
