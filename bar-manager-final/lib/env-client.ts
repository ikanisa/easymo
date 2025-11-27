type Nullable<T> = T | null;

function parseBoolean(value: string | undefined): boolean {
  return (value ?? "false").trim().toLowerCase() === "true";
}

function hasClientSupabaseConfig(): boolean {
  return Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim() &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim(),
  );
}

export type SupabaseClientConfig = {
  url: string;
  anonKey: string;
};

export function shouldUseMocksClient(): boolean {
  const manualMockFlag = parseBoolean(process.env.NEXT_PUBLIC_USE_MOCKS);
  const supabaseReady = hasClientSupabaseConfig();

  if (process.env.NODE_ENV === "production") {
    if (manualMockFlag) {
      throw new Error("NEXT_PUBLIC_USE_MOCKS cannot be true in production builds.");
    }
    if (!supabaseReady) {
      throw new Error(
        "Supabase client environment variables are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY before building.",
      );
    }
    return false;
  }

  if (manualMockFlag) {
    return true;
  }

  return !supabaseReady;
}

export function requireClientSupabaseConfig(): SupabaseClientConfig | null {
  if (shouldUseMocksClient()) {
    return null;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase client credentials are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  return { url, anonKey };
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

export function getInsuranceServiceUrl(): string | null {
  return envOrNull(
    process.env.INSURANCE_SERVICE_URL ?? process.env.NEXT_PUBLIC_INSURANCE_SERVICE_URL,
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

export function isUiKitEnabled(): boolean {
  return (process.env.NEXT_PUBLIC_UI_V2_ENABLED ?? "false").trim().toLowerCase() === "true";
}
