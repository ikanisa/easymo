import { z } from "zod";
import { jsonOk, jsonError } from "@/lib/api/http";
import { createHandler } from "@/app/api/withObservability";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

// Update agent config schema
const updateAgentConfigSchema = z.object({
  enabled: z.boolean().optional(),
  sla_minutes: z.number().min(1).max(60).optional(),
  max_extensions: z.number().min(0).max(5).optional(),
  fan_out_limit: z.number().min(1).max(50).optional(),
  counter_offer_delta_pct: z.number().min(0).max(100).optional(),
  auto_negotiation: z.boolean().optional(),
  feature_flag_scope: z.enum(["disabled", "staging", "prod_10%", "prod_50%", "prod_100%"]).optional(),
  system_prompt: z.string().optional(),
  enabled_tools: z.array(z.string()).optional(),
});

// GET /api/agent-orchestration/registry/[agent_type] - Get agent config
export const GET = createHandler<{ params: Promise<{ agent_type: string }> }>(
  "admin_api.agent_registry.get",
  async (req, context) => {
    try {
      const { agent_type } = await context.params;
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
        .eq("agent_type", agent_type)
        .single();

      if (error || !data) {
        return jsonError(
          { error: "not_found", message: "Agent not found" },
          404
        );
      }

      return jsonOk({ agent: data });
    } catch (error) {
      console.error("Agent registry get error:", error);
      return jsonError({ error: "internal_error", message: "Internal server error" }, 500);
    }
  }
);

// PATCH /api/agent-orchestration/registry/[agent_type] - Update agent config
export const PATCH = createHandler<{ params: Promise<{ agent_type: string }> }>(
  "admin_api.agent_registry.update",
  async (req, context) => {
    try {
      const { agent_type } = await context.params;
      const body = await req.json();
      const validated = updateAgentConfigSchema.parse(body);

      const supabase = getSupabaseAdminClient();
      if (!supabase) {
        return jsonError(
          { error: "supabase_unavailable", message: "Supabase admin client is not configured." },
          503,
        );
      }

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        ...validated,
      };

      const { data, error } = await supabase
        .from("agent_registry")
        .update(updates)
        .eq("agent_type", agent_type)
        .select()
        .single();

      if (error) {
        console.error("Failed to update agent config:", error);
        return jsonError(
          { error: "update_failed", message: "Failed to update agent configuration" },
          500
        );
      }

      return jsonOk({ agent: data });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return jsonError(
          { error: "invalid_payload", message: error.flatten() },
          400
        );
      }
      console.error("Agent config update error:", error);
      return jsonError({ error: "internal_error", message: "Internal server error" }, 500);
    }
  }
);

export const runtime = "nodejs";
