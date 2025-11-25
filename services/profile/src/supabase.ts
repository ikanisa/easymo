import { createClient, SupabaseClient } from "@supabase/supabase-js";

import { settings } from "./config";
import { logger } from "./logger";

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    if (!settings.supabaseUrl || !settings.supabaseServiceKey) {
      logger.warn("Supabase credentials not configured");
      throw new Error("Supabase credentials not configured");
    }
    supabaseInstance = createClient(settings.supabaseUrl, settings.supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseInstance;
}
