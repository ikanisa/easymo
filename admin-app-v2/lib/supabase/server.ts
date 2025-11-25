import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

function getEnv(name: string): string | undefined {
  return process.env[name];
}

function requireEnv(name: string): string {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`${name} is required to initialize the Supabase client.`);
  }
  return value;
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component - cannot modify cookies
          }
        },
      },
    }
  );
}

/**
 * Create a Supabase client with service role key for admin operations.
 * Only use this in server-side code for operations that bypass RLS.
 */
export async function createServiceClient() {
  const cookieStore = await cookies();
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  
  // Fall back to anon key if service role key is not available
  const key = serviceRoleKey || requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component
          }
        },
      },
    }
  );
}
