import { serve } from "$std/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { logStructuredEvent } from "../_shared/observability.ts";

const WA_TOKEN = Deno.env.get('WA_TOKEN') || Deno.env.get('WHATSAPP_ACCESS_TOKEN') || '';
const WA_PHONE_ID = Deno.env.get('WA_PHONE_ID') || Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || '';
const GRAPH_BASE = 'https://graph.facebook.com/v20.0';

async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const res = await fetch(`${GRAPH_BASE}/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`WA send failed ${res.status}: ${t}`);
  }
}

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
        if (reqRow.channel === 'whatsapp') {
          const content = reqRow.content || {};
          const text: string = String(content.text || content.body || '').trim();
          if (!text) throw new Error('missing_text');
          // Resolve recipients — for now: all profiles (demo). In production, resolve by segment_id.
          const { data: recips } = await supabase
            .from('profiles')
            .select('whatsapp_e164')
            .not('whatsapp_e164', 'is', null)
            .limit(50);
          const recipients = (recips || []).map((r) => r.whatsapp_e164).filter(Boolean) as string[];
          if (!recipients.length) throw new Error('no_recipients');
          let sent = 0;
          for (const to of recipients) {
            await sendWhatsAppText(to, text);
            sent++;
          }
          await logStructuredEvent('CAMPAIGN_DISPATCHED', { id: reqRow.id, channel: reqRow.channel, sent });
          await supabase
            .from('campaign_requests')
            .update({ status: 'sent', metadata: { ...(reqRow.metadata || {}), dispatched_at: new Date().toISOString(), sent } })
            .eq('id', reqRow.id);
          processed++;
        } else {
          // For other channels, mark as sent placeholder
          await logStructuredEvent('CAMPAIGN_DISPATCHED', { id: reqRow.id, channel: reqRow.channel, note: 'placeholder_sent' });
          await supabase
            .from('campaign_requests')
            .update({ status: 'sent', metadata: { ...(reqRow.metadata || {}), dispatched_at: new Date().toISOString() } })
            .eq('id', reqRow.id);
          processed++;
        }
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
