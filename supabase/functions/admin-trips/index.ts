// Supabase Edge Function: admin-trips
//
// Lists or updates trips depending on the `action` parameter.  Supported
// actions:
//   - list (default, GET): return an array of trips ordered by created_at
//   - close (POST): mark a trip as closed/expired by id

import { serve } from "$std/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_URL = Deno.env.get("SERVICE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SERVICE_ROLE_KEY") ?? "";
const ADMIN_TOKEN = Deno.env.get("EASYMO_ADMIN_TOKEN") ??
  Deno.env.get("ADMIN_TOKEN") ?? "";

const SB_URL = SUPABASE_URL || SERVICE_URL;
if (!SB_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Supabase credentials are not configured");
}

const supabase = createClient(SB_URL, SERVICE_ROLE_KEY);

serve(async (req) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  const apiKey = req.headers.get("x-api-key");
  if (apiKey !== ADMIN_TOKEN) {
    return json({ error: "Forbidden" }, 403);
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "list";

  try {
    if (action === "close" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const id = Number((body as { id?: unknown }).id);
      if (!id) {
        return json({ error: "id is required" }, 400);
      }

      const { error } = await supabase
        .from("trips")
        .update({ status: "expired" })
        .eq("id", id);

      if (error) {
        return json({ error: error.message }, 500);
      }
      return json({ ok: true }, 200);
    }

    // Default: list trips (GET or otherwise)
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return json({ error: error.message }, 500);
    }

    return json({ trips: data ?? [] }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json({ error: message }, 500);
  }
});
