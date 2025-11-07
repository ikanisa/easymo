import { jsonOk, jsonError } from "@/lib/api/http";
import { createHandler } from "@/app/api/withObservability";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

// GET /api/agent-orchestration/registry - List all agents
export const GET = createHandler("admin_api.agent_registry.list", async () => {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return jsonError(
        { error: "supabase_unavailable", message: "Supabase admin client is not configured." },
        503,
      );
    }

    const { data, error } = await supabase
      .from("agent_registry")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to fetch agent registry:", error);
      return jsonError(
        { error: "fetch_failed", message: "Failed to fetch agent registry" },
        500
      );
    }

    return jsonOk({ agents: data || [] });
  } catch (error) {
    console.error("Agent registry list error:", error);
    return jsonError({ error: "internal_error", message: "Internal server error" }, 500);
  }
});

export const runtime = "edge";
