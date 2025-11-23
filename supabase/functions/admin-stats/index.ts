// Supabase Edge Function: admin-stats
//
// Returns aggregated operational metrics for the admin dashboard.  See
// src/lib/adapter.real.ts#getAdminStats for example usage.  Uses
// Supabase service role key to perform unrestricted reads.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { methodNotAllowed, ok, serverError } from "../_shared/http.ts";

const supabase = getServiceClient();

serve(async (req) => {
  const guard = requireAdmin(req);
  if (guard) return guard;
  if (req.method !== "GET") return methodNotAllowed(["GET"]);
  try {
    // Count drivers online (last seen within 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)
      .toISOString();
    const { count: driversOnline } = await supabase
      .from("driver_presence")
      .select("user_id", { count: "exact" })
      .gte("last_seen", fifteenMinutesAgo);
    // Count open trips
    const { count: openTrips } = await supabase
      .from("trips")
      .select("id", { count: "exact" })
      .is("status", null);
    // Count active subscriptions
    const now = new Date().toISOString();
    const { count: activeSubs } = await supabase
      .from("subscriptions")
      .select("id", { count: "exact" })
      .eq("status", "active")
      .gte("expires_at", now);
    // Count total users
    const { count: totalUsers } = await supabase
      .from("profiles")
      .select("user_id", { count: "exact" });
    return ok({
      drivers_online: driversOnline ?? 0,
      open_trips: openTrips ?? 0,
      active_subscriptions: activeSubs ?? 0,
      total_users: totalUsers ?? 0,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return serverError(message);
  }
});
