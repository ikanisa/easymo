import { logStructuredEvent } from "../_shared/observability.ts";
import { supabase } from "../_shared/wa-webhook-shared/config.ts";

const WORKER_ID = crypto.randomUUID();
const DEFAULT_LEASE_SECONDS = Math.max(
  Number(Deno.env.get("NOTIFY_WORKER_LEASE_SECONDS") ?? "180") || 180,
  60,
);

type ClaimResponse = {
  granted: boolean;
  holder: string | null;
  expires_at: string | null;
};

export async function claimWorkerLease(
  trigger: "http" | "cron",
): Promise<boolean> {
  const { data, error } = await supabase.rpc("claim_notification_worker", {
    worker_id: WORKER_ID,
    ttl_seconds: DEFAULT_LEASE_SECONDS,
  });
  if (error) {
    console.error("notification-worker.lease_error", error);
    throw error;
  }

  const result = normalizeResult(data);
  if (!result.granted) {
    await logStructuredEvent("NOTIFY_WORKER_SKIP", {
      trigger,
      reason: "locked",
      holder: result.holder,
      expires_at: result.expires_at,
    });
  }
  return result.granted;
}

export async function releaseWorkerLease(): Promise<void> {
  const { error } = await supabase.rpc("release_notification_worker", {
    worker_id: WORKER_ID,
  });
  if (error) {
    console.error("notification-worker.release_error", error);
    throw error;
  }
}

function normalizeResult(data: unknown): ClaimResponse {
  if (Array.isArray(data) && data.length) {
    return normalizeResult(data[0]);
  }
  if (typeof data === "object" && data !== null) {
    const record = data as Record<string, unknown>;
    return {
      granted: Boolean(record.granted),
      holder: typeof record.holder === "string" ? record.holder : null,
      expires_at: typeof record.expires_at === "string"
        ? record.expires_at
        : null,
    };
  }
  return { granted: false, holder: null, expires_at: null };
}
