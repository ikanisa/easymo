// Supabase Edge Function: admin-users
//
// Returns an array of user objects for the admin panel.  Each user
// includes subscription status calculated from the subscriptions table.

import { serve } from "$std/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ADMIN_TOKEN = Deno.env.get("EASYMO_ADMIN_TOKEN") ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Supabase credentials are not configured");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

serve(async (req) => {
  const apiKey = req.headers.get("x-api-key");
  if (apiKey !== ADMIN_TOKEN) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
    });
  }
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
    });
  }
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        `user_id, whatsapp_e164, ref_code, credits_balance, created_at,
         subscriptions:subscriptions(status, expires_at)`,
      );
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
      });
    }
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
    return new Response(JSON.stringify({ users }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
