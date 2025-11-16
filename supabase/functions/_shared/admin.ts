import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { getEnv, requireEnv } from "./env.ts";
import { withRequestInstrumentation } from "./observability.ts";

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

const CONFIG_TTL_MS = (() => {
  const raw = getEnv("ADMIN_CONFIG_CACHE_TTL_MS");
  if (!raw) return 300_000;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300_000;
})();

let cachedConfig: { value: AdminConfig; expiresAt: number } | null = null;
let cachedClient: {
  client: SupabaseClient;
  config: AdminConfig;
  expiresAt: number;
} | null = null;

export function loadAdminConfig(): AdminConfig {
  const now = Date.now();
  if (cachedConfig && cachedConfig.expiresAt > now) {
    return cachedConfig.value;
  }
  const supabaseUrl = requireEnv("SUPABASE_URL", ["SERVICE_URL"]);
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY", [
    "SERVICE_ROLE_KEY",
  ]);
  const adminToken = requireEnv("ADMIN_TOKEN", ["EASYMO_ADMIN_TOKEN"]);
  const config = { supabaseUrl, serviceRoleKey, adminToken };
  cachedConfig = { value: config, expiresAt: now + CONFIG_TTL_MS };
  return config;
}

export function createServiceRoleClient() {
  const config = loadAdminConfig();
  const now = Date.now();
  if (
    cachedClient &&
    cachedClient.expiresAt > now &&
    cachedClient.config.supabaseUrl === config.supabaseUrl &&
    cachedClient.config.serviceRoleKey === config.serviceRoleKey
  ) {
    return cachedClient.client;
  }
  const client = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false },
  });
  cachedClient = {
    client,
    config,
    expiresAt: now + CONFIG_TTL_MS,
  };
  return client;
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

export function parseNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export const withAdminTracing = (
  scope: string,
  handler: (req: Request, ctx: { requestId: string; startedAt: number }) => Response | Promise<Response>,
) => withRequestInstrumentation(scope, handler);
