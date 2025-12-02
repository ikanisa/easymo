import { headers } from "next/headers";
import { z } from "zod";

import { createHandler } from "@/app/api/withObservability";
import { jsonError,jsonOk } from "@/lib/api/http";
import { recordAudit } from "@/lib/server/audit";
import { logStructured } from "@/lib/server/logger";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

// Update session schema
const updateSessionSchema = z.object({
  status: z.enum(["searching", "negotiating", "completed", "timeout", "cancelled"]).optional(),
  selected_quote_id: z.string().uuid().optional(),
  cancellation_reason: z.string().optional(),
  extend_deadline: z.boolean().optional(),
});

// GET /api/agent-orchestration/sessions/[id] - Get session detail
export const GET = createHandler<{ params: Promise<{ id: string }> }>(
  "admin_api.agent_sessions.detail",
  async (req, context) => {
    try {
      const { id } = await context.params;
      const supabase = getSupabaseAdminClient();
      if (!supabase) {
        return jsonError(
          { error: "supabase_unavailable", message: "Supabase admin client is not configured." },
          503,
        );
      }

      const { data: session, error: sessionError } = await supabase
        .from("agent_sessions")
        .select("*")
        .eq("id", id)
        .single();

    if (sessionError || !session) {
      return jsonError(
        { error: "not_found", message: "Session not found" },
        404
      );
    }

    // Fetch quotes for this session
      const { data: quotes, error: quotesError } = await supabase
        .from("agent_quotes")
        .select("*")
        .eq("session_id", id)
        .order("responded_at", { ascending: false });

    if (quotesError) {
      console.error("Failed to fetch quotes:", quotesError);
    }

      logStructured({
        event: "agent_session_viewed",
        target: id,
        status: "ok",
        details: {
          hasQuotes: Boolean(quotes?.length),
        },
      });

      return jsonOk({
        session,
        quotes: quotes || [],
      });
    } catch (error) {
      console.error("Agent session detail error:", error);
      return jsonError({ error: "internal_error", message: "Internal server error" }, 500);
    }
  },
);

// PATCH /api/agent-orchestration/sessions/[id] - Update session
export const PATCH = createHandler<{ params: Promise<{ id: string }> }>(
  "admin_api.agent_sessions.update",
  async (req, context) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const validated = updateSessionSchema.parse(body);

      const supabase = getSupabaseAdminClient();
      if (!supabase) {
        return jsonError(
          { error: "supabase_unavailable", message: "Supabase admin client is not configured." },
          503,
        );
      }

      // First, get the current session
      const { data: currentSession, error: fetchError } = await supabase
        .from("agent_sessions")
        .select("*")
        .eq("id", id)
        .single();

    if (fetchError || !currentSession) {
      return jsonError(
        { error: "not_found", message: "Session not found" },
        404
      );
    }

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

    if (validated.status) {
      updates.status = validated.status;
      if (validated.status === "completed" || validated.status === "timeout" || validated.status === "cancelled") {
        updates.completed_at = new Date().toISOString();
      }
    }

    if (validated.selected_quote_id) {
      updates.selected_quote_id = validated.selected_quote_id;
    }

    if (validated.cancellation_reason) {
      updates.cancellation_reason = validated.cancellation_reason;
    }

    // Handle deadline extension
    if (validated.extend_deadline && currentSession.extensions_count < 2) {
      const newDeadline = new Date(currentSession.deadline_at);
      newDeadline.setMinutes(newDeadline.getMinutes() + 2);
      updates.deadline_at = newDeadline.toISOString();
      updates.extensions_count = currentSession.extensions_count + 1;
    }

      const { data, error } = await supabase
        .from("agent_sessions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Failed to update agent session:", error);
        return jsonError(
          { error: "update_failed", message: "Failed to update agent session" },
          500,
        );
      }

      const headersList = await headers();
      const actorId = headersList.get("x-actor-id");

      await recordAudit({
        actorId,
        action: "agent_session_update",
        targetTable: "agent_sessions",
        targetId: id,
        diff: updates,
      });

      if (currentSession.deadline_at) {
        const deadline = new Date(currentSession.deadline_at);
        if (!Number.isNaN(deadline.getTime()) && deadline.getTime() < Date.now()) {
          logStructured({
            event: "agent_session_sla_breach",
            target: id,
            status: "error",
            details: {
              status: currentSession.status,
              deadline: currentSession.deadline_at,
              actorId,
            },
          });
        }
      }

      logStructured({
        event: "agent_session_updated",
        target: id,
        status: "ok",
        details: {
          updates,
          actorId,
        },
      });

      return jsonOk({ session: data });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return jsonError(
          { error: "invalid_payload", message: error.flatten() },
          400,
        );
      }
      console.error("Agent session update error:", error);
      return jsonError({ error: "internal_error", message: "Internal server error" }, 500);
    }
  },
);

export const runtime = "nodejs";
