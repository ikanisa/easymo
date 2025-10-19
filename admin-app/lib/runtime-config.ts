const rawUseMocks = process.env.NEXT_PUBLIC_USE_MOCKS ?? "false";
const useMocksFlag = rawUseMocks.trim().toLowerCase() === "true";

export type SupabaseClientConfig = {
  url: string;
  anonKey: string;
};

export type SupabaseServiceConfig = {
  url: string;
  serviceRoleKey: string;
};

export function shouldUseMocks(): boolean {
  if (process.env.NODE_ENV === "production" && useMocksFlag) {
    if (typeof window === "undefined") {
      // eslint-disable-next-line no-console
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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase service-role credentials are missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or enable NEXT_PUBLIC_USE_MOCKS=true).",
    );
  }

  return { url, serviceRoleKey };
}

function envOrNull(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getVoiceBridgeApiUrl(): string | null {
  return envOrNull(
    process.env.VOICE_BRIDGE_API_URL ?? process.env.NEXT_PUBLIC_VOICE_BRIDGE_API_URL,
  );
}

export function getAgentCoreUrl(): string | null {
  return envOrNull(
    process.env.AGENT_CORE_URL ?? process.env.NEXT_PUBLIC_AGENT_CORE_URL,
  );
}

export function getMarketplaceServiceUrls() {
  return {
    ranking: envOrNull(
      process.env.MARKETPLACE_RANKING_URL ?? process.env.NEXT_PUBLIC_MARKETPLACE_RANKING_URL,
    ),
    vendor: envOrNull(
      process.env.MARKETPLACE_VENDOR_URL ?? process.env.NEXT_PUBLIC_MARKETPLACE_VENDOR_URL,
    ),
    buyer: envOrNull(
      process.env.MARKETPLACE_BUYER_URL ?? process.env.NEXT_PUBLIC_MARKETPLACE_BUYER_URL,
    ),
    wallet: envOrNull(
      process.env.WALLET_SERVICE_URL ?? process.env.NEXT_PUBLIC_WALLET_SERVICE_URL,
    ),
  };
}
