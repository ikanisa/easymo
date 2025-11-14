// Note: This module is designed for server-side use only
// It has runtime checks and is primarily used in API routes or server components
import { createServerClient } from "@supabase/ssr";
import type {
  CookieMethodsServer,
  CookieMethodsServerDeprecated,
} from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies as nextCookies } from "next/headers";
import { requireServiceSupabaseConfig } from "../env-server";

type CookieAdapter = CookieMethodsServer & CookieMethodsServerDeprecated;

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (typeof window !== "undefined") {
    throw new Error("Supabase admin client can only be used on the server");
  }

  const config = requireServiceSupabaseConfig();
  if (!config) {
    return null;
  }

  let cookieStore: ReturnType<typeof nextCookies> | undefined;
  try {
    cookieStore = nextCookies();
  } catch {
    cookieStore = undefined;
  }

  const cookieAdapter: CookieAdapter = cookieStore
    ? {
        get(name) {
          return cookieStore!.get(name)?.value;
        },
        getAll() {
          return cookieStore!
            .getAll()
            .map(({ name, value }) => ({ name, value })) ?? [];
        },
        set(name, value, options) {
          try {
            cookieStore!.set({ name, value, ...(options ?? {}) });
          } catch {
            // Ignore when running outside a Request context.
          }
        },
        remove(name, options) {
          try {
            cookieStore!.delete({ name, ...(options ?? {}) });
          } catch {
            // Ignore when running outside a Request context.
          }
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore!.set({ name, value, ...(options ?? {}) });
            } catch {
              // Ignore when running outside a Request context.
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
        remove() {},
        setAll() {},
      };

  return createServerClient(config.url, config.serviceRoleKey, {
    cookies: cookieAdapter,
  });
}

export function resetSupabaseAdminClient() {
  // No cached state is maintained with the SSR helpers but the
  // function is kept for backwards compatibility with tests.
}
