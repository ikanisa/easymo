// Note: This module is designed for server-side use only
// It's safe without "server-only" import since it has runtime checks
// and will throw errors if secrets are missing

type Nullable<T> = T | null;

function parseBoolean(value: string | undefined): boolean {
  return (value ?? "false").trim().toLowerCase() === "true";
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

export type SupabaseServiceConfig = {
  url: string;
  serviceRoleKey: string;
};

export function shouldUseMocksServer(): boolean {
  const manualMockFlag = parseBoolean(process.env.NEXT_PUBLIC_USE_MOCKS);
  const supabaseReady = hasServiceSupabaseConfig();

  if (process.env.NODE_ENV === "production") {
    if (manualMockFlag) {
      throw new Error("NEXT_PUBLIC_USE_MOCKS cannot be true in production builds.");
    }
    if (!supabaseReady) {
      throw new Error(
        "Supabase server environment variables are missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before building.",
      );
    }
    return false;
  }

  if (manualMockFlag) {
    return true;
  }

  return !supabaseReady;
}

export function requireServiceSupabaseConfig(): SupabaseServiceConfig | null {
  if (shouldUseMocksServer()) {
    return null;
  }

  const url = resolveServiceUrl();
  const serviceRoleKey = resolveServiceRoleKey();

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service-role credentials are missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  return { url, serviceRoleKey };
}
