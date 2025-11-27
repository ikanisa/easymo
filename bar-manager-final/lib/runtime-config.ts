/**
 * @deprecated Import from env-client.ts or env-server.ts instead.
 * This file provides backward compatibility but is unsafe for client bundles.
 */

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

let autoMockWarningShown = false;

export type SupabaseClientConfig = {
  url: string;
  anonKey: string;
};

export type SupabaseServiceConfig = {
  url: string;
  serviceRoleKey: string;
};

/**
 * Safe version for use in both client and server contexts.
 * Only checks client env vars that are safe to access from browser.
 */
export function shouldUseMocks(): boolean {
  const manualMockFlag = parseBoolean(process.env.NEXT_PUBLIC_USE_MOCKS);
  const clientSupabaseReady = hasClientSupabaseConfig();

  if (process.env.NODE_ENV === "production") {
    if (manualMockFlag) {
      throw new Error("NEXT_PUBLIC_USE_MOCKS cannot be true in production builds.");
    }
    if (!clientSupabaseReady) {
      throw new Error(
        "Supabase client environment variables are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY before building.",
      );
    }
    return false;
  }

  if (manualMockFlag) {
    return true;
  }

  if (!clientSupabaseReady) {
    if (!autoMockWarningShown && typeof window === "undefined") {
      console.warn(
        "Supabase client environment variables are missing; enabling mock data for local build output.",
      );
    }
    autoMockWarningShown = true;
    return true;
  }

  return false;
}

export function requireClientSupabaseConfig(): SupabaseClientConfig | null {
  if (shouldUseMocks()) {
    return null;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase client credentials are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  return { url, anonKey };
}

/**
 * @deprecated Use requireServiceSupabaseConfig from env-server.ts instead.
 * This is kept for backward compatibility but should only be used in server contexts.
 */
export function requireServiceSupabaseConfig(): SupabaseServiceConfig | null {
  // For backward compatibility in API routes, try to import from env-server
  // This will fail at runtime in browser, which is correct behavior
  if (typeof window !== "undefined") {
    throw new Error("requireServiceSupabaseConfig cannot be called from browser code. Use env-server.ts from server-only contexts.");
  }

  if (shouldUseMocks()) {
    return null;
  }

  const url = process.env.SUPABASE_URL || process.env.SERVICE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service-role credentials are missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
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
