// Typed environment and secret accessors for Deno edge functions

import {
  getSecret,
  getSecretPair,
  requireSecret,
} from "./secrets.ts";

export function getEnv(key: string, fallbackKeys: string[] = []): string | null {
  return getSecret(key, { fallbackKeys });
}

export function requireEnv(key: string, fallbackKeys: string[] = []): string {
  return requireSecret(key, { fallbackKeys });
}

export const CONFIG = {
  AGENT_CORE_URL: getEnv("AGENT_CORE_URL"),
  AGENT_CORE_TOKEN: getEnv("AGENT_CORE_TOKEN"),
  DEFAULT_TENANT_ID: getEnv("AGENT_CORE_TENANT_ID"),
  SORA_API_KEY: getEnv("SORA_API_KEY"),
  WABA_ACCESS_TOKEN: getEnv("WABA_ACCESS_TOKEN", ["WHATSAPP_ACCESS_TOKEN"]),
  WABA_PHONE_NUMBER_ID: getEnv("WABA_PHONE_NUMBER_ID", ["WA_PHONE_ID"]),
  WABA_TEMPLATE_NAMESPACE: getEnv("WABA_TEMPLATE_NAMESPACE", [
    "WHATSAPP_TEMPLATE_NAMESPACE",
  ]),
  WABA_WEBHOOK_VERIFY_TOKEN: getEnv("WABA_WEBHOOK_VERIFY_TOKEN", [
    "WA_VERIFY_TOKEN",
  ]),
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
  return getEnv("EASYMO_ADMIN_TOKEN", ["ADMIN_TOKEN"]);
}

export function getInvitationDefaults(): {
  defaultRole: string;
  expiryDays: number;
} {
  const defaultRole = getEnv("ADMIN_INVITE_DEFAULT_ROLE") ?? "member";
  const rawExpiry = getEnv("ADMIN_INVITE_EXPIRY_DAYS");
  const parsed = rawExpiry ? Number.parseInt(rawExpiry, 10) : NaN;
  const expiryDays = Number.isFinite(parsed) && parsed > 0 ? parsed : 14;
  return { defaultRole, expiryDays };
}

export function getSupabaseServiceConfig(): {
  url: string;
  serviceRoleKey: string;
} {
  const url = requireEnv("SUPABASE_URL", ["SERVICE_URL"]);
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY", [
    "SERVICE_ROLE_KEY",
  ]);
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service credentials are not configured");
  }
  return { url, serviceRoleKey };
}

export function getRotatingSecret(
  key: string,
  fallbackKeys: string[] = [],
) {
  return getSecretPair(key, { fallbackKeys });
}
