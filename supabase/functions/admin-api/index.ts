import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-user, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireAdminAuth(req: Request): Response | null {
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("EASYMO_ADMIN_TOKEN");
  
  if (!expectedKey || apiKey !== expectedKey) {
    return json({ error: "unauthorized" }, 401);
  }
  return null;
}

async function handleHealth(req: Request): Promise<Response> {
  try {
    const { error } = await supabase.from("app_config").select("id").limit(1);
    
    if (error) {
      return json({ status: "error", db: "unreachable", error: error.message }, 500);
    }

    return json({
      status: "ok",
      supabase: "ok",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return json({ status: "error", reason: "unhandled", error: String(err) }, 500);
  }
}

async function handleMessages(req: Request): Promise<Response> {
  const querySchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
    from: z.string().optional(),
  });

  const url = new URL(req.url);
  let query;
  
  try {
    query = querySchema.parse(Object.fromEntries(url.searchParams));
  } catch {
    return json({ error: "invalid_query" }, 400);
  }

  try {
    let builder = supabase
      .from("wa_messages")
      .select("id,from_e164,message_id,msg_type,text_body,created_at")
      .order("id", { ascending: false })
      .limit(query.limit);

    if (query.from) {
      builder = builder.eq("from_e164", query.from);
    }

    const { data, error } = await builder;
    
    if (error) {
      return json({ error: "query_failed", details: error.message }, 500);
    }

    return json({ messages: data ?? [] });
  } catch (error) {
    return json({ error: "internal_error", details: String(error) }, 500);
  }
}

async function handleSettings(req: Request): Promise<Response> {
  const SettingsPatch = z.object({
    subscription_price: z.number().optional(),
    search_radius_km: z.number().optional(),
    max_results: z.number().optional(),
    momo_payee_number: z.string().optional(),
    support_phone_e164: z.string().optional(),
    admin_whatsapp_numbers: z.string().optional(),
  });

  const SAFE_FIELDS = [
    "id", "subscription_price", "search_radius_km", "max_results",
    "support_phone_e164", "created_at", "updated_at",
  ];

  function sanitizeSettings(settings: any): any {
    if (!settings) return null;
    const sanitized: any = {};
    for (const field of SAFE_FIELDS) {
      if (field in settings) {
        sanitized[field] = settings[field];
      }
    }
    return sanitized;
  }

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) {
      return json({ error: "query_failed", details: error.message }, 500);
    }
    
    return json({ config: sanitizeSettings(data) });
  }

  if (req.method === "POST") {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    const result = SettingsPatch.safeParse(body);
    if (!result.success) {
      return json({ error: "invalid_payload", details: result.error.errors }, 400);
    }

    const { data: existing, error: fetchErr } = await supabase
      .from("settings")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (fetchErr || !existing) {
      return json({ error: "settings_not_found" }, 404);
    }

    const { data: updated, error: updateErr } = await supabase
      .from("settings")
      .update(result.data)
      .eq("id", existing.id)
      .select("*")
      .maybeSingle();

    if (updateErr) {
      return json({ error: "update_failed", details: updateErr.message }, 500);
    }

    const actor = req.headers.get("x-admin-user") || "unknown";
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    await supabase.from("admin_audit_logs").insert({
      actor,
      action: "update_settings",
      changed_keys: Object.keys(result.data),
      ip,
    });

    return json({ config: sanitizeSettings(updated) });
  }

  return json({ error: "method_not_allowed" }, 405);
}

async function handleStats(req: Request): Promise<Response> {
  try {
    const [usersRes, messagesRes, tripsRes] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("wa_messages").select("id", { count: "exact", head: true }),
      supabase.from("mobility_trips").select("id", { count: "exact", head: true }),
    ]);

    return json({
      stats: {
        users: usersRes.count ?? 0,
        messages: messagesRes.count ?? 0,
        trips: tripsRes.count ?? 0,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return json({ error: "stats_failed", details: String(error) }, 500);
  }
}

async function handleUsers(req: Request): Promise<Response> {
  const querySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  });

  const url = new URL(req.url);
  let query;
  
  try {
    query = querySchema.parse(Object.fromEntries(url.searchParams));
  } catch {
    return json({ error: "invalid_query" }, 400);
  }

  try {
    const { data, error, count } = await supabase
      .from("profiles")
      .select("id,phone_number,wa_id,full_name,created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(query.offset, query.offset + query.limit - 1);

    if (error) {
      return json({ error: "query_failed", details: error.message }, 500);
    }

    return json({
      users: data ?? [],
      total: count ?? 0,
      limit: query.limit,
      offset: query.offset,
    });
  } catch (error) {
    return json({ error: "internal_error", details: String(error) }, 500);
  }
}

async function handleTrips(req: Request): Promise<Response> {
  const querySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    status: z.enum(["pending", "accepted", "completed", "cancelled"]).optional(),
  });

  const url = new URL(req.url);
  let query;
  
  try {
    query = querySchema.parse(Object.fromEntries(url.searchParams));
  } catch {
    return json({ error: "invalid_query" }, 400);
  }

  try {
    let builder = supabase
      .from("mobility_trips")
      .select("id,user_phone,driver_phone,status,created_at,completed_at")
      .order("created_at", { ascending: false })
      .limit(query.limit);

    if (query.status) {
      builder = builder.eq("status", query.status);
    }

    const { data, error } = await builder;

    if (error) {
      return json({ error: "query_failed", details: error.message }, 500);
    }

    return json({ trips: data ?? [] });
  } catch (error) {
    return json({ error: "internal_error", details: String(error) }, 500);
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const route = pathParts[pathParts.length - 1];

  if (route === "health") {
    return await handleHealth(req);
  }

  const authResponse = requireAdminAuth(req);
  if (authResponse) return authResponse;

  try {
    switch (route) {
      case "messages":
        return await handleMessages(req);
      case "settings":
        return await handleSettings(req);
      case "stats":
        return await handleStats(req);
      case "users":
        return await handleUsers(req);
      case "trips":
        return await handleTrips(req);
      default:
        return json({
          error: "route_not_found",
          available: ["health", "messages", "settings", "stats", "users", "trips"],
        }, 404);
    }
  } catch (error) {
    console.error("Admin API error:", error);
    return json({
      error: "internal_server_error",
      message: String(error),
    }, 500);
  }
});
