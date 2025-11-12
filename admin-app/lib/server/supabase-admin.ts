// Note: This module is designed for server-side use only
// It's safe without "server-only" import since it has runtime checks
// and is primarily used in API routes or server components
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { requireServiceSupabaseConfig } from "../env-server";

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

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (typeof window !== "undefined") {
    throw new Error("Supabase admin client can only be used on the server");
  }

  const config = requireServiceSupabaseConfig();
  if (!config) {
    return null;
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
          // but the interface requires the method to exist.
        },
        remove(..._args: unknown[]) {
          // Route handlers cannot mutate cookies synchronously
          // but the interface requires the method to exist.
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

  return createServerClient(config.url, config.serviceRoleKey, {
    cookies: cookieAdapter,
    headers: headerAdapter,
  });
}

export function resetSupabaseAdminClient() {
  // No cached state is maintained with the SSR helpers but the
  // function is kept for backwards compatibility with tests.
}
