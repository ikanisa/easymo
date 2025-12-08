// Supabase Edge Function: admin-trips
//
// Lists or updates trips depending on the `action` parameter.  Supported
// actions:
//   - list (default, GET): return an array of trips ordered by created_at
//   - close (POST): mark a trip as closed/expired by id

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { badRequest, methodNotAllowed, ok, serverError } from "../_shared/http.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";

const supabase = getServiceClient();

serve(async (req) => {
  // Rate limiting (200 req/min for admin endpoints)
  const rateLimitCheck = await rateLimitMiddleware(req, {
    limit: 200,
    windowSeconds: 60,
  });

  if (!rateLimitCheck.allowed) {
    return rateLimitCheck.response!;
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  const guard = requireAdmin(req);
  if (guard) return guard;

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "list";

  try {
    if (action === "close" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const id = (body as { id?: unknown }).id as string;
      if (!id) return badRequest("id_required");

      const { error } = await supabase
        .from("trips")
        .update({ status: "expired" })
        .eq("id", id);

      if (error) return serverError(error.message);
      return ok({ ok: true });
    }

    // Default: list trips (GET or otherwise)
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return serverError(error.message);
    return ok({ trips: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return serverError(message);
  }
});
