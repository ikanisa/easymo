// Supabase Edge Function: admin-subscriptions
//
// Lists subscriptions or approves/rejects them based on the `action`
// query parameter.  Supported actions:
//   - list (default, GET): returns all subscriptions
//   - approve (POST): activate a subscription by id and optional txn_id
//   - reject (POST): reject a subscription by id with optional reason

import { serve } from "$std/http/server.ts";
import { getServiceClient } from "shared/supabase.ts";
import { requireAdmin } from "shared/auth.ts";
import { badRequest, methodNotAllowed, ok, serverError } from "shared/http.ts";

const supabase = getServiceClient();

serve(async (req) => {
  const guard = requireAdmin(req);
  if (guard) return guard;
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "list";
  try {
    if (action === "approve" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const id = Number(body.id);
      const txn_id = body.txn_id as string | undefined;
      if (!id) return badRequest("id_required");
      const updates: any = { status: "active" };
      if (txn_id) updates.txn_id = txn_id;
      const { error } = await supabase
        .from("subscriptions")
        .update(updates)
        .eq("id", id);
      if (error) return serverError(error.message);
      return ok({ ok: true });
    }
    if (action === "reject" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const id = Number(body.id);
      const reason = body.reason as string | undefined;
      if (!id) return badRequest("id_required");
      const updates: any = { status: "rejected" };
      if (reason) updates.rejection_reason = reason;
      const { error } = await supabase
        .from("subscriptions")
        .update(updates)
        .eq("id", id);
      if (error) return serverError(error.message);
      return ok({ ok: true });
    }
    // Default: list subscriptions
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return serverError(error.message);
    return ok({ subscriptions: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return serverError(message);
  }
});
