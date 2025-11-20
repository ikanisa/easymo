import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv, getSupabaseServiceConfig } from "./env.ts";

const CLIENT_TTL_MS = (() => {
  const raw = getEnv("SUPABASE_SERVICE_CLIENT_CACHE_MS");
  if (!raw) return 300_000;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300_000;
})();

let cached: {
  client: SupabaseClient;
  config: { url: string; serviceRoleKey: string };
  expiresAt: number;
} | null = null;

export function getServiceClient(): SupabaseClient {
  const cfg = getSupabaseServiceConfig();
  const now = Date.now();
  if (
    cached &&
    cached.expiresAt > now &&
    cached.config.url === cfg.url &&
    cached.config.serviceRoleKey === cfg.serviceRoleKey
  ) {
    return cached.client;
  }
  const client = createClient(cfg.url, cfg.serviceRoleKey, {
    auth: { persistSession: false },
  });
  cached = {
    client,
    config: cfg,
    expiresAt: now + CLIENT_TTL_MS,
  };
  return client;
}

export function invalidateServiceClient(): void {
  cached = null;
}
