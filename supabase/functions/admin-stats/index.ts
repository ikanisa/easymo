import {
  createServiceRoleClient,
  handleOptions,
  json,
  logRequest,
  logResponse,
  requireAdminAuth,
} from "../_shared/admin.ts";

const supabase = createServiceRoleClient();

Deno.serve(async (req) => {
  logRequest("admin-stats", req);

  if (req.method === "OPTIONS") {
    return handleOptions();
  }

  const authResponse = requireAdminAuth(req);
  if (authResponse) return authResponse;

  if (req.method !== "GET") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    const nowIso = new Date().toISOString();

    const [driversRes, tripsRes, subsRes] = await Promise.all([
      supabase.from("driver_status").select("count", { count: "exact" }).eq(
        "online",
        true,
      ),
      supabase.from("trips").select("count", { count: "exact" }).eq(
        "status",
        "open",
      ),
      supabase.from("subscriptions").select("count", { count: "exact" })
        .eq("status", "active")
        .gt("expires_at", nowIso),
    ]);

    const firstError = driversRes.error ?? tripsRes.error ?? subsRes.error;
    if (firstError) {
      console.error("admin-stats.query_failed", firstError);
      return json({ error: "query_failed" }, 500);
    }

    const stats = {
      drivers_online: driversRes.count ?? 0,
      open_trips: tripsRes.count ?? 0,
      active_subscriptions: subsRes.count ?? 0,
    };

    logResponse("admin-stats", 200, stats);
    return json(stats);
  } catch (error) {
    console.error("admin-stats.unhandled", error);
    return json({ error: "internal_error" }, 500);
  }
});
