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
