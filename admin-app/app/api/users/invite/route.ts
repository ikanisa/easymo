import { z } from "zod";
import { createHandler } from "@/app/api/withObservability";
import { jsonError, jsonOk } from "@/lib/api/http";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { readSessionFromCookies } from "@/lib/server/session";

const payloadSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "staff"]).default("admin"),
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = createHandler("admin_api.users.invite", async (request: Request) => {
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
      console.warn("supabase.invite_user.role_update_failed", roleError.message);
    }
  }

  return jsonOk({ status: "invited", userId: data?.user?.id ?? null, role: payload.role });
});
