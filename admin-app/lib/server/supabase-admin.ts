import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { requireServiceSupabaseConfig } from "../runtime-config";

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient | null {
  const config = requireServiceSupabaseConfig();
  if (!config) return null;

  if (!adminClient) {
    adminClient = createClient(config.url, config.serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    });
  }

  return adminClient;
}
