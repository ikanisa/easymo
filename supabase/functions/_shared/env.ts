// Typed environment accessors for Deno edge functions

export function getEnv(key: string): string | null {
  const v = Deno.env.get(key);
  if (v && v.trim()) return v;
  return null;
}

export function requireEnv(key: string): string {
  const v = getEnv(key);
  if (!v) throw new Error(`Missing required env: ${key}`);
  return v;
}

export const CONFIG = {
  AGENT_CORE_URL: getEnv("AGENT_CORE_URL"),
  AGENT_CORE_TOKEN: getEnv("AGENT_CORE_TOKEN"),
  DEFAULT_TENANT_ID: getEnv("AGENT_CORE_TENANT_ID"),
};

export function getAdminToken(): string | null {
  return getEnv("EASYMO_ADMIN_TOKEN") ?? getEnv("ADMIN_TOKEN");
}

export function getSupabaseServiceConfig(): {
  url: string;
  serviceRoleKey: string;
} {
  const url = getEnv("SUPABASE_URL") ?? getEnv("SERVICE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY") ??
    getEnv("SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service credentials are not configured");
  }
  return { url, serviceRoleKey };
}
