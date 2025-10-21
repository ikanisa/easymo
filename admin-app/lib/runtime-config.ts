import { env } from "./env.server";

const useMocksFlag = env.useMocks;

export type SupabaseClientConfig = {
  url: string;
  anonKey: string;
};

export type SupabaseServiceConfig = {
  url: string;
  serviceRoleKey: string;
};

export function shouldUseMocks(): boolean {
  if (env.nodeEnv === "production" && useMocksFlag) {
    if (typeof window === "undefined") {
      console.error(
        "NEXT_PUBLIC_USE_MOCKS=true is not allowed in production; falling back to live services.",
      );
    }
    return false;
  }
  return useMocksFlag;
}

export function requireClientSupabaseConfig(): SupabaseClientConfig | null {
  if (shouldUseMocks()) {
    return null;
  }

  const url = env.supabase.client.url;
  const anonKey = env.supabase.client.anonKey;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase client credentials are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or enable NEXT_PUBLIC_USE_MOCKS=true.",
    );
  }

  return { url, anonKey };
}

export function requireServiceSupabaseConfig(): SupabaseServiceConfig | null {
  if (shouldUseMocks()) {
    return null;
  }

  const url = env.supabase.service.url ?? env.supabase.client.url;
  const serviceRoleKey = env.supabase.service.serviceRoleKey;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase service-role credentials are missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or enable NEXT_PUBLIC_USE_MOCKS=true).",
    );
  }

  return { url, serviceRoleKey };
}

export function getVoiceBridgeApiUrl(): string | null {
  return env.serviceUrls.voiceBridge;
}

export function getAgentCoreUrl(): string | null {
  return env.serviceUrls.agentCore;
}

export function getMarketplaceServiceUrls() {
  return env.serviceUrls.marketplace;
}
