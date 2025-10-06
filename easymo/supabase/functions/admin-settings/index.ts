import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import {
  createServiceRoleClient,
  handleOptions,
  json,
  logRequest,
  logResponse,
  requireAdminAuth,
} from "../_shared/admin.ts";

const supabase = createServiceRoleClient();

const patchSchema = z.object({
  subscription_price: z.number().nonnegative().optional(),
  search_radius_km: z.number().int().nonnegative().optional(),
  max_results: z.number().int().positive().optional(),
  momo_payee_number: z.string().min(5).max(32).optional(),
  support_phone_e164: z.string().min(5).max(32).optional(),
  admin_whatsapp_numbers: z.array(z.string()).optional(),
  pro_enabled: z.boolean().optional(),
}).strict();

Deno.serve(async (req) => {
  logRequest("admin-settings", req);

  if (req.method === "OPTIONS") {
    return handleOptions();
  }

  const authResponse = requireAdminAuth(req);
  if (authResponse) return authResponse;

  const method = req.method.toUpperCase();

  if (method === "GET") {
    try {
      const { data, error } = await supabase.from("app_config")
        .select("*")
        .single();
      if (error) {
        console.error("admin-settings.get_failed", error);
        return json({ error: "query_failed" }, 500);
      }
      logResponse("admin-settings", 200);
      return json({ config: data });
    } catch (error) {
      console.error("admin-settings.get_unhandled", error);
      return json({ error: "internal_error" }, 500);
    }
  }

  if (method === "POST") {
    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    const parseResult = patchSchema.safeParse(payload);
    if (!parseResult.success || Object.keys(parseResult.data).length === 0) {
      return json({ error: "invalid_payload" }, 400);
    }

    try {
      const { error } = await supabase.from("app_config")
        .update({ ...parseResult.data, updated_at: new Date().toISOString() })
        .eq("id", true);
      if (error) {
        console.error("admin-settings.update_failed", error);
        return json({ error: "update_failed" }, 500);
      }
      logResponse("admin-settings", 200, {
        fields: Object.keys(parseResult.data).length,
      });
      return json({ success: true });
    } catch (error) {
      console.error("admin-settings.update_unhandled", error);
      return json({ error: "internal_error" }, 500);
    }
  }

  return json({ error: "method_not_allowed" }, 405);
});
