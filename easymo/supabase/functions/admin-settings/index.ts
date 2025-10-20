import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import {
  createServiceRoleClient,
  handleOptions,
  json,
  logRequest,
  logResponse,
  requireAdminAuth,
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

const patchSchema = z.object({
  subscription_price: z.number().int().nonnegative().optional(),
  search_radius_km: z.number().int().nonnegative().optional(),
  max_results: z.number().int().positive().optional(),
  momo_payee_number: z.string().min(5).max(32).optional(),
  support_phone_e164: z.string().min(5).max(32).optional(),
  admin_whatsapp_numbers: z.array(z.string().min(5)).optional(),
}).strict();

function normalizeSettings(row: Record<string, unknown>) {
  return {
    subscription_price: row.subscription_price ?? null,
    search_radius_km: row.search_radius_km ?? null,
    max_results: row.max_results ?? null,
    momo_payee_number: row.momo_payee_number ?? null,
    support_phone_e164: row.support_phone_e164 ?? null,
    admin_whatsapp_numbers: Array.isArray(row.admin_whatsapp_numbers)
      ? row.admin_whatsapp_numbers
      : [],
    updated_at: row.updated_at ?? null,
  };
}

async function handleGet() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("settings")
    .select(
      "subscription_price,search_radius_km,max_results,momo_payee_number,support_phone_e164,admin_whatsapp_numbers,updated_at",
    )
    .eq("id", 1)
    .single();

  if (error) {
    console.error("admin-settings.get_failed", error);
    return json({ error: "query_failed" }, 500);
  }

  return json({ settings: normalizeSettings(data ?? {}) });
}

async function handlePost(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return json({ error: "invalid_payload" }, 400);
  }

  const supabase = getSupabase();
  const adminNumbers = parsed.data.admin_whatsapp_numbers
    ? parsed.data.admin_whatsapp_numbers.map((value) => value.trim()).filter(Boolean)
    : undefined;

  const { error } = await supabase.from("settings")
    .update({
      ...parsed.data,
      admin_whatsapp_numbers: adminNumbers,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) {
    console.error("admin-settings.update_failed", error);
    return json({ error: "update_failed" }, 500);
  }

  logResponse("admin-settings", 200, { fields: Object.keys(parsed.data).length });
  return handleGet();
}

export async function handler(req: Request): Promise<Response> {
  logRequest("admin-settings", req);

  if (req.method === "OPTIONS") {
    return handleOptions();
  }

  const authResponse = requireAdminAuth(req);
  if (authResponse) return authResponse;

  if (req.method === "GET") {
    return handleGet();
  }

  if (req.method === "POST") {
    return handlePost(req);
  }

  return json({ error: "method_not_allowed" }, 405);
}

if (import.meta.main) {
  Deno.serve(handler);
}
