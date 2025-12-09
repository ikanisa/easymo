import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CACHE_TAGS, composeTags } from "@/lib/performance/cache";
import { logError, logInfo, logWarn } from "@/lib/observability/logger";

const bodySchema = z.object({
  event: z.string().min(1),
  saccoId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().min(1)).optional(),
});

const expectedToken = process.env.ANALYTICS_CACHE_TOKEN;

type RevalidateTag = (tag: string) => Promise<void> | void;

const globalScope = globalThis as typeof globalThis & {
  __analyticsCacheRevalidateOverride?: RevalidateTag;
};

const invokeRevalidateTag = async (tag: string) => {
  const override = globalScope.__analyticsCacheRevalidateOverride;
  if (typeof override === "function") {
    await override(tag);
    return;
  }

  await revalidateTag(tag);
};

const extractToken = (headerValue: string | null) => {
  if (!headerValue) return null;
  const parts = headerValue.split(" ");
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
    return parts[1];
  }
  return headerValue;
};

export async function POST(request: NextRequest) {
  if (!expectedToken) {
    logWarn("cache.revalidate.disabled", { reason: "missing_token" });
    return NextResponse.json({ error: "disabled" }, { status: 503 });
  }

  const providedToken = extractToken(request.headers.get("authorization"));
  if (providedToken !== expectedToken) {
    logWarn("cache.revalidate.unauthorized", { provided: providedToken ? "present" : "missing" });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch (error) {
    logWarn("cache.revalidate.invalid_payload", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const tags = composeTags(
    CACHE_TAGS.dashboardSummary,
    CACHE_TAGS.analyticsExecutive(parsed.saccoId ?? null),
    parsed.saccoId ? CACHE_TAGS.sacco(parsed.saccoId) : null,
    ...(parsed.tags ?? [])
  );

  const results: Record<string, "ok" | "error"> = {};
  await Promise.all(
    tags.map(async (tag) => {
      try {
        await invokeRevalidateTag(tag);
        results[tag] = "ok";
      } catch (error) {
        results[tag] = "error";
        logError("cache.revalidate.failed", {
          tag,
          event: parsed.event,
          saccoId: parsed.saccoId ?? null,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })
  );

  logInfo("cache.revalidate.completed", {
    event: parsed.event,
    saccoId: parsed.saccoId ?? null,
    tags,
  });

  const status = Object.values(results).every((value) => value === "ok") ? 200 : 207;
  return NextResponse.json({ ok: status === 200, tags, results }, { status });
}
