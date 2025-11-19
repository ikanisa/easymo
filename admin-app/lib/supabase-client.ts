import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/v2/lib/supabase/database.types";
import { requireClientSupabaseConfig } from "./env-client";

// Cookie lifetime for Supabase auth sessions (30 days)
// This is longer than server session TTL to allow for automatic session refresh
const COOKIE_LIFETIME_SECONDS = 60 * 60 * 24 * 30;

let browserClient: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> | null {
  const config = requireClientSupabaseConfig();
  if (!config) return null;
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(config.url, config.anonKey, {
      cookieOptions: {
        lifetime: COOKIE_LIFETIME_SECONDS,
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
