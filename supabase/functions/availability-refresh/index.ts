// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ??
  Deno.env.get("SERVICE_URL");
const SUPABASE_SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const CRON_EXPR = "*/15 * * * *";
const denoWithCron = Deno as typeof Deno & {
  cron?: (
    name: string,
    schedule: string,
    handler: () => void | Promise<void>,
  ) => void;
};
const CRON_ENABLED =
  (Deno.env.get("AVAILABILITY_REFRESH_CRON_ENABLED") ?? "true")
    .toLowerCase() !== "false";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("availability-refresh missing Supabase configuration");
}

const supabase = createClient(SUPABASE_URL ?? "", SUPABASE_SERVICE_KEY ?? "");

async function runRefresh(trigger: "http" | "cron") {
  const now = new Date().toISOString();

  const { count: parkingCount, error: parkingError } = await supabase
    .from("driver_parking")
    .select("id", { head: true, count: "exact" })
    .eq("active", true);

  const { count: availabilityCount, error: availabilityError } = await supabase
    .from("driver_availability")
    .select("id", { head: true, count: "exact" })
    .eq("active", true);

  if (parkingError || availabilityError) {
    console.error("availability-refresh.query_failed", {
      parkingError,
      availabilityError,
    });
    return {
      ok: false,
      error: parkingError?.message ?? availabilityError?.message ??
        "query_failed",
    };
  }

  console.info("availability_refresh.completed", {
    trigger,
    active_parking: parkingCount ?? 0,
    active_availability: availabilityCount ?? 0,
    timestamp: now,
  });

  return {
    ok: true,
    trigger,
    active_parking: parkingCount ?? 0,
    active_availability: availabilityCount ?? 0,
    timestamp: now,
  };
}

Deno.serve(async (_req) => {
  const summary = await runRefresh("http");
  return new Response(JSON.stringify(summary), {
    status: summary.ok ? 200 : 500,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
});

if (typeof denoWithCron.cron === "function" && CRON_ENABLED) {
  denoWithCron.cron("availability-refresh", CRON_EXPR, async () => {
    try {
      await runRefresh("cron");
    } catch (error) {
      console.error("availability-refresh.cron_failed", error);
    }
  });
} else if (!CRON_ENABLED) {
  console.warn("availability-refresh cron disabled via env");
}
