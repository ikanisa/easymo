import { serve } from "$std/http/server.ts";
import { getServiceClient } from "shared/supabase.ts";
import { logStructuredEvent } from "../_shared/observability.ts";

const supabase = getServiceClient();

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json(204, {});
  const startedAt = Date.now();
  try {
    // Fetch due requests (queued or scheduled in the past)
    const nowIso = new Date().toISOString();
    const { data: requests, error } = await supabase
      .from('campaign_requests')
      .select('id, channel, content, send_time, status')
      .in('status', ['queued','scheduled'])
      .lte('send_time', nowIso)
      .limit(25);
    if (error) return json(500, { error: error.message });

    let processed = 0;
    for (const reqRow of requests || []) {
      try {
        // TODO: Enqueue to downstream channel workers
        await logStructuredEvent('CAMPAIGN_DISPATCHED', {
          id: reqRow.id,
          channel: reqRow.channel,
        });
        await supabase
          .from('campaign_requests')
          .update({ status: 'sent', metadata: { dispatched_at: new Date().toISOString() } })
          .eq('id', reqRow.id);
        processed++;
      } catch (e) {
        await supabase
          .from('campaign_requests')
          .update({ status: 'failed', metadata: { error: (e as Error).message } })
          .eq('id', reqRow.id);
      }
    }
    return json(200, { success: true, processed, duration_ms: Date.now() - startedAt });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});

