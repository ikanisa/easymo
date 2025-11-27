import { headers } from "next/headers";
import { z } from "zod";

import { createHandler } from "@/app/api/withObservability";
import { jsonError,jsonOk } from "@/lib/api/http";
import { recordAudit } from "@/lib/server/audit";
import { logStructured } from "@/lib/server/logger";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

// Query params schema
const querySchema = z.object({
  status: z.enum(["searching", "negotiating", "completed", "timeout", "cancelled"]).optional(),
  flow_type: z.string().optional(),
  agent_type: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

// Create session schema
const createSessionSchema = z.object({
  user_id: z.string().uuid().optional(),
  agent_type: z.string(),
  flow_type: z.string(),
  request_data: z.record(z.unknown()),
  sla_minutes: z.number().min(1).max(30).default(5),
});

// GET /api/agent-orchestration/sessions - List sessions
export const GET = createHandler("admin_api.agent_sessions.list", async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const params = querySchema.parse(Object.fromEntries(searchParams));

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return jsonError(
        { error: "supabase_unavailable", message: "Supabase admin client is not configured." },
        503,
      );
    }

    let query = supabase
      .from("agent_sessions")
      .select("*, agent_quotes(count)", { count: "exact" })
      .order("started_at", { ascending: false })
      .range(params.offset, params.offset + params.limit - 1);

    if (params.status) {
      query = query.eq("status", params.status);
    }
    if (params.flow_type) {
      query = query.eq("flow_type", params.flow_type);
    }
    if (params.agent_type) {
      query = query.eq("agent_type", params.agent_type);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Failed to fetch agent sessions:", error);
      return jsonError(
        { error: "fetch_failed", message: "Failed to fetch agent sessions" },
        500
      );
    }

    const responseBody = {
      sessions: data || [],
      total: count || 0,
      limit: params.limit,
      offset: params.offset,
    };

    logStructured({
      event: "agent_sessions_listed",
      target: "agent_sessions",
      status: "ok",
      details: {
        filters: params,
        count: responseBody.total,
      },
    });

    return jsonOk(responseBody);
  } catch (error) {
    console.error("Agent sessions list error:", error);
    return jsonError({ error: "internal_error", message: "Internal server error" }, 500);
  }
});

// POST /api/agent-orchestration/sessions - Create new session
export const POST = createHandler("admin_api.agent_sessions.create", async (req) => {
  try {
    const body = await req.json();
    const validated = createSessionSchema.parse(body);

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return jsonError(
        { error: "supabase_unavailable", message: "Supabase admin client is not configured." },
        503,
      );
    }

    // Calculate deadline
    const deadline = new Date();
    deadline.setMinutes(deadline.getMinutes() + validated.sla_minutes);

    const { data, error } = await supabase
      .from("agent_sessions")
      .insert({
        user_id: validated.user_id,
        agent_type: validated.agent_type,
        flow_type: validated.flow_type,
        request_data: validated.request_data,
        deadline_at: deadline.toISOString(),
        status: "searching",
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create agent session:", error);
      return jsonError(
        { error: "create_failed", message: "Failed to create agent session" },
        500
      );
    }

    const headersList = await headers();
    const actorId = headersList.get("x-actor-id");

    await recordAudit({
      actorId,
      action: "agent_session_create",
      targetTable: "agent_sessions",
      targetId: data.id,
      diff: {
        agent_type: validated.agent_type,
        flow_type: validated.flow_type,
        sla_minutes: validated.sla_minutes,
      },
    });

    logStructured({
      event: "agent_session_created",
      target: data.id,
      status: "ok",
      details: {
        actorId,
        agentType: validated.agent_type,
        flowType: validated.flow_type,
        deadline: data.deadline_at,
      },
    });

    return jsonOk({ session: data }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(
        { error: "invalid_payload", message: error.flatten() },
        400
      );
    }
    console.error("Agent session creation error:", error);
    return jsonError({ error: "internal_error", message: "Internal server error" }, 500);
  }
});

export const runtime = "nodejs";
