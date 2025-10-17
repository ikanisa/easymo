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

type SupabaseLike = ReturnType<typeof createServiceRoleClient>;

let cachedClient: SupabaseLike | null = null;

export function setSupabaseClientForTesting(client: SupabaseLike | null) {
  cachedClient = client;
}

function getSupabase(): SupabaseLike {
  if (cachedClient) return cachedClient;
  cachedClient = createServiceRoleClient();
  return cachedClient;
}

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(500),
  cursor: z.string().optional(),
});

function computeSubscriptionStatus(rows: Array<{ status: string; expires_at: string | null }> = []) {
  if (rows.length === 0) return "none";
  const active = rows.find((row) => {
    if (row.status !== "active") return false;
    if (!row.expires_at) return true;
    return new Date(row.expires_at).getTime() > Date.now();
  });
  return active ? "active" : "expired";
}

export async function handler(req: Request): Promise<Response> {
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
    const supabase = getSupabase();
    let builder = supabase.from("profiles").select(
      "user_id, whatsapp_e164, ref_code, credits_balance, created_at, subscriptions(status,expires_at)",
    ).order("created_at", { ascending: false }).limit(query.limit);

    if (query.cursor) {
      builder = builder.lt("created_at", query.cursor);
    }

    const { data, error } = await builder;
    if (error) {
      console.error("admin-users.query_failed", { error: error.message });
      return json({ error: "query_failed" }, 500);
    }

    const users = (data ?? []).map((row) => ({
      ...row,
      subscription_status: computeSubscriptionStatus(row.subscriptions ?? []),
    }));

    logResponse("admin-users", 200, { count: users.length });
    return new Response(
      JSON.stringify({
        users,
        next_cursor: users.length === query.limit
          ? users[users.length - 1]?.created_at ?? null
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
}

Deno.serve(handler);
