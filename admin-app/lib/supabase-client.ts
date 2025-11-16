import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/v2/lib/supabase/database.types";
import { requireClientSupabaseConfig } from "./env-client";

let browserClient: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> | null {
  const config = requireClientSupabaseConfig();
  if (!config) return null;
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(config.url, config.anonKey, {
      cookieOptions: {
        lifetime: 60 * 60 * 24 * 30,
      },
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  return browserClient;
}
