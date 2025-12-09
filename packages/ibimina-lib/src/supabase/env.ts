export type SupabaseClientContext = string;

export type SupabaseEnvironment = {
  url: string;
  anonKey: string;
  accessToken?: string;
};

export type ResolveSupabaseEnvironmentOptions = {
  url?: string | null;
  anonKey?: string | null;
  accessToken?: string | null;
  context?: SupabaseClientContext;
  env?: Record<string, string | undefined>;
};

export class MissingSupabaseConfigError extends Error {
  constructor(name: string, context?: SupabaseClientContext) {
    const suffix = context ? ` for ${context}` : "";
    super(`Missing Supabase configuration${suffix}: ${name}`);
    this.name = "MissingSupabaseConfigError";
  }
}

const DEFAULT_URL_KEYS = [
  "EXPO_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL",
] as const;

const DEFAULT_ANON_KEY_KEYS = [
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_ANON_KEY",
] as const;

const DEFAULT_ACCESS_TOKEN_KEYS = ["SUPABASE_ACCESS_TOKEN", "SUPABASE_SERVICE_ROLE_KEY"] as const;

function resolveFromEnv(
  explicit: string | null | undefined,
  keys: readonly string[],
  env: Record<string, string | undefined>
): string | undefined {
  if (explicit) {
    return explicit;
  }

  for (const key of keys) {
    const value = env[key];
    if (value) {
      return value;
    }
  }

  return undefined;
}

export function resolveSupabaseEnvironment(
  options: ResolveSupabaseEnvironmentOptions = {}
): SupabaseEnvironment {
  const { context, env = process.env } = options;
  const url = resolveFromEnv(options.url, DEFAULT_URL_KEYS, env);
  const anonKey = resolveFromEnv(options.anonKey, DEFAULT_ANON_KEY_KEYS, env);
  const accessToken = resolveFromEnv(options.accessToken, DEFAULT_ACCESS_TOKEN_KEYS, env);

  if (!url) {
    throw new MissingSupabaseConfigError("SUPABASE_URL", context);
  }

  if (!anonKey) {
    throw new MissingSupabaseConfigError("SUPABASE_ANON_KEY", context);
  }

  return { url, anonKey, accessToken };
}
