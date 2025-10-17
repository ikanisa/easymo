import {
  createServiceRoleClient,
  handleOptions,
  json,
  logRequest,
  logResponse,
  requireAdminAuth,
} from "../_shared/admin.ts";

type SupabaseLike = ReturnType<typeof createServiceRoleClient>;

let cachedClient: SupabaseLike | null = null;

export function setSupabaseClientForTesting(client: SupabaseLike | null) {
  cachedClient = client;
}

function getSupabase(): SupabaseLike {
  if (cachedClient) return cachedClient;
  cachedClient = createServiceRoleClient();
  return cachedClient;
}

async function fetchStats() {
  const supabase = getSupabase();
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  const [drivers, trips, subs] = await Promise.all([
    supabase.from("driver_presence")
      .select("user_id", { count: "exact", head: true })
      .gt("last_seen", tenMinutesAgo),
    supabase.from("trips")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase.from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .gt("expires_at", nowIso),
  ]);

  const firstError = drivers.error ?? trips.error ?? subs.error;
  if (firstError) {
    console.error("admin-stats.query_failed", firstError);
    return json({ error: "query_failed" }, 500);
  }

  const stats = {
    drivers_online: drivers.count ?? 0,
    open_trips: trips.count ?? 0,
    active_subscriptions: subs.count ?? 0,
  };

  logResponse("admin-stats", 200, stats);
  return json(stats);
}

export async function handler(req: Request): Promise<Response> {
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
    return await fetchStats();
  } catch (error) {
    console.error("admin-stats.unhandled", error);
    return json({ error: "internal_error" }, 500);
  }
}

Deno.serve(handler);
