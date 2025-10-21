import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

type AdminConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  adminToken: string;
};

const BASE_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json",
};

let cachedConfig: AdminConfig | null = null;

export function loadAdminConfig(): AdminConfig {
  if (cachedConfig) return cachedConfig;
  const supabaseUrl = mustGetEnv("SUPABASE_URL");
  const serviceRoleKey = mustGetEnv(
    "SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  );
  const adminToken = mustGetEnv("ADMIN_TOKEN");
  cachedConfig = { supabaseUrl, serviceRoleKey, adminToken };
  return cachedConfig;
}

export function createServiceRoleClient() {
  const { supabaseUrl, serviceRoleKey } = loadAdminConfig();
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export function isAdminAuthenticated(req: Request): boolean {
  const { adminToken } = loadAdminConfig();
  return req.headers.get("x-admin-token") === adminToken;
}

export function withCors(init: ResponseInit = {}): ResponseInit {
  const headers = new Headers(init.headers ?? {});
  for (const [key, value] of Object.entries(BASE_CORS_HEADERS)) {
    headers.set(key, value);
  }
  return { ...init, headers };
}

export function json(
  body: unknown,
  status = 200,
  init: ResponseInit = {},
): Response {
  const finalInit = withCors({ status, ...init });
  return new Response(JSON.stringify(body), finalInit);
}

export function handleOptions(): Response {
  return new Response("ok", withCors({ status: 204 }));
}

export function requireAdminAuth(req: Request): Response | null {
  if (isAdminAuthenticated(req)) return null;
  console.warn("admin.auth_failure", {
    path: new URL(req.url).pathname,
  });
  return json({ error: "unauthorized" }, 401);
}

export function logRequest(
  scope: string,
  req: Request,
  extra: Record<string, unknown> = {},
): void {
  try {
    const url = new URL(req.url);
    console.info(`${scope}.request`, {
      method: req.method,
      path: url.pathname,
      search: url.search,
      ...extra,
    });
  } catch {
    console.info(`${scope}.request`, {
      method: req.method,
      rawUrl: req.url,
      ...extra,
    });
  }
}

export function logResponse(
  scope: string,
  status: number,
  extra: Record<string, unknown> = {},
): void {
  console.info(`${scope}.response`, { status, ...extra });
}

export function mustGetEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = Deno.env.get(key);
    if (value && value.length > 0) {
      return value;
    }
  }
  throw new Error(`Missing required env: ${keys.join("/")}`);
}

export function parseNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}
