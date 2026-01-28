import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { childLogger } from "@easymo/commons";

const log = childLogger({ service: "web-supabase-client" });

let cachedClient: SupabaseClient | null = null;

export function getWebSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    log.error({ msg: "supabase_not_configured" });
    throw new Error("supabase_not_configured");
  }
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}
