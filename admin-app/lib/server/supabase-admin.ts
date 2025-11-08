// Note: This module is designed for server-side use only
// It's safe without "server-only" import since it has runtime checks
// and is primarily used in API routes or server components
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { requireServiceSupabaseConfig } from "../env-server";

let adminClient: SupabaseClient | null = null;
let currentConfigKey: string | null = null;

export function getSupabaseAdminClient(): SupabaseClient | null {
  const config = requireServiceSupabaseConfig();
  if (!config) {
    return null;
  }

  const configKey = `${config.url}:${config.serviceRoleKey}`;
  if (!adminClient || currentConfigKey !== configKey) {
    adminClient = createClient(config.url, config.serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    });
    currentConfigKey = configKey;
  }

  return adminClient;
}

export function resetSupabaseAdminClient() {
  adminClient = null;
  currentConfigKey = null;
}
