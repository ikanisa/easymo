import { z } from "zod";

import { createHandler } from "@/app/api/withObservability";
import { handleAPIError, jsonError, jsonOk } from "@/lib/api/error-handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { readSessionFromCookies } from "@/lib/server/session";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const payloadSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "staff"]).default("admin"),
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = createHandler("admin_api.users.invite", async (request: Request, _context, obs) => {
  try {
    // 1. Rate Limit
    const limiter = rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 500 });
    const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
    await limiter.check(10, ip); // Limit invites to 10 per minute

    // 2. Auth Check
    const actor = await readSessionFromCookies();
    if (!actor) {
      return jsonError("Unauthorized", 401, "unauthorized");
    }

    // 3. Validation
    const body = await request.json().catch(() => ({}));
    const payload = payloadSchema.parse(body);

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return jsonError("Supabase admin client unavailable", 500, "config_error");
    }

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(payload.email, {
      data: { role: payload.role },
    });

    if (error) {
      return jsonError(error.message, 400, "invite_failed");
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("Validation failed", 400, "validation_error");
    }
    return handleAPIError(error);
  }
});
