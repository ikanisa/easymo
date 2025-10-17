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

const listQuerySchema = z.object({
  action: z.string().optional().default("list"),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  cursor: z.string().optional(),
});

const closeBodySchema = z.object({
  id: z.number().int().positive(),
}).strict();

async function listTrips(query: z.infer<typeof listQuerySchema>) {
  const supabase = getSupabase();
  let builder = supabase.from("trips").select(
    "id, creator_user_id, role, vehicle_type, status, created_at, lat, lng, profiles(ref_code,whatsapp_e164)",
  ).order("created_at", { ascending: false }).limit(query.limit);

  if (query.cursor) {
    builder = builder.lt("created_at", query.cursor);
  }

  const { data, error } = await builder;
  if (error) {
    console.error("admin-trips.list_failed", error);
    return json({ error: "query_failed" }, 500);
  }

  const trips = data ?? [];
  logResponse("admin-trips", 200, { count: trips.length });
  return new Response(
    JSON.stringify({
      trips,
      next_cursor: trips.length === query.limit
        ? trips[trips.length - 1]?.created_at ?? null
        : null,
    }),
    withCors({ status: 200 }),
  );
}

async function closeTrip(id: number) {
  const supabase = getSupabase();
  const { error } = await supabase.from("trips").update({
    status: "closed",
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("status", "active");

  if (error) {
    console.error("admin-trips.close_failed", error);
    return json({ error: "update_failed" }, 500);
  }

  logResponse("admin-trips", 200, { id });
  return json({ success: true });
}

export async function handler(req: Request): Promise<Response> {
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
      return await listTrips(query);
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
      return await closeTrip(parseResult.data.id);
    } catch (error) {
      console.error("admin-trips.close_unhandled", error);
      return json({ error: "internal_error" }, 500);
    }
  }

  return json({ error: "method_not_allowed" }, 405);
}

Deno.serve(handler);
