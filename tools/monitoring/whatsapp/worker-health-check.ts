#!/usr/bin/env -S deno run --allow-env --allow-net
/**
 * Synthetic health monitor for the WhatsApp webhook worker.
 *
 * Usage:
 *   WHATSAPP_WORKER_HEALTH_URL=https://worker.example.com/health \
 *   deno run --allow-env --allow-net tools/monitoring/whatsapp/worker-health-check.ts
 */

const healthUrl = Deno.env.get("WHATSAPP_WORKER_HEALTH_URL");
if (!healthUrl) {
  console.error("Missing WHATSAPP_WORKER_HEALTH_URL environment variable.");
  Deno.exit(1);
}

let response: Response;
try {
  response = await fetch(healthUrl, { headers: { "accept": "application/json" } });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`❌ Network error contacting ${healthUrl}: ${message}`);
  Deno.exit(1);
}

let payload: any;
try {
  payload = await response.json();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`❌ Failed to parse JSON response (${response.status}): ${message}`);
  Deno.exit(1);
}

const failures: string[] = [];
if (response.status !== 200) {
  failures.push(`HTTP ${response.status}`);
}

const status: string | undefined = payload?.status;
if (status !== "ok") {
  failures.push(`overall status=${status}`);
}

const checks = payload?.checks ?? {};
for (const [name, result] of Object.entries(checks)) {
  if (result?.status !== "ok") {
    const reason = result?.error ?? "no error provided";
    const code = typeof result?.statusCode === "number" ? ` (status ${result.statusCode})` : "";
    failures.push(`${name}=${result?.status ?? "unknown"}${code}: ${reason}`);
  }
}

const success = failures.length === 0;
const failureReason = failures.join("; ");
const jobLabel = 'job="whatsapp-webhook-worker-health"';
const reasonLabel = failureReason
  ? `,failure_reason="${failureReason.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
  : "";

console.log("# TYPE probe_success gauge");
console.log(`probe_success{${jobLabel}${reasonLabel}} ${success ? 1 : 0}`);

if (!success) {
  console.log(`# ❌ WhatsApp worker health degraded: ${failureReason}`);
  console.log(`# Payload: ${JSON.stringify(payload)}`);
  Deno.exit(1);
}

const openaiLatency = checks.openai?.latencyMs ?? "?";
const redisLatency = checks.redis?.latencyMs ?? "?";
const supabaseLatency = checks.supabase?.latencyMs ?? "?";

console.log(
  `# ✅ WhatsApp worker healthy (OpenAI=${openaiLatency}ms, Redis=${redisLatency}ms, Supabase=${supabaseLatency}ms)`
);
Deno.exit(0);
