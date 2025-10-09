import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import {
  createServiceRoleClient,
  handleOptions,
  json,
  logRequest,
  logResponse,
  requireAdminAuth,
  withCors,
} from "../_shared/admin.ts";

const supabase = createServiceRoleClient();

const listQuerySchema = z.object({
  action: z.string().optional().default("list"),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  cursor: z.string().optional(),
});

const closeBodySchema = z.object({
  id: z.number().int().positive(),
}).strict();

Deno.serve(async (req) => {
  logRequest("admin-trips", req);

  if (req.method === "OPTIONS") {
    return handleOptions();
  }

  const authResponse = requireAdminAuth(req);
  if (authResponse) return authResponse;

  const url = new URL(req.url);

  if (req.method === "GET") {
    let query;
    try {
      query = listQuerySchema.parse(Object.fromEntries(url.searchParams));
    } catch {
      return json({ error: "invalid_query" }, 400);
    }

    if (query.action !== "list") {
      return json({ error: "invalid_action" }, 400);
    }

    try {
      let builder = supabase.from("trips").select(
        "id, creator_user_id, role, vehicle_type, status, created_at",
      ).order("created_at", { ascending: false }).limit(query.limit);

      if (query.cursor) {
        builder = builder.lt("created_at", query.cursor);
      }

      const { data, error } = await builder;
      if (error) {
        console.error("admin-trips.list_failed", error);
        return json({ error: "query_failed" }, 500);
      }

      logResponse("admin-trips", 200, { count: data?.length ?? 0 });
      return new Response(
        JSON.stringify({
          trips: data ?? [],
          next_cursor: data && data.length === query.limit
            ? data[data.length - 1]?.created_at ?? null
            : null,
        }),
        withCors({ status: 200 }),
      );
    } catch (error) {
      console.error("admin-trips.list_unhandled", error);
      return json({ error: "internal_error" }, 500);
    }
  }

  if (req.method === "POST") {
    const action = (url.searchParams.get("action") ?? "").toLowerCase();
    if (action !== "close") {
      return json({ error: "invalid_action" }, 400);
    }

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    const parseResult = closeBodySchema.safeParse(payload);
    if (!parseResult.success) {
      return json({ error: "invalid_payload" }, 400);
    }

    try {
      const { error } = await supabase.from("trips").update({
        status: "closed",
        updated_at: new Date().toISOString(),
      }).eq("id", parseResult.data.id).eq("status", "open");

      if (error) {
        console.error("admin-trips.close_failed", error);
        return json({ error: "update_failed" }, 500);
      }

      logResponse("admin-trips", 200, { id: parseResult.data.id });
      return json({ success: true });
    } catch (error) {
      console.error("admin-trips.close_unhandled", error);
      return json({ error: "internal_error" }, 500);
    }
  }

  return json({ error: "method_not_allowed" }, 405);
});
