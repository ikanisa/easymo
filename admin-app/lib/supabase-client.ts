import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { requireClientSupabaseConfig } from "./env-client";

let browserClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const config = requireClientSupabaseConfig();
  if (!config) return null;
  if (!browserClient) {
    browserClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false,
      },
    });
  }
  return browserClient;
}
