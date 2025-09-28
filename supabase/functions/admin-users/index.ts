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

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(500),
  cursor: z.string().optional(),
});

Deno.serve(async (req) => {
  logRequest("admin-users", req);

  if (req.method === "OPTIONS") {
    return handleOptions();
  }

  const authResponse = requireAdminAuth(req);
  if (authResponse) {
    return authResponse;
  }

  if (req.method !== "GET") {
    return json({ error: "method_not_allowed" }, 405);
  }

  let query;
  try {
    const url = new URL(req.url);
    query = querySchema.parse(Object.fromEntries(url.searchParams));
  } catch (error) {
    console.warn("admin-users.query_invalid", { error: String(error) });
    return json({ error: "invalid_query" }, 400);
  }

  try {
    let builder = supabase.from("profiles").select(
      "user_id, whatsapp_e164, ref_code, credits_balance, created_at",
    ).order("created_at", { ascending: false }).limit(query.limit);

    if (query.cursor) {
      builder = builder.lt("created_at", query.cursor);
    }

    const { data, error } = await builder;
    if (error) {
      console.error("admin-users.query_failed", { error: error.message });
      return json({ error: "query_failed" }, 500);
    }

    logResponse("admin-users", 200, { count: data?.length ?? 0 });
    return new Response(
      JSON.stringify({
        users: data ?? [],
        next_cursor: data?.length === query.limit
          ? data[data.length - 1]?.created_at ?? null
          : null,
      }),
      withCors({
        status: 200,
      }),
    );
  } catch (error) {
    console.error("admin-users.unhandled", error);
    return json({ error: "internal_error" }, 500);
  }
});
