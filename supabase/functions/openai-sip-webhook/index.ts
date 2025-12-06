import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const OPENAI_WEBHOOK_SECRET = Deno.env.get("OPENAI_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface SIPHeader {
  name: string;
  value: string;
}

interface RealtimeCallIncoming {
  object: "event";
  id: string;
  type: "realtime.call.incoming";
  created_at: number;
  data: {
    call_id: string;
    sip_headers: SIPHeader[];
  };
}

serve(async (req) => {
  try {
    if (req.method === "GET") {
      return new Response("OpenAI SIP Webhook - OK", { status: 200 });
    }

    const body = await req.json() as RealtimeCallIncoming;
    
    if (body.type !== "realtime.call.incoming") {
      return new Response(JSON.stringify({ error: "Invalid event type" }), { status: 400 });
    }

    const { call_id, sip_headers } = body.data;
    
    const fromHeader = sip_headers.find(h => h.name === "From");
    const toHeader = sip_headers.find(h => h.name === "To");
    
    const fromNumber = fromHeader?.value.match(/\+?(\d+)/)?.[1] || "unknown";
    const toNumber = toHeader?.value.match(/\+?(\d+)/)?.[1] || "unknown";

    console.log(`Incoming SIP call: ${call_id} from ${fromNumber} to ${toNumber}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, preferred_language")
      .eq("phone", fromNumber)
      .single();

    const userName = profile?.name || "there";
    const language = profile?.preferred_language || "en";

    const acceptPayload = {
      type: "realtime",
      model: "gpt-4o-realtime-preview-2024-12-17",
      voice: "alloy",
      instructions: `You are EasyMO Call Center AI speaking with ${userName}. 
Keep responses SHORT (1-2 sentences). You handle:
- Rides: Schedule trips, track drivers
- Real Estate: Search properties, schedule viewings  
- Jobs: Find listings, apply for positions
- Business: List on marketplace, manage inventory
- Insurance: Get quotes, file claims
- Legal: Find lawyers, schedule consultations
- Pharmacy: Find medications, locate pharmacies

Ask clarifying questions. Be friendly and efficient.`,
      turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500
      },
      input_audio_transcription: {
        model: "whisper-1"
      }
    };

    const acceptResponse = await fetch(
      `https://api.openai.com/v1/realtime/calls/${call_id}/accept`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(acceptPayload)
      }
    );

    if (!acceptResponse.ok) {
      const error = await acceptResponse.text();
      console.error(`Failed to accept call: ${error}`);
      return new Response(JSON.stringify({ error: "Failed to accept call" }), { status: 500 });
    }

    await supabase.from("call_summaries").insert({
      call_id,
      from_number: fromNumber,
      to_number: toNumber,
      status: "accepted",
      language
    });

    console.log(`Call ${call_id} accepted successfully`);

    return new Response(JSON.stringify({ status: "accepted", call_id }), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error handling SIP webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
