import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceConfig } from "shared/env.ts";

let client: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (client) return client;
  const cfg = getSupabaseServiceConfig();
  client = createClient(cfg.url, cfg.serviceRoleKey, {
    auth: { persistSession: false },
  });
  return client;
}
