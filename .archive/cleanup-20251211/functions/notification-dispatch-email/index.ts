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
import { processEmailJob } from "../_shared/notification-handlers.ts";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type, x-signature, x-timestamp",
};

const sendResendEmail = async ({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}) => {
  const apiKey = requireEnv("RESEND_API_KEY");
  const from = requireEnv("MFA_EMAIL_FROM");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, text }),
  });

  const error = response.ok ? undefined : await response.text().catch(() => "");
  if (!response.ok) {
    console.error("notification.email.send_failed", { status: response.status, error });
  }
  return { ok: response.ok, status: response.status, error };
};

serveWithObservability("notification-dispatch-email", async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const validation = await validateHmacRequest(req);
  if (!validation.ok) {
    console.warn("notification-dispatch-email.invalid_signature", { reason: validation.reason });
    const status = validation.reason === "stale_timestamp" ? 408 : 401;
    return new Response(JSON.stringify({ success: false, error: "invalid_signature" }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
      status,
    });
  }

  const supabase = createServiceClient();
  const jobs = await claimNotificationJobs(supabase, "EMAIL", { limit: 10 });
  const maxAttempts = getMaxNotificationAttempts();
  const results: Array<{ id: string; outcome: string; detail?: string }> = [];

  for (const job of jobs) {
    try {
      const outcome = await processEmailJob(job, {
        rateLimit: (bucket, options) => enforceRateLimit(supabase, bucket, options),
        send: sendResendEmail,
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
      console.error("notification.email.processing_error", { id: job.id, error });
      const retryAt = computeNextRetryAt(job.attempts);
      await scheduleJobRetry(supabase, job.id, retryAt, "unhandled_exception");
      results.push({ id: job.id, outcome: "retry", detail: "unhandled_exception" });
    }
  }

  return new Response(JSON.stringify({ success: true, processed: jobs.length, results }), {
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
});
