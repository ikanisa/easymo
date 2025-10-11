import { createServiceRoleClient, handleOptions, json, logRequest, logResponse, requireAdminAuth } from "../_shared/admin.ts";

const supabase = createServiceRoleClient();

Deno.serve(async (req) => {
  logRequest("admin-health", req);

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
      console.error("admin-health.db_failed", error);
      return json({ status: "error", db: "unreachable" }, 500);
    }

    const payload = {
      status: "ok" as const,
      supabase: "ok" as const,
      timestamp: new Date().toISOString(),
    };
    logResponse("admin-health", 200, payload);
    return json(payload);
  } catch (err) {
    console.error("admin-health.unhandled", err);
    return json({ status: "error", reason: "unhandled" }, 500);
  }
});
