// Supabase Edge Function: admin-users
//
// Returns an array of user objects for the admin panel.  Each user
// includes subscription status calculated from the subscriptions table.

import { serve } from "$std/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { getInvitationDefaults } from "../_shared/env.ts";
import { methodNotAllowed, ok, serverError } from "../_shared/http.ts";
import { z } from "zod";

const supabase = getServiceClient();

const InvitationPayload = z.object({
  email: z.string().email(),
  role: z.string().optional(),
  expires_in_days: z.number().int().min(1).max(90).optional(),
  invited_by: z.string().uuid().optional(),
});

serve(async (req) => {
  const guard = requireAdmin(req);
  if (guard) return guard;

  if (req.method === "GET") return listUsers();
  if (req.method === "POST") return createInvitation(req);

  return methodNotAllowed(["GET", "POST"]);
});

async function listUsers() {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        `user_id, whatsapp_e164, ref_code, credits_balance, created_at,
         subscriptions:subscriptions(status, expires_at),
         user_roles: user_roles(role_slug)`,
      );
    if (error) return serverError(error.message);
    const users = (data ?? []).map((row: any) => {
      let subscription_status: "active" | "expired" | "none" = "none";
      const sub = row.subscriptions?.[0];
      if (sub) {
        const now = Date.now();
        if (
          sub.status === "active" && sub.expires_at &&
          new Date(sub.expires_at).getTime() >= now
        ) {
          subscription_status = "active";
        } else {
          subscription_status = "expired";
        }
      }
      const roles = (row.user_roles ?? []).map((entry: any) => entry.role_slug);
      return {
        user_id: row.user_id,
        whatsapp_e164: row.whatsapp_e164,
        ref_code: row.ref_code,
        credits_balance: row.credits_balance ?? 0,
        subscription_status,
        roles,
        created_at: row.created_at,
      };
    });
    return ok({ users });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return serverError(message);
  }
}

async function createInvitation(req: Request): Promise<Response> {
  const defaults = getInvitationDefaults();

  let payload: z.infer<typeof InvitationPayload>;
  try {
    const parsed = InvitationPayload.safeParse(await req.json());
    if (!parsed.success) {
      return ok({ error: parsed.error.flatten() }, 400);
    }
    payload = parsed.data;
  } catch {
    return ok({ error: "Invalid JSON payload" }, 400);
  }

  const roleSlug = (payload.role ?? defaults.defaultRole).trim().toLowerCase();
  const expiresInDays = payload.expires_in_days ?? defaults.expiryDays;
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + expiresInDays);

  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("slug")
    .eq("slug", roleSlug)
    .maybeSingle();
  if (roleError) return serverError(roleError.message);
  if (!role) return ok({ error: `Role ${roleSlug} not found` }, 400);

  const { data, error } = await supabase
    .from("invitations")
    .insert({
      email: payload.email.toLowerCase(),
      role_slug: role.slug,
      invited_by: payload.invited_by ?? null,
      expires_at: expiresAt.toISOString(),
    })
    .select("id, token, role_slug, email, expires_at, status")
    .single();

  if (error) return serverError(error.message);
  return ok({ invitation: data });
}
