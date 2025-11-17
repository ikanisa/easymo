// Note: This module is designed for server-side use only
// It has runtime checks and is primarily used in API routes or server components
import { createServerClient } from "@supabase/ssr";
import type {
  CookieMethodsServer,
  CookieMethodsServerDeprecated,
} from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/v2/lib/supabase/database.types";
import { requireServiceSupabaseConfig } from "../env-server";

type CookieAdapter = CookieMethodsServer & CookieMethodsServerDeprecated;

export function getSupabaseAdminClient(): SupabaseClient<Database> | null {
  if (typeof window !== "undefined") {
    throw new Error("Supabase admin client can only be used on the server");
  }

  const config = requireServiceSupabaseConfig();
  if (!config) {
    return null;
  }

  // Minimal cookie adapter: avoids direct next/headers dependency and async types.
  const cookieAdapter: CookieAdapter = {
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

  return createServerClient<Database>(config.url, config.serviceRoleKey, {
    cookies: cookieAdapter,
  });
}

export function resetSupabaseAdminClient() {
  // No cached state is maintained with the SSR helpers but the
  // function is kept for backwards compatibility with tests.
}
