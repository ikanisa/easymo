export interface RouterConfig {
  waVerifyToken: string;
  waAppSecret: string;
  routerEnabled: boolean;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  destinationAllowlist: Set<string>;
  rateLimitWindowSeconds: number;
  rateLimitMaxMessages: number;
  keywordCacheTtlMs: number;
  downstreamFetchTimeoutMs: number;
}

function parseNumber(envValue: string | undefined, fallback: number): number {
  if (!envValue) return fallback;
  const parsed = Number(envValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(): RouterConfig {
  const allowlistEnv = Deno.env.get("ROUTER_DEST_ALLOWLIST") ?? "";
  const allowlist = new Set(
    allowlistEnv
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );

  return {
    waVerifyToken: Deno.env.get("WA_VERIFY_TOKEN") ?? "",
    waAppSecret: Deno.env.get("WA_APP_SECRET") ?? "",
    routerEnabled: (Deno.env.get("ROUTER_ENABLED") ?? "true") !== "false",
    supabaseUrl: Deno.env.get("SUPABASE_URL") ?? undefined,
    supabaseServiceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? undefined,
    destinationAllowlist: allowlist,
    rateLimitWindowSeconds: parseNumber(Deno.env.get("ROUTER_RATE_LIMIT_WINDOW_SECONDS"), 60),
    rateLimitMaxMessages: parseNumber(Deno.env.get("ROUTER_RATE_LIMIT_MAX_MESSAGES"), 20),
    keywordCacheTtlMs: parseNumber(Deno.env.get("ROUTER_KEYWORD_CACHE_TTL_MS"), 30_000),
    downstreamFetchTimeoutMs: parseNumber(Deno.env.get("ROUTER_DEST_TIMEOUT_MS"), 7_000),
  };
}
