import { validateHmacRequest } from "../_shared/auth.ts";
import { createServiceClient, requireEnv } from "../_shared/mod.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";
import { writeAuditLog } from "../_shared/audit.ts";
import { serveWithObservability } from "../_shared/observability.ts";
import {
  claimNotificationJobs,
  computeNextRetryAt,
  getMaxNotificationAttempts,
  markJobDelivered,
  markJobFailed,
  scheduleJobRetry,
} from "../_shared/notifications.ts";
import { processWhatsappJob } from "../_shared/notification-handlers.ts";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type, x-signature, x-timestamp",
};

const fetchTemplate = async (
  supabase: ReturnType<typeof createServiceClient>,
  templateId: string
) => {
  const { data, error } = await supabase
    .from("sms_templates")
    .select("id, body, sacco_id, tokens, is_active")
    .eq("id", templateId)
    .maybeSingle();
  if (error) {
    console.error("notification.whatsapp.fetch_template_failed", { templateId, error });
    return null;
  }
  return data ?? null;
};

const fetchPayment = async (
  supabase: ReturnType<typeof createServiceClient>,
  paymentId: string
) => {
  const { data, error } = await supabase
    .from("payments")
    .select("id, sacco_id, msisdn, amount, currency, reference, occurred_at")
    .eq("id", paymentId)
    .maybeSingle();
  if (error) {
    console.error("notification.whatsapp.fetch_payment_failed", { paymentId, error });
    return null;
  }
  return data ?? null;
};

const sendWhatsapp = async ({ to, body }: { to: string; body: string }) => {
  const accessToken = requireEnv("META_WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = requireEnv("META_WHATSAPP_PHONE_NUMBER_ID");

  // Meta WhatsApp Business API endpoint
  const apiUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

  // Format phone number (remove whatsapp: prefix if present)
  const recipientPhone = to.startsWith("whatsapp:") ? to.slice(9) : to;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: recipientPhone,
      type: "text",
      text: { body },
    }),
  });

  const error = response.ok ? undefined : await response.text().catch(() => "");
  if (!response.ok) {
    console.error("notification.whatsapp.send_failed", { status: response.status, error });
  }
  return { ok: response.ok, status: response.status, error };
};

serveWithObservability("notification-dispatch-whatsapp", async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const validation = await validateHmacRequest(req);
  if (!validation.ok) {
    console.warn("notification-dispatch-whatsapp.invalid_signature", { reason: validation.reason });
    const status = validation.reason === "stale_timestamp" ? 408 : 401;
    return new Response(JSON.stringify({ success: false, error: "invalid_signature" }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
      status,
    });
  }

  const supabase = createServiceClient();
  const jobs = await claimNotificationJobs(supabase, "WHATSAPP", { limit: 10 });
  const maxAttempts = getMaxNotificationAttempts();
  const results: Array<{ id: string; outcome: string; detail?: string }> = [];

  for (const job of jobs) {
    try {
      const outcome = await processWhatsappJob(job, {
        fetchTemplate: (id) => fetchTemplate(supabase, id),
        fetchPayment: (id) => fetchPayment(supabase, id),
        rateLimit: (bucket, options) => enforceRateLimit(supabase, bucket, options),
        send: sendWhatsapp,
        audit: (entry) => writeAuditLog(supabase, entry),
      });

      if (outcome.type === "success") {
        await markJobDelivered(supabase, job.id);
      } else if (outcome.type === "retry") {
        if (job.attempts >= maxAttempts) {
          await markJobFailed(supabase, job.id, `${outcome.detail}:max_attempts`);
        } else {
          const retryAt = outcome.retryAt ?? computeNextRetryAt(job.attempts);
          await scheduleJobRetry(supabase, job.id, retryAt, outcome.detail);
        }
      } else {
        await markJobFailed(supabase, job.id, outcome.detail);
      }

      results.push({ id: job.id, outcome: outcome.type, detail: outcome.detail });
    } catch (error) {
      console.error("notification.whatsapp.processing_error", { id: job.id, error });
      const retryAt = computeNextRetryAt(job.attempts);
      await scheduleJobRetry(supabase, job.id, retryAt, "unhandled_exception");
      results.push({ id: job.id, outcome: "retry", detail: "unhandled_exception" });
    }
  }

  return new Response(JSON.stringify({ success: true, processed: jobs.length, results }), {
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
});
