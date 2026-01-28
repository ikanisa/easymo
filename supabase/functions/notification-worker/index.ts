import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { logStructuredEvent } from "../_shared/observability.ts";
import { emitAlert } from "../_shared/observability.ts";
import {
  recordDurationMetric,
  recordGauge,
  recordMetric,
} from "../_shared/observability.ts";
import { supabase as sharedSupabase } from "../_shared/wa-webhook-shared/config.ts";
import { claimWorkerLease, releaseWorkerLease } from "./lease.ts";
import { processNotificationQueue } from "./notify-sender.ts";

const BATCH_SIZE = 20;
const CRON_EXPR = "*/1 * * * *"; // once per minute
const denoWithCron = Deno as typeof Deno & {
  cron?: (
    name: string,
    schedule: string,
    handler: () => void | Promise<void>,
  ) => void;
};
const CRON_ENV = (Deno.env.get("NOTIFICATION_WORKER_CRON_ENABLED") ?? "")
  .toLowerCase();
const CRON_ENABLED = CRON_ENV === "true";

let running = false;

async function runNotificationWorker(trigger: "http" | "cron") {
  if (running) {
    await logStructuredEvent("NOTIFY_WORKER_SKIP", { trigger, reason: "busy" });
    return;
  }
  running = true;
  let leaseAcquired = false;
  const started = Date.now();
  try {
    const hasLease = await claimWorkerLease(trigger);
    if (!hasLease) {
      return;
    }
    leaseAcquired = true;
    await logStructuredEvent("NOTIFY_WORKER_START", { trigger });
    const results = await processNotificationQueue(BATCH_SIZE);
    await recordMetric("notification_worker_processed_total", results.length, {
      trigger,
    });
    await logStructuredEvent("NOTIFY_WORKER_DONE", {
      trigger,
      processed: results.length,
      duration_ms: Date.now() - started,
    });
    await recordDurationMetric("notification_worker_latency_ms", started, {
      trigger,
      processed: results.length,
    });
    await publishNotificationQueueDepth(trigger);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : String(error ?? "unknown_error");
    await logStructuredEvent("ERROR", { data: "notification-worker.run_failed", error });
    await emitAlert("NOTIFY_WORKER_ERROR", {
      trigger,
      error: message,
    });
    await recordMetric("notification_worker_failures_total", 1, {
      trigger,
      reason: message,
    });
    throw new Error(message);
  } finally {
    if (leaseAcquired) {
      try {
        await releaseWorkerLease();
      } catch (releaseError) {
        await logStructuredEvent("ERROR", { data: "notification-worker.release_failed", releaseError });
      }
    }
    running = false;
  }
}

async function publishNotificationQueueDepth(trigger: "http" | "cron") {
  try {
    const { count, error } = await sharedSupabase
      .from("notifications")
      .select("id", { head: true, count: "exact" })
      .eq("status", "queued");
    if (error) {
      await logStructuredEvent("ERROR", { data: "notification-worker.queue_depth_fail", error });
      return;
    }
    await recordGauge("notification_queue_depth", count ?? 0, { trigger });
  } catch (error) {
    await logStructuredEvent("ERROR", { data: "notification-worker.queue_depth_error", error });
  }
}

serve(async (_req) => {
  try {
    await runNotificationWorker("http");
    return new Response(
      JSON.stringify({ ok: true, cronEnabled: CRON_ENABLED }),
      {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      },
    );
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : String(error ?? "unknown_error");
    return new Response(message, { status: 500 });
  }
});

if (typeof denoWithCron.cron === "function") {
  if (CRON_ENABLED) {
    denoWithCron.cron("notification-worker", CRON_EXPR, async () => {
      try {
        await runNotificationWorker("cron");
      } catch (error) {
        await logStructuredEvent("ERROR", { data: "notification-worker.cron", error });
        await emitAlert("NOTIFY_CRON_FAIL", {
          error: error instanceof Error
            ? error.message
            : String(error ?? "unknown"),
          schedule: CRON_EXPR,
        });
      }
    });
    await logStructuredEvent("NOTIFY_CRON_STATUS", {
      enabled: true,
      schedule: CRON_EXPR,
    });
  } else {
    console.warn(
      "notification-worker cron disabled (set NOTIFICATION_WORKER_CRON_ENABLED=true to enable scheduling)",
    );
    await logStructuredEvent("NOTIFY_CRON_STATUS", {
      enabled: false,
      schedule: CRON_EXPR,
    });
    await emitAlert("NOTIFY_CRON_DISABLED", { schedule: CRON_EXPR });
  }
} else {
  if (CRON_ENABLED) {
    await logStructuredEvent("WARNING", { data: "notification-worker cron not available in this runtime" });
    await emitAlert("NOTIFY_CRON_UNSUPPORTED", { schedule: CRON_EXPR });
  }
}
