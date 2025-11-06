import { jsonOk, jsonError } from "@/lib/api/http";
import { createHandler } from "@/app/api/withObservability";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const dynamic = "force-dynamic";

// GET /api/agent-orchestration/registry - List all agents
export const GET = createHandler("admin_api.agent_registry.list", async () => {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

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
