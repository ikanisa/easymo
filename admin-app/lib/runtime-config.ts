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

function resolveServiceUrl(): Nullable<string> {
  return (
    process.env.SUPABASE_URL ||
    process.env.SERVICE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    null
  );
}

function resolveServiceRoleKey(): Nullable<string> {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || null;
}

function hasServiceSupabaseConfig(): boolean {
  return Boolean(resolveServiceUrl()?.trim() && resolveServiceRoleKey()?.trim());
}

let autoMockWarningShown = false;
let serviceRoleWarningShown = false;

export type SupabaseClientConfig = {
  url: string;
  anonKey: string;
};

export type SupabaseServiceConfig = {
  url: string;
  serviceRoleKey: string;
};

export function shouldUseMocks(): boolean {
  const manualMockFlag = parseBoolean(process.env.NEXT_PUBLIC_USE_MOCKS);
  const supabaseReady = hasClientSupabaseConfig() && hasServiceSupabaseConfig();

  if (!manualMockFlag && !supabaseReady) {
    if (!autoMockWarningShown && typeof window === "undefined") {
      console.warn(
        "Supabase environment variables are missing; enabling mock data for build output.",
      );
    }
    autoMockWarningShown = true;
    return true;
  }

  if (process.env.NODE_ENV === "production" && manualMockFlag) {
    if (typeof window === "undefined") {
      console.error(
        "NEXT_PUBLIC_USE_MOCKS=true is not allowed in production; falling back to live services.",
      );
    }
    return false;
  }

  return manualMockFlag;
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

  const url = resolveServiceUrl();
  const serviceRoleKey = resolveServiceRoleKey();

  if (!url || !serviceRoleKey) {
    if (!serviceRoleWarningShown) {
      serviceRoleWarningShown = true;
      console.warn(
        "Supabase service-role credentials are missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or enable NEXT_PUBLIC_USE_MOCKS=true).",
      );
    }
    return null;
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

export function isUiKitEnabled(): boolean {
  return (process.env.NEXT_PUBLIC_UI_V2_ENABLED ?? "false").trim().toLowerCase() === "true";
}
