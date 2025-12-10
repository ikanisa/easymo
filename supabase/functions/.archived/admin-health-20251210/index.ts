import {
import { logStructuredEvent } from "../_shared/observability.ts";
  createServiceRoleClient,
  handleOptions,
  json,
  logResponse,
  requireAdminAuth,
  withAdminTracing,
} from "../_shared/admin.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";
import { logStructuredEvent } from "../_shared/observability.ts";

const supabase = createServiceRoleClient();

Deno.serve(withAdminTracing("admin-health", async (req, ctx) => {
  // Rate limiting (200 req/min for admin endpoints)
  const rateLimitCheck = await rateLimitMiddleware(req, {
    limit: 200,
    windowSeconds: 60,
  });

  if (!rateLimitCheck.allowed) {
    return rateLimitCheck.response!;
  }

  if (req.method === "OPTIONS") {
    return handleOptions();
  }

  const authResponse = requireAdminAuth(req);
  if (authResponse) return authResponse;

  if (req.method !== "GET") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    const { error } = await supabase.from("app_config").select("id").limit(1);
    if (error) {
      await logStructuredEvent("ERROR", { data: "admin-health.db_failed", error });
      return json({ status: "error", db: "unreachable" }, 500);
    }

    const payload = {
      status: "ok" as const,
      supabase: "ok" as const,
      timestamp: new Date().toISOString(),
    };
    logResponse("admin-health", 200, { ...payload, requestId: ctx.requestId, durationMs: Date.now() - ctx.startedAt });
    return json(payload);
  } catch (err) {
    await logStructuredEvent("ERROR", { data: "admin-health.unhandled", err });
    return json({ status: "error", reason: "unhandled" }, 500);
  }
}));
