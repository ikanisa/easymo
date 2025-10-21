import { serve } from "../wa-webhook/deps.ts";
import { supabase } from "../wa-webhook/config.ts";

function present(v?: string | null): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const env = (name: string) => Deno.env.get(name);
  const report: Record<string, unknown> = {
    // Presence-only checks (no values leaked)
    has_SUPABASE_URL: present(env("SUPABASE_URL")) ||
      present(env("SERVICE_URL")),
    has_SERVICE_ROLE_KEY: present(env("SUPABASE_SERVICE_ROLE_KEY")) ||
      present(env("SERVICE_ROLE_KEY")),
    has_WA_VERIFY_TOKEN: present(env("WA_VERIFY_TOKEN")) ||
      present(env("WHATSAPP_VERIFY_TOKEN")),
    has_WA_APP_SECRET: present(env("WA_APP_SECRET")) ||
      present(env("WHATSAPP_APP_SECRET")),
    has_WA_PHONE_ID: present(env("WA_PHONE_ID")) ||
      present(env("WHATSAPP_PHONE_NUMBER_ID")),
    has_WA_BOT_NUMBER_E164: present(env("WA_BOT_NUMBER_E164")) ||
      present(env("WHATSAPP_PHONE_NUMBER_E164")),
  };

  // DB connectivity + table probe (no writes)
  try {
    const { error, count } = await supabase
      .from("webhook_logs")
      .select("id", { count: "exact", head: true })
      .limit(1);
    report.db_connectivity = error ? "error" : "ok";
    if (error) report.db_error = error.message;
    if (typeof count === "number") report.webhook_logs_count_hint = count;
  } catch (e) {
    report.db_connectivity = "error";
    report.db_error = e instanceof Error ? e.message : String(e);
  }

  // Minimal status rollup (essential envs)
  const essentials = [
    report.has_SUPABASE_URL,
    report.has_SERVICE_ROLE_KEY,
    report.has_WA_VERIFY_TOKEN,
    report.has_WA_APP_SECRET,
    report.has_WA_PHONE_ID,
  ];
  report.status = essentials.every(Boolean) ? "ok" : "degraded";

  return new Response(JSON.stringify(report), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
