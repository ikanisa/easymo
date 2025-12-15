import { supabase } from "../config.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const EVENTS_TTL_DAYS = Math.max(
  Number(Deno.env.get("WA_EVENTS_TTL_DAYS") ?? "30") || 30,
  1,
);
const LOGS_TTL_DAYS = Math.max(
  Number(Deno.env.get("WA_WEBHOOK_LOGS_TTL_DAYS") ?? "14") || 14,
  1,
);
const RETENTION_INTERVAL_MS = Math.max(
  Number(
    Deno.env.get("WA_RETENTION_INTERVAL_MS") ?? String(6 * 60 * 60 * 1000),
  ) ||
    6 * 60 * 60 * 1000,
  5 * 60 * 1000,
);

let lastRun = 0;
let inFlight: Promise<void> | null = null;

export async function maybeRunRetention(): Promise<void> {
  const now = Date.now();
  if (inFlight) {
    return inFlight;
  }
  if (lastRun && now - lastRun < RETENTION_INTERVAL_MS) {
    return;
  }
  inFlight = runRetention()
    .catch((error) => {
      logStructuredEvent("RETENTION_RUN_FAILED", {
        error: error instanceof Error ? error.message : String(error),
      }, "error");
    })
    .finally(() => {
      lastRun = Date.now();
      inFlight = null;
    });
  await inFlight;
}

async function runRetention(): Promise<void> {
  await Promise.all([
    purgeWaEvents(),
    purgeWebhookLogs(),
  ]);
}

async function purgeWaEvents(): Promise<void> {
  const cutoffIso = new Date(Date.now() - EVENTS_TTL_DAYS * DAY_MS)
    .toISOString();
  const query = supabase
    .from("wa_events")
    .delete({ count: "exact" });
  const lt = (query as { lt?: (column: string, value: string) => typeof query }).lt;
  if (!lt) {
    logStructuredEvent("RETENTION_WA_EVENTS_SKIP", {
      reason: "lt not supported by client stub",
    }, "warn");
    return;
  }
  const { error, count } = await lt.call(query, "created_at", cutoffIso);
  if (error) {
    logStructuredEvent("RETENTION_WA_EVENTS_FAIL", {
      error: error.message,
    }, "error");
    return;
  }
  if (count && count > 0) {
    await logStructuredEvent("RETENTION_WA_EVENTS_PURGED", {
      removed: count,
      cutoff: cutoffIso,
    });
  }
}

async function purgeWebhookLogs(): Promise<void> {
  const cutoffIso = new Date(Date.now() - LOGS_TTL_DAYS * DAY_MS).toISOString();
  const query = supabase
    .from("webhook_logs")
    .delete({ count: "exact" });
  const lt = (query as { lt?: (column: string, value: string) => typeof query }).lt;
  if (!lt) {
    logStructuredEvent("RETENTION_WEBHOOK_LOGS_SKIP", {
      reason: "lt not supported by client stub",
    }, "warn");
    return;
  }
  const { error, count } = await lt.call(query, "received_at", cutoffIso);
  if (error) {
    logStructuredEvent("RETENTION_WEBHOOK_LOGS_FAIL", {
      error: error.message,
    }, "error");
    return;
  }
  if (count && count > 0) {
    await logStructuredEvent("RETENTION_WEBHOOK_LOGS_PURGED", {
      removed: count,
      cutoff: cutoffIso,
    });
  }
}
