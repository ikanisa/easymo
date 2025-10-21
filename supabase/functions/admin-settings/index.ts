// Supabase Edge Function: admin-settings
//
// Provides read and update operations on the `settings` table.  This
// function requires callers to supply an `x-api-key` header that matches
// the EASYMO_ADMIN_TOKEN environment variable.  Use a service role key
// for Supabase to bypass Row Level Security when updating settings.

import { serve } from "$std/http/server.ts";
import { z } from "zod";
import { getServiceClient } from "shared/supabase.ts";
import { requireAdmin } from "shared/auth.ts";
import {
  badRequest,
  methodNotAllowed,
  notFound,
  ok,
  serverError,
} from "shared/http.ts";

const supabase = getServiceClient();

// Define a schema for settings updates.  Only allow defined fields.
const SettingsPatch = z.object({
  subscription_price: z.number().optional(),
  search_radius_km: z.number().optional(),
  max_results: z.number().optional(),
  momo_payee_number: z.string().optional(),
  support_phone_e164: z.string().optional(),
  admin_whatsapp_numbers: z.string().optional(),
});

serve(async (req) => {
  const guard = requireAdmin(req);
  if (guard) return guard;

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) return serverError(error.message);
    return ok({ config: data });
  }

  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const result = SettingsPatch.safeParse(body);

    if (!result.success) {
      return badRequest("invalid_payload", { details: result.error.errors });
    }

    // Find the single settings row
    const { data: existing, error: fetchErr } = await supabase
      .from("settings")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (fetchErr) return serverError(fetchErr.message);

    if (!existing) return notFound("settings_missing");

    const { data: updated, error: updateErr } = await supabase
      .from("settings")
      .update(result.data)
      .eq("id", existing.id)
      .select("*")
      .maybeSingle();

    if (updateErr) return serverError(updateErr.message);
    return ok({ config: updated });
  }
  return methodNotAllowed(["GET", "POST"]);
});
