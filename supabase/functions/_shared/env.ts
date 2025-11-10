// Typed environment accessors for Deno edge functions

export function getEnv(key: string): string | null {
  const v = Deno.env.get(key);
  if (v && v.trim()) return v;
  return null;
}

export function requireEnv(key: string): string {
  const v = getEnv(key);
  if (!v) throw new Error(`Missing required env: ${key}`);
  return v;
}

export const CONFIG = {
  AGENT_CORE_URL: getEnv("AGENT_CORE_URL"),
  AGENT_CORE_TOKEN: getEnv("AGENT_CORE_TOKEN"),
  DEFAULT_TENANT_ID: getEnv("AGENT_CORE_TENANT_ID"),
  SORA_API_KEY: getEnv("SORA_API_KEY"),
  WABA_ACCESS_TOKEN: getEnv("WABA_ACCESS_TOKEN") ?? getEnv("WHATSAPP_ACCESS_TOKEN"),
  WABA_PHONE_NUMBER_ID: getEnv("WABA_PHONE_NUMBER_ID") ?? getEnv("WA_PHONE_ID"),
  WABA_TEMPLATE_NAMESPACE: getEnv("WABA_TEMPLATE_NAMESPACE") ??
    getEnv("WHATSAPP_TEMPLATE_NAMESPACE"),
  WABA_WEBHOOK_VERIFY_TOKEN: getEnv("WABA_WEBHOOK_VERIFY_TOKEN") ??
    getEnv("WA_VERIFY_TOKEN"),
  MEDIA_TRANSCODE_PRESET_MASTER: getEnv("MEDIA_TRANSCODE_PRESET_MASTER"),
  MEDIA_TRANSCODE_PRESET_SOCIAL: getEnv("MEDIA_TRANSCODE_PRESET_SOCIAL"),
  MEDIA_TRANSCODE_PRESET_WHATSAPP: getEnv("MEDIA_TRANSCODE_PRESET_WHATSAPP"),
  MEDIA_TRANSCODE_PRESET_AUDIO: getEnv("MEDIA_TRANSCODE_PRESET_AUDIO"),
};

export function getWabaCredentials(): {
  accessToken: string | null;
  phoneNumberId: string | null;
  templateNamespace: string | null;
  verifyToken: string | null;
  businessId: string | null;
} {
  return {
    accessToken: CONFIG.WABA_ACCESS_TOKEN,
    phoneNumberId: CONFIG.WABA_PHONE_NUMBER_ID,
    templateNamespace: CONFIG.WABA_TEMPLATE_NAMESPACE,
    verifyToken: CONFIG.WABA_WEBHOOK_VERIFY_TOKEN,
    businessId: getEnv("WABA_BUSINESS_ID") ?? getEnv("META_WABA_BUSINESS_ID"),
  };
}

export function getMediaTranscodePresets(): {
  master: string | null;
  social: string | null;
  whatsapp: string | null;
  audio: string | null;
} {
  return {
    master: CONFIG.MEDIA_TRANSCODE_PRESET_MASTER,
    social: CONFIG.MEDIA_TRANSCODE_PRESET_SOCIAL,
    whatsapp: CONFIG.MEDIA_TRANSCODE_PRESET_WHATSAPP,
    audio: CONFIG.MEDIA_TRANSCODE_PRESET_AUDIO,
  };
}

export function getAdminToken(): string | null {
  return getEnv("EASYMO_ADMIN_TOKEN") ?? getEnv("ADMIN_TOKEN");
}

export function getSupabaseServiceConfig(): {
  url: string;
  serviceRoleKey: string;
} {
  const url = getEnv("SUPABASE_URL") ?? getEnv("SERVICE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY") ??
    getEnv("SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service credentials are not configured");
  }
  return { url, serviceRoleKey };
}
