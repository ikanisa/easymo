// Supabase Edge Function: admin-stats
//
// Returns aggregated operational metrics for the admin dashboard.  See
// src/lib/adapter.real.ts#getAdminStats for example usage.  Uses
// Supabase service role key to perform unrestricted reads.

import { serve } from "$std/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_URL = Deno.env.get("SERVICE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SERVICE_ROLE_KEY") ?? "";
const ADMIN_TOKEN = Deno.env.get("EASYMO_ADMIN_TOKEN") ?? "";

const SB_URL = SUPABASE_URL || SERVICE_URL;
if (!SB_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Supabase credentials are not configured");
}

const supabase = createClient(SB_URL, SERVICE_ROLE_KEY);

serve(async (req) => {
  const apiKey = req.headers.get("x-api-key");
  if (apiKey !== ADMIN_TOKEN) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
    });
  }
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
    });
  }
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
    return new Response(
      JSON.stringify({
        drivers_online: driversOnline ?? 0,
        open_trips: openTrips ?? 0,
        active_subscriptions: activeSubs ?? 0,
        total_users: totalUsers ?? 0,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
