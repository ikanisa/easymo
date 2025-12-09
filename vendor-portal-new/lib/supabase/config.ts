import { logError, logWarn } from "@/lib/observability/logger";

const DEFAULT_STUB_URL = process.env.SUPABASE_STUB_URL?.trim() || "http://127.0.0.1:54321";
const DEFAULT_STUB_ANON_KEY = process.env.SUPABASE_STUB_ANON_KEY?.trim() || "stub-anon-key";
const ALLOWED_STUB_ENV = new Set(["development", "local"]);

export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

export type SupabaseConfigStatus = SupabaseConfig & {
  hasUrl: boolean;
  hasAnonKey: boolean;
};

function readSupabaseEnv(): SupabaseConfigStatus {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

  return {
    url,
    anonKey,
    hasUrl: url.length > 0,
    hasAnonKey: anonKey.length > 0,
  };
}

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  return readSupabaseEnv();
}

function getAppEnvironment(): string {
  return (process.env.APP_ENV ?? process.env.NODE_ENV ?? "development").toLowerCase();
}

function shouldAllowStubConfig(): boolean {
  if (process.env.SUPABASE_ALLOW_STUB === "1") {
    return true;
  }
  if (process.env.SUPABASE_ALLOW_STUB === "0") {
    return false;
  }
  if (!ALLOWED_STUB_ENV.has(getAppEnvironment())) {
    return false;
  }

  const stubUrl = process.env.SUPABASE_STUB_URL?.trim();
  const stubAnonKey = process.env.SUPABASE_STUB_ANON_KEY?.trim();
  return Boolean(stubUrl || stubAnonKey);
}

const warnedStubContexts = new Set<string>();

function warnStubFallback(context: string, configStatus: SupabaseConfigStatus) {
  if (warnedStubContexts.has(context)) {
    return;
  }
  warnedStubContexts.add(context);
  logWarn(
    `[supabase] Falling back to stub credentials for "${context}". ` +
      `Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to silence this warning.`,
    {
      appEnv: getAppEnvironment(),
      hasUrl: configStatus.hasUrl,
      hasAnonKey: configStatus.hasAnonKey,
    }
  );
}

function getStubSupabaseConfig(): SupabaseConfig {
  return {
    url: DEFAULT_STUB_URL,
    anonKey: DEFAULT_STUB_ANON_KEY,
  };
}

export function requireSupabaseConfig(context: string): SupabaseConfig {
  if (process.env.AUTH_E2E_STUB === "1") {
    return {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://stub.supabase.local",
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "stub-anon-key",
    };
  }

  const status = readSupabaseEnv();

  if (!status.hasUrl || !status.hasAnonKey) {
    if (shouldAllowStubConfig()) {
      warnStubFallback(context, status);
      return getStubSupabaseConfig();
    }

    logError("supabase.config.missing", {
      context,
      hasUrl: status.hasUrl,
      hasAnonKey: status.hasAnonKey,
    });

    const error = new Error(
      `Supabase environment variables are not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment (for example, apps/pwa/staff-admin/.env.local).`
    );
    error.name = "SupabaseConfigError";
    throw error;
  }

  return {
    url: status.url,
    anonKey: status.anonKey,
  };
}
