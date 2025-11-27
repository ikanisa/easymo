import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import {
  createServiceRoleClient,
  handleOptions,
  json,
  logRequest,
  logResponse,
  requireAdminAuth,
} from "../_shared/admin.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";

const supabase = createServiceRoleClient();

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  from: z.string().optional(),
});

Deno.serve(async (req) => {
  // Rate limiting (200 req/min for admin endpoints)
  const rateLimitCheck = await rateLimitMiddleware(req, {
    limit: 200,
    windowSeconds: 60,
  });

  if (!rateLimitCheck.allowed) {
    return rateLimitCheck.response!;
  }

  logRequest("admin-messages", req);

  if (req.method === "OPTIONS") {
    return handleOptions();
  }

  const authResponse = requireAdminAuth(req);
  if (authResponse) return authResponse;

  if (req.method !== "GET") {
    return json({ error: "method_not_allowed" }, 405);
  }

  let query;
  try {
    query = querySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams),
    );
  } catch {
    return json({ error: "invalid_query" }, 400);
  }

  try {
    let builder = supabase.from("wa_messages").select(
      "id,from_e164,message_id,msg_type,text_body,created_at",
    ).order("id", { ascending: false }).limit(query.limit);

    if (query.from) {
      builder = builder.eq("from_e164", query.from);
    }

    const { data, error } = await builder;
    if (error) {
      console.error("admin-messages.query_failed", error);
      return json({ error: "query_failed" }, 500);
    }

    logResponse("admin-messages", 200, { count: data?.length ?? 0 });
    return json({ messages: data ?? [] });
  } catch (error) {
    console.error("admin-messages.unhandled", error);
    return json({ error: "internal_error" }, 500);
  }
});
