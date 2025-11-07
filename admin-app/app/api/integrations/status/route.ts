import { z } from "zod";
import { jsonOk } from "@/lib/api/http";
import { createHandler } from "@/app/api/withObservability";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const STORAGE_HEALTH_BUCKET =
  process.env.NEXT_PUBLIC_STORAGE_HEALTHCHECK_BUCKET ?? "vouchers";

const httpTargetSchema = z.object({
  name: z.enum(["voucherPreview", "whatsappSend", "campaignDispatcher"]),
  url: z.string().url(),
  method: z.enum(["HEAD", "GET", "POST"]).default("HEAD"),
});

type ProbeResult = { status: "green" | "amber" | "red"; message: string };

function buildTargets() {
  const targets = [] as Array<z.infer<typeof httpTargetSchema>>;

  if (process.env.NEXT_PUBLIC_VOUCHER_PREVIEW_ENDPOINT) {
    targets.push({
      name: "voucherPreview",
      url: process.env.NEXT_PUBLIC_VOUCHER_PREVIEW_ENDPOINT,
      method: "POST",
    });
  }

  if (process.env.NEXT_PUBLIC_WHATSAPP_SEND_ENDPOINT) {
    targets.push({
      name: "whatsappSend",
      url: process.env.NEXT_PUBLIC_WHATSAPP_SEND_ENDPOINT,
      method: "POST",
    });
  }

  if (process.env.NEXT_PUBLIC_CAMPAIGN_DISPATCHER_ENDPOINT) {
    targets.push({
      name: "campaignDispatcher",
      url: process.env.NEXT_PUBLIC_CAMPAIGN_DISPATCHER_ENDPOINT,
      method: "POST",
    });
  }

  return targets;
}

async function probe(url: string, method: "HEAD" | "GET" | "POST"): Promise<ProbeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (response.ok) {
      return { status: "green", message: "OK" };
    }
    const level = response.status >= 500 ? "red" : "amber";
    return { status: level, message: `HTTP ${response.status}` };
  } catch (error) {
    clearTimeout(timeout);
    return {
      status: "red",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function checkStorageHealth(): Promise<ProbeResult> {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return {
      status: "red",
      message: "Supabase admin client unavailable",
    };
  }

  try {
    const { error } = await adminClient.storage
      .from(STORAGE_HEALTH_BUCKET)
      .list("", { limit: 1 });

    if (error) {
      return {
        status: "amber",
        message: error.message ?? "Bucket probe failed",
      };
    }

    return {
      status: "green",
      message: `Connected to ${STORAGE_HEALTH_BUCKET} bucket`,
    };
  } catch (error) {
    return {
      status: "red",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export const dynamic = "force-dynamic";

export const GET = createHandler(
  "admin_api.integrations.status",
  async () => {
    const targets = buildTargets();
    const results: Record<string, ProbeResult> = {
      voucherPreview: {
        status: "red",
        message: "Set NEXT_PUBLIC_VOUCHER_PREVIEW_ENDPOINT to enable health checks",
      },
      whatsappSend: {
        status: "red",
        message: "Set NEXT_PUBLIC_WHATSAPP_SEND_ENDPOINT to enable health checks",
      },
      campaignDispatcher: {
        status: "red",
        message:
          "Set NEXT_PUBLIC_CAMPAIGN_DISPATCHER_ENDPOINT to enable health checks",
      },
      storageSignedUrl: {
        status: "amber",
        message: "Probing Supabase storage credentials",
      },
    };

    if (targets.length) {
      await Promise.all(
        targets.map(async (target) => {
          const parsed = httpTargetSchema.safeParse(target);
          if (!parsed.success) {
            return;
          }
          const { name, url, method } = parsed.data;
          const outcome = await probe(url, method as "HEAD" | "GET" | "POST");
          results[name] = outcome;
        }),
      );
    }

    results.storageSignedUrl = await checkStorageHealth();

    return jsonOk(results);
  },
);

export const runtime = "nodejs";
