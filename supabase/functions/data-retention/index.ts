// deno-lint-ignore-file no-explicit-any
import { serve } from "$std/http/server.ts";
import { getServiceClient } from "shared/supabase.ts";
import { ok, serverError } from "shared/http.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const supabase = getServiceClient();
const denoWithCron = Deno as typeof Deno & {
  cron?: (
    name: string,
    schedule: string,
    handler: () => void | Promise<void>,
  ) => void;
};

const CRON_EXPR = Deno.env.get("DATA_RETENTION_CRON") ?? "0 2 * * *";
const CRON_ENABLED =
  (Deno.env.get("DATA_RETENTION_CRON_ENABLED") ?? "true").toLowerCase() !==
    "false";
const VOUCHER_RETENTION_DAYS = Number(
  Deno.env.get("VOUCHER_RETENTION_DAYS") ?? "90",
);
const INSURANCE_DOC_RETENTION_DAYS = Number(
  Deno.env.get("INSURANCE_DOC_RETENTION_DAYS") ?? "30",
);
const INSURANCE_BUCKET = Deno.env.get("INSURANCE_MEDIA_BUCKET") ??
  "insurance-docs";
const FINAL_INSURANCE_STATUSES = ["completed", "rejected"];

function normalizeStoragePath(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith(`${INSURANCE_BUCKET}/`)) {
    return path.slice(INSURANCE_BUCKET.length + 1);
  }
  return path;
}

async function purgeExpiredVouchers(now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - VOUCHER_RETENTION_DAYS * DAY_MS)
    .toISOString();
  const { count, error } = await supabase
    .from("vouchers")
    .delete()
    .eq("status", "expired")
    .lte("expires_at", cutoff)
    .select("id", { count: "exact" });
  if (error) {
    throw new Error(`voucher_purge_failed: ${error.message}`);
  }
  return count ?? 0;
}

async function deleteInsuranceDocuments(now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - INSURANCE_DOC_RETENTION_DAYS * DAY_MS)
    .toISOString();
  const batchSize = 200;
  let deleted = 0;

  while (true) {
    const { data, error } = await supabase
      .from("insurance_documents")
      .select(`
        id,
        storage_path,
        intent:insurance_intents!inner(status, updated_at)
      `)
      .in("intent.status", FINAL_INSURANCE_STATUSES)
      .lte("intent.updated_at", cutoff)
      .limit(batchSize);
    if (error) {
      throw new Error(`insurance_documents_fetch_failed: ${error.message}`);
    }
    if (!data || data.length === 0) break;

    const storagePaths = data
      .map((doc) => normalizeStoragePath(doc.storage_path))
      .filter((value): value is string => Boolean(value));

    if (storagePaths.length) {
      const { error: storageErr } = await supabase.storage
        .from(INSURANCE_BUCKET)
        .remove(storagePaths);
      if (storageErr) {
        throw new Error(
          `insurance_storage_delete_failed: ${storageErr.message}`,
        );
      }
    }

    const ids = data.map((doc) => doc.id);
    const { error: deleteErr } = await supabase
      .from("insurance_documents")
      .delete()
      .in("id", ids);
    if (deleteErr) {
      throw new Error(
        `insurance_documents_delete_failed: ${deleteErr.message}`,
      );
    }

    deleted += data.length;
    if (data.length < batchSize) break;
  }

  return deleted;
}

async function runRetention(trigger: "http" | "cron") {
  const now = new Date();
  const summary: Record<string, unknown> = {
    trigger,
    timestamp: now.toISOString(),
  };

  try {
    const [vouchersPurged, insuranceDeleted] = await Promise.all([
      purgeExpiredVouchers(now),
      deleteInsuranceDocuments(now),
    ]);

    summary.vouchers_purged = vouchersPurged;
    summary.insurance_documents_deleted = insuranceDeleted;
    summary.ok = true;
    console.info("data_retention.completed", summary);
    return summary;
  } catch (error) {
    console.error("data_retention.failed", error);
    return {
      ok: false,
      trigger,
      timestamp: now.toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

serve(async (_req) => {
  const result = await runRetention("http");
  if (result.ok) {
    return ok(result);
  }
  return serverError("data_retention_failed", result);
});

if (typeof denoWithCron.cron === "function" && CRON_ENABLED) {
  denoWithCron.cron("data-retention", CRON_EXPR, async () => {
    try {
      await runRetention("cron");
    } catch (error) {
      console.error("data_retention.cron_failed", error);
    }
  });
} else if (!CRON_ENABLED) {
  console.warn("data-retention cron disabled via env");
}
