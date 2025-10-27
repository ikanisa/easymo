// Supabase Edge Function: admin-settings (Hardened)
//
// Provides read and update operations on the `settings` table.  This
// function requires callers to supply an `x-api-key` header that matches
// the EASYMO_ADMIN_TOKEN environment variable.  Use a service role key
// for Supabase to bypass Row Level Security when updating settings.
//
// Hardening features:
// - Max request body size enforcement (32 KB)
// - Schema validation with zod for allowed fields only
// - Audit logging to admin_audit_logs table
// - Returns only non-sensitive fields in responses

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

// Max body size: 32 KB
const MAX_BODY_SIZE = 32 * 1024;

// Define a schema for settings updates.  Only allow defined fields.
const SettingsPatch = z.object({
  subscription_price: z.number().optional(),
  search_radius_km: z.number().optional(),
  max_results: z.number().optional(),
  momo_payee_number: z.string().optional(),
  support_phone_e164: z.string().optional(),
  admin_whatsapp_numbers: z.string().optional(),
});

// Non-sensitive fields to return in responses
const SAFE_FIELDS = [
  "id",
  "subscription_price",
  "search_radius_km",
  "max_results",
  "support_phone_e164",
  "created_at",
  "updated_at",
];

// Helper to sanitize settings response
function sanitizeSettings(settings: any): any {
  if (!settings) return null;
  const sanitized: any = {};
  for (const field of SAFE_FIELDS) {
    if (field in settings) {
      sanitized[field] = settings[field];
    }
  }
  return sanitized;
}

// Helper to create audit log entry
async function createAuditLog(
  actor: string,
  action: string,
  changedKeys: string[],
  ip: string | null
) {
  await supabase.from("admin_audit_logs").insert({
    actor,
    action,
    changed_keys: changedKeys,
    ip,
  });
}

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
    return ok({ config: sanitizeSettings(data) });
  }

  if (req.method === "POST") {
    // Enforce max body size
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
      return badRequest("payload_too_large", {
        max_size: MAX_BODY_SIZE,
        received: contentLength,
      });
    }

    let bodyText: string;
    try {
      bodyText = await req.text();
      if (bodyText.length > MAX_BODY_SIZE) {
        return badRequest("payload_too_large", {
          max_size: MAX_BODY_SIZE,
          received: bodyText.length,
        });
      }
    } catch (err) {
      return badRequest("invalid_body", { error: String(err) });
    }

    let body: any;
    try {
      body = JSON.parse(bodyText);
    } catch (err) {
      return badRequest("invalid_json", { error: String(err) });
    }

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

    // Create audit log entry
    const actor = req.headers.get("x-admin-user") || "unknown";
    const ip = req.headers.get("x-forwarded-for") || 
               req.headers.get("x-real-ip") || 
               "unknown";
    const changedKeys = Object.keys(result.data);
    
    await createAuditLog(actor, "update_settings", changedKeys, ip);

    return ok({ config: sanitizeSettings(updated) });
  }
  return methodNotAllowed(["GET", "POST"]);
});
