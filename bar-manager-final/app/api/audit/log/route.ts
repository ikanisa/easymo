import { z } from "zod";

import { createHandler } from "@/app/api/withObservability";
import { jsonError, jsonOk, zodValidationError } from "@/lib/api/http";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const Body = z.object({
  agentId: z.string().uuid(),
  action: z.string().min(2),
  meta: z.record(z.any()).optional(),
  actor: z.string().optional(),
});

export const POST = createHandler("api.audit.log", async (req) => {
  const db = getSupabaseAdminClient();
  if (!db) return jsonError({ error: "supabase_unavailable" }, 503);
  const payload = await req.json().catch(() => ({}));
  try {
    const input = Body.parse(payload);
    const { error } = await db
      .from("agent_audit")
      .insert({
        agent_id: input.agentId,
        actor: input.actor ?? "admin",
        action: input.action,
        meta: input.meta ?? {},
      });
    if (error) return jsonError({ error: error.message }, 500);
    return jsonOk({ ok: true }, 201);
  } catch (err) {
    return zodValidationError(err);
  }
});

export const runtime = "nodejs";
