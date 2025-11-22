import { z } from "zod";

import { createHandler } from "@/app/api/withObservability";
import { jsonError, jsonOk } from "@/lib/api/http";
import { readSessionFromCookies } from "@/lib/server/session";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const payloadSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "staff"]).default("admin"),
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = createHandler("admin_api.users.invite", async (request: Request, _context, obs) => {
  const actor = await readSessionFromCookies();
  if (!actor) {
    return jsonError({ error: "unauthorized" }, 401);
  }

  const body = await request.json().catch(() => ({}));
  const payload = payloadSchema.parse(body);

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return jsonError({ error: "supabase_admin_unavailable" }, 500);
  }

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(payload.email, {
    data: { role: payload.role },
  });

  if (error) {
    return jsonError({ error: "invite_failed", message: error.message }, 400);
  }

  if (data?.user?.id) {
    const { error: roleError } = await supabase.auth.admin.updateUserById(data.user.id, {
      app_metadata: { role: payload.role },
      user_metadata: { ...(data.user.user_metadata ?? {}), role: payload.role },
    });
    if (roleError) {
      obs.log({
        event: "ADMIN_INVITE_ROLE_UPDATE_FAILED",
        status: "error",
        message: roleError.message,
        details: { userId: data.user.id, role: payload.role },
      });
    } else {
      obs.log({
        event: "ADMIN_INVITED",
        status: "ok",
        details: { email: payload.email, role: payload.role, userId: data.user.id },
      });
    }
  }

  return jsonOk({ status: "invited", userId: data?.user?.id ?? null, role: payload.role });
});
