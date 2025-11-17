export const dynamic = "force-dynamic";

import { z } from "zod";
import { createHandler } from "@/app/api/withObservability";
import { jsonError, jsonOk, zodValidationError } from "@/lib/api/http";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const bodySchema = z.object({
  businessId: z.string().min(1),
  ownerUserId: z.string().uuid().optional(),
  ownerWhatsapp: z.string().optional(),
});

export const POST = createHandler(
  "admin_api.businesses.claim",
  async (request, _context, { recordMetric }) => {
    const admin = getSupabaseAdminClient();
    if (!admin) {
      recordMetric("businesses.supabase_unavailable", 1);
      return jsonError({ error: "supabase_unavailable", message: "Supabase credentials missing." }, 503);
    }

    let body: z.infer<typeof bodySchema>;
    try {
      body = bodySchema.parse(await request.json());
    } catch (error) {
      recordMetric("businesses.claim.invalid_payload", 1);
      return zodValidationError(error);
    }

    const { data: row, error: selErr } = await admin
      .from("business")
      .select("id, claimed, owner_user_id, owner_whatsapp")
      .eq("id", body.businessId)
      .maybeSingle();
    if (selErr) {
      recordMetric("businesses.claim.select_error", 1);
      return jsonError({ error: "select_failed", message: selErr.message }, 500);
    }
    if (!row) {
      return jsonError({ error: "not_found", message: "Business not found" }, 404);
    }

    if (row.claimed) {
      return jsonError(
        { error: "already_claimed", message: "Business already claimed", details: { owner: { userId: row.owner_user_id, whatsapp: row.owner_whatsapp } } },
        409,
      );
    }

    const update: Record<string, unknown> = { claimed: true };
    if (body.ownerUserId) update.owner_user_id = body.ownerUserId;
    if (body.ownerWhatsapp) update.owner_whatsapp = body.ownerWhatsapp;

    const { error: updErr } = await admin
      .from("business")
      .update(update)
      .eq("id", body.businessId);
    if (updErr) {
      recordMetric("businesses.claim.update_error", 1);
      return jsonError({ error: "update_failed", message: updErr.message }, 500);
    }

    return jsonOk({ success: true });
  },
);

export const runtime = "nodejs";
