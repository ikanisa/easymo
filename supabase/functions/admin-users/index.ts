// Supabase Edge Function: admin-users
//
// Returns an array of user objects for the admin panel.  Each user
// includes subscription status calculated from the subscriptions table.

import { serve } from "$std/http/server.ts";
import { getServiceClient } from "shared/supabase.ts";
import { requireAdmin } from "shared/auth.ts";
import { methodNotAllowed, ok, serverError } from "shared/http.ts";

const supabase = getServiceClient();

serve(async (req) => {
  const guard = requireAdmin(req);
  if (guard) return guard;
  if (req.method !== "GET") return methodNotAllowed(["GET"]);
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        `user_id, whatsapp_e164, ref_code, credits_balance, created_at,
         subscriptions:subscriptions(status, expires_at)`,
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
      return {
        user_id: row.user_id,
        whatsapp_e164: row.whatsapp_e164,
        ref_code: row.ref_code,
        credits_balance: row.credits_balance ?? 0,
        subscription_status,
        created_at: row.created_at,
      };
    });
    return ok({ users });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return serverError(message);
  }
});
