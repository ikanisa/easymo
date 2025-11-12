import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
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

type AdminClientOptions = {
  cookieStore?: CookieStore;
  headerStore?: HeaderStore;
};

export function createAdminClient(options: AdminClientOptions = {}) {
  if (typeof window !== "undefined") {
    throw new Error("Admin client can only be used on the server");
  }

  const cookieStore = options.cookieStore ?? tryGetCookies();
  const headerStore = options.headerStore ?? tryGetHeaders();

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

  return createServerClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      cookies: cookieAdapter,
      headers: headerAdapter,
    },
  );
}
