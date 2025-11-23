import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";

const supabase = getServiceClient();

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json(204, {});
  try {
    const { businessId, segmentId, content, sendTime } = await req.json();

    if (!content || typeof content !== "object") {
      return json(400, { error: "invalid_content" });
    }

    const payload = {
      business_id: businessId ?? null,
      channel: 'whatsapp' as const,
      segment_id: segmentId ?? null,
      content,
      send_time: sendTime ?? null,
      status: sendTime ? 'scheduled' : 'queued',
      metadata: { requested_at: new Date().toISOString() },
    };

    const { data, error } = await supabase
      .from('campaign_requests')
      .insert(payload)
      .select('id, status, send_time')
      .single();
    if (error) return json(500, { error: error.message });
    return json(200, { success: true, request: data });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});

