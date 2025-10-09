// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
/*
 * housekeeping
 *
 * Marks stale drivers offline, expires past-due subscriptions,
 * and expires old open trips. Intended for cron.
 */ const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY");
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
Deno.serve(async (_req) => {
  try {
    const now = new Date();
    const thirtyMinsAgo = new Date(now.getTime() - 30 * 60 * 1000)
      .toISOString();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    // 1) mark drivers offline if last_seen > 30m ago
    const { count: driversMarked, error: driverErr } = await supabase
      .from("driver_status")
      .update({ online: false, updated_at: now.toISOString() })
      .lt("last_seen", thirtyMinsAgo)
      .eq("online", true)
      .select("id", { count: "exact" });
    // 2) expire active subscriptions whose expiry passed
    const { count: subsExpired, error: subErr } = await supabase
      .from("subscriptions")
      .update({ status: "expired", updated_at: now.toISOString() })
      .lt("expires_at", now.toISOString())
      .eq("status", "active")
      .select("id", { count: "exact" });
    // 3) expire trips older than 24h that are still open
    const { count: tripsExpired, error: tripErr } = await supabase
      .from("trips")
      .update({ status: "expired", updated_at: now.toISOString() })
      .lt("created_at", dayAgo)
      .eq("status", "open")
      .select("id", { count: "exact" });
    const errs = [
      driverErr?.message,
      subErr?.message,
      tripErr?.message,
    ].filter(Boolean);
    if (errs.length) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: errs.join("; "),
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }
    console.info("housekeeping.completed", {
      drivers_marked_offline: driversMarked ?? 0,
      subscriptions_expired: subsExpired ?? 0,
      trips_expired: tripsExpired ?? 0,
    });
    return new Response(
      JSON.stringify({
        ok: true,
        drivers_marked_offline: driversMarked ?? 0,
        subscriptions_expired: subsExpired ?? 0,
        trips_expired: tripsExpired ?? 0,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (e) {
    console.error("housekeeping error:", e);
    return new Response(
      JSON.stringify({
        ok: false,
        error: "internal error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
});
