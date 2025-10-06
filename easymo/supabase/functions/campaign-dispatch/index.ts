// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
/** ========= ENV (reuse existing secrets) ========= */ const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const WA_TOKEN = Deno.env.get("WA_TOKEN");
const WA_PHONE_ID = Deno.env.get("WA_PHONE_ID");
const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});
const WA_BASE = `https://graph.facebook.com/v20.0/${WA_PHONE_ID}`;
/** ========= WhatsApp send helpers ========= */ async function waSendMessages(
  body,
) {
  const res = await fetch(`${WA_BASE}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {
      raw: text,
    };
  }
  if (!res.ok) {
    const err = new Error(`WA send failed: ${res.status} ${res.statusText}`);
    err.response = json;
    throw err;
  }
  return json;
}
function buildWARequest(to, p) {
  if (p.kind === "TEXT") {
    return {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: {
        body: p.text,
      },
    };
  }
  if (p.kind === "TEMPLATE") {
    return {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: p.name,
        language: {
          code: p.language_code,
        },
        components: p.components || [],
      },
    };
  }
  if (p.kind === "INTERACTIVE") {
    return {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: p.interactive,
    };
  }
  throw new Error("Unsupported payload.kind");
}
/** ========= Backoff helper =========
 * attempt starts at 0. Backoff seconds: 15, 30, 60, 120, 300 (cap)
 */ function backoffSeconds(attempt) {
  const seq = [
    15,
    30,
    60,
    120,
    300,
  ];
  return seq[Math.min(attempt, seq.length - 1)];
}
const LOCK_WINDOW_MS = 5 * 60 * 1000;

async function claimJob(job) {
  const lockUntil = new Date(Date.now() + LOCK_WINDOW_MS).toISOString();
  const { data, error } = await sb.from("send_queue")
    .update({ next_attempt_at: lockUntil })
    .eq("id", job.id)
    .eq("status", "PENDING")
    .lte("next_attempt_at", new Date().toISOString())
    .select("id,campaign_id,msisdn_e164,payload,attempt,status")
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

async function fetchCandidates(limit: number) {
  const { data, error } = await sb.from("send_queue")
    .select("id,campaign_id,msisdn_e164,payload,attempt,next_attempt_at,status")
    .eq("status", "PENDING")
    .lte("next_attempt_at", new Date().toISOString())
    .order("id", { ascending: true })
    .limit(limit * 3);
  if (error) throw error;
  return data ?? [];
}

/** ========= Process a batch ========= */ async function processBatch(
  limit = 40,
) {
  const candidates = await fetchCandidates(limit);
  const claimed: typeof candidates = [];
  for (const candidate of candidates) {
    if (claimed.length >= limit) break;
    const locked = await claimJob(candidate);
    if (locked) claimed.push(locked);
  }

  let sent = 0, failed = 0, scheduled = 0;

  for (const job of claimed) {
    const to = job.msisdn_e164;
    const attempt = job.attempt ?? 0;
    const payload = typeof job.payload === "string"
      ? JSON.parse(job.payload)
      : job.payload;
    try {
      const reqBody = buildWARequest(to, payload);
      const res = await waSendMessages(reqBody);
      const providerId = res?.messages?.[0]?.id ?? res?.message_id ?? res?.id ??
        null;
      // success → mark SENT
      await sb.from("send_queue").update({
        status: "SENT",
        attempt: attempt + 1,
        next_attempt_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);
      await sb.from("send_logs").insert({
        queue_id: job.id,
        campaign_id: job.campaign_id,
        msisdn_e164: to,
        provider_msg_id: providerId,
        delivery_status: "SENT",
      });
      sent++;
    } catch (e) {
      const nextInSec = backoffSeconds(attempt);
      const next = new Date(Date.now() + nextInSec * 1000).toISOString();
      const maxAttempts = 5;
      const willFail = attempt + 1 >= maxAttempts;
      await sb.from("send_queue").update({
        attempt: attempt + 1,
        next_attempt_at: willFail ? new Date().toISOString() : next,
        status: willFail ? "FAILED" : "PENDING",
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);
      await sb.from("send_logs").insert({
        queue_id: job.id,
        campaign_id: job.campaign_id,
        msisdn_e164: to,
        provider_msg_id: null,
        delivery_status: willFail ? "FAILED" : "PENDING",
        error:
          (e?.response ? JSON.stringify(e.response).slice(0, 800) : String(e))
            .slice(0, 800),
      });
      if (willFail) failed++;
      else scheduled++;
    }
  }
  return {
    picked: claimed.length,
    sent,
    failed,
    retry_scheduled: scheduled,
  };
}
/** ========= HTTP handler (cron or manual) ========= */ Deno.serve(
  async (_req) => {
    try {
      const result = await processBatch(40);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (e) {
      return new Response(
        JSON.stringify({
          error: String(e),
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }
  },
);
