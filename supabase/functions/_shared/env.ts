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
