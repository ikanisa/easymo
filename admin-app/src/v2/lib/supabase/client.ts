import { createBrowserClient, createServerClient } from "@supabase/ssr";
import type { Database } from "./database.types";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to initialise the Supabase client.`);
  }
  return value;
}

export function createClient() {
  return createBrowserClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
}

// Server-side functions - only import when needed
export async function createServerSupabaseClient() {
  const { cookies, headers } = await import("next/headers");
  
  type CookieStore = ReturnType<typeof cookies>;
  type HeaderStore = ReturnType<typeof headers>;

  function tryGetCookies(): CookieStore | undefined {
    try {
      return cookies();
    } catch {
      return undefined;
    }
  }

  function tryGetHeaders(): HeaderStore | undefined {
    try {
      return headers();
    } catch {
      return undefined;
    }
  }

  const cookieStore = tryGetCookies();
  const headerStore = tryGetHeaders();

  return createServerClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: cookieStore
        ? {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options),
                );
              } catch {
                // Server Component
              }
            },
          }
        : undefined,
    },
  );
}

export async function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("Admin client can only be used on the server");
  }

  const { cookies, headers } = await import("next/headers");
  
  type CookieStore = ReturnType<typeof cookies>;
  type HeaderStore = ReturnType<typeof headers>;

  function tryGetCookies(): CookieStore | undefined {
    try {
      return cookies();
    } catch {
      return undefined;
    }
  }

  function tryGetHeaders(): HeaderStore | undefined {
    try {
      return headers();
    } catch {
      return undefined;
    }
  }

  const cookieStore = tryGetCookies();
  const headerStore = tryGetHeaders();

  const cookieAdapter = cookieStore
    ? {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(..._args: unknown[]) {
          // Route handlers cannot mutate cookies synchronously
        },
        remove(..._args: unknown[]) {
          // Route handlers cannot mutate cookies synchronously
        },
      }
    : undefined;

  const headerAdapter = headerStore
    ? {
        get(name: string) {
          return headerStore.get(name) ?? undefined;
        },
      }
    : undefined;

  return createServerClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      cookies: cookieAdapter,
      headers: headerAdapter,
    },
  );
}
