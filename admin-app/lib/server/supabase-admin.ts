import "server-only";
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
