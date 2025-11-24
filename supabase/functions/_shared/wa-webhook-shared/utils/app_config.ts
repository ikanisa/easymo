import type { SupabaseClient } from "../deps.ts";

type AppConfigRow = {
  search_radius_km?: number | null;
  max_results?: number | null;
  subscription_price?: number | null;
  wa_bot_number_e164?: string | null;
  admin_numbers?: string[] | null;
  insurance_admin_numbers?: string[] | null;
};

type ConfigCache = {
  value: AppConfigRow;
  loadedAt: number;
};

let cache: ConfigCache | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function getAppConfig(
  client: SupabaseClient,
): Promise<AppConfigRow> {
  const now = Date.now();
  if (cache && now - cache.loadedAt < TTL_MS) return cache.value;
  const { data, error } = await client
    .from("app_config")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    console.error("app_config.load_failed", error);
    cache = {
      value: {},
      loadedAt: now,
    };
    return cache.value;
  }
  cache = { value: data ?? {}, loadedAt: now };
  return cache.value;
}
