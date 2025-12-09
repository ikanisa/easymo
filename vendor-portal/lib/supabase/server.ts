<<<<<<< HEAD
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}
=======
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient as createSupabaseSSRClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { requireSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";

export const supabaseSrv = (): SupabaseClient<Database> =>
  createSupabaseServiceRoleClient("supabaseSrv");

export const supabaseAnon = (): SupabaseClient<Database> => {
  const { url, anonKey } = requireSupabaseConfig("supabaseAnon");

  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false },
  });
};

export async function createSupabaseServerClient() {
  const { url, anonKey } = requireSupabaseConfig("createSupabaseServerClient");

  const cookieStore = await cookies();

  return createSupabaseSSRClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Server Components cannot mutate response cookies; use middleware or server actions for writes.
      },
    },
  });
}

// --- Compatibility alias for older imports ---
export { createSupabaseServerClient as createServerClient };
>>>>>>> feature/location-caching-and-mobility-deep-review
