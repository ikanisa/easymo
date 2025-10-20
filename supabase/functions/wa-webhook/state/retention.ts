import { supabase } from "../config.ts";
import { logStructuredEvent } from "../observe/log.ts";

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
      console.error("retention.run_failed", error);
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
  const { error, count } = await supabase
    .from("wa_events")
    .delete({ count: "exact" })
    .lt("created_at", cutoffIso);
  if (error) {
    console.error("retention.wa_events_fail", error);
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
  const { error, count } = await supabase
    .from("webhook_logs")
    .delete({ count: "exact" })
    .lt("received_at", cutoffIso);
  if (error) {
    console.error("retention.webhook_logs_fail", error);
    return;
  }
  if (count && count > 0) {
    await logStructuredEvent("RETENTION_WEBHOOK_LOGS_PURGED", {
      removed: count,
      cutoff: cutoffIso,
    });
  }
}
