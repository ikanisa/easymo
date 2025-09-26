import { createClient, type SupabaseClient } from "./deps.ts";

function getEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = Deno.env.get(name);
    if (value) return value;
  }
  return undefined;
}

function mustGetOne(...names: string[]): string {
  const value = getEnv(...names);
  if (!value) {
    throw new Error(`Missing required env: ${names.join("/")}`);
  }
  return value;
}

export const SUPABASE_URL = mustGetOne("SUPABASE_URL");
export const SUPABASE_SERVICE_ROLE_KEY = mustGetOne(
  "SUPABASE_SERVICE_ROLE_KEY",
);
export const SUPABASE_ANON_KEY = getEnv("SUPABASE_ANON_KEY") ?? "";
export const WA_PHONE_ID = mustGetOne(
  "WA_PHONE_ID",
  "WHATSAPP_PHONE_NUMBER_ID",
);
export const WA_TOKEN = mustGetOne("WA_TOKEN", "WHATSAPP_ACCESS_TOKEN");
export const WA_APP_SECRET = mustGetOne("WA_APP_SECRET", "WHATSAPP_APP_SECRET");
export const WA_VERIFY_TOKEN = mustGetOne(
  "WA_VERIFY_TOKEN",
  "WHATSAPP_VERIFY_TOKEN",
);
export const OPENAI_API_KEY = getEnv("OPENAI_API_KEY") ?? "";
export const WA_BOT_NUMBER_E164 =
  getEnv("WA_BOT_NUMBER_E164", "WHATSAPP_PHONE_NUMBER_E164") ?? "";
export const QR_SALT = getEnv("QR_SALT") ?? "";
export const MENU_MEDIA_BUCKET = getEnv("MENU_MEDIA_BUCKET") ??
  "menu-source-files";
export const INSURANCE_MEDIA_BUCKET = getEnv("INSURANCE_MEDIA_BUCKET") ??
  "insurance-docs";
export const VOUCHER_SIGNING_SECRET = mustGetOne("VOUCHER_SIGNING_SECRET");
export const VOUCHER_BUCKET = getEnv("VOUCHERS_BUCKET") ?? "vouchers";

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
    global: { fetch: fetch.bind(globalThis) },
  },
);

export function assertRuntimeReady(): void {
  const required = [
    ["SUPABASE_URL"],
    ["SUPABASE_SERVICE_ROLE_KEY"],
    ["WA_PHONE_ID", "WHATSAPP_PHONE_NUMBER_ID"],
    ["WA_TOKEN", "WHATSAPP_ACCESS_TOKEN"],
    ["WA_APP_SECRET", "WHATSAPP_APP_SECRET"],
    ["WA_VERIFY_TOKEN", "WHATSAPP_VERIFY_TOKEN"],
    ["WA_BOT_NUMBER_E164", "WHATSAPP_PHONE_NUMBER_E164"],
  ];
  const missing = required.filter((candidates) => !getEnv(...candidates))
    .map((candidates) => candidates.join("/"));
  if (missing.length) {
    throw new Error(`Missing required envs: ${missing.join(", ")}`);
  }
}
