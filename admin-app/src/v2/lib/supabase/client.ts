import { createBrowserClient, createServerClient } from "@supabase/ssr";
import type { CookieMethodsServer } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
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
  const { cookies } = await import("next/headers");
  
  type CookieStore = ReturnType<typeof cookies>;
  type CookieSetOptions = Parameters<CookieStore["set"]>[2];

  function tryGetCookies(): CookieStore | undefined {
    try {
      return cookies();
    } catch {
      return undefined;
    }
  }

  const cookieStore = tryGetCookies();

  const cookiesAdapter: CookieMethodsServer = cookieStore
    ? {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieSetOptions }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component contexts may not allow cookie mutation.
          }
        },
      }
    : {
        getAll() {
          return [];
        },
        setAll(_cookies: Array<{ name: string; value: string; options: CookieSetOptions }>) {
          // No-op when cookies cannot be mutated in this environment.
        },
      };

  return createServerClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: cookiesAdapter,
    },
  );
}

export async function createAdminClient(): Promise<SupabaseClient> {
  if (typeof window !== "undefined") {
    throw new Error("Admin client can only be used on the server");
  }

  const { cookies } = await import("next/headers");
  
  type CookieStore = ReturnType<typeof cookies>;
  type CookieSetOptions = Parameters<CookieStore["set"]>[2];

  function tryGetCookies(): CookieStore | undefined {
    try {
      return cookies();
    } catch {
      return undefined;
    }
  }

  const cookieStore = tryGetCookies();

  const cookieAdapter = cookieStore
    ? {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        getAll() {
          return cookieStore.getAll();
        },
        set(name: string, value: string, options?: CookieSetOptions) {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Route handlers cannot always mutate cookies synchronously.
          }
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieSetOptions }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // Ignore outside request contexts.
            }
          });
        },
      }
    : {
        get() {
          return undefined;
        },
        getAll() {
          return [];
        },
        set() {},
        setAll(_cookies?: Array<{ name: string; value: string; options?: CookieSetOptions }>) {},
      };

  return createServerClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      cookies: cookieAdapter,
    },
  ) as unknown as SupabaseClient;
}
