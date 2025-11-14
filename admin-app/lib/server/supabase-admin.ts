// Note: This module is designed for server-side use only
// It has runtime checks and is primarily used in API routes or server components
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireServiceSupabaseConfig } from "../env-server";

export async function getSupabaseAdminClient(): Promise<SupabaseClient | null> {
  if (typeof window !== "undefined") {
    throw new Error("Supabase admin client can only be used on the server");
  }

  const config = requireServiceSupabaseConfig();
  if (!config) {
    return null;
  }

  // Dynamically import next/headers to avoid build issues
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
        getAll() {
          return cookieStore.getAll();
        },
        set(name: string, value: string, options?: Parameters<typeof cookieStore.set>[2]) {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Route handlers cannot always mutate cookies synchronously.
          }
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Parameters<typeof cookieStore.set>[2] }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // Ignore when running outside a Request context.
            }
          });
        },
        remove(name: string, options?: Parameters<typeof cookieStore.delete>[1]) {
          try {
            cookieStore.delete(name, options);
          } catch {
            // Ignore when running outside a Request context.
          }
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
        setAll() {},
        remove() {},
      };

  const headerAdapter = headerStore
    ? {
        get(name: string) {
          return headerStore.get(name) ?? undefined;
        },
      }
    : undefined;

  return createServerClient(config.url, config.serviceRoleKey, {
    cookies: cookieAdapter,
    headers: headerAdapter,
  });
}

export function resetSupabaseAdminClient() {
  // No cached state is maintained with the SSR helpers but the
  // function is kept for backwards compatibility with tests.
}
