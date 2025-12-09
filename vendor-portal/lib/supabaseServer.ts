import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logError } from "@/lib/observability/logger";
import type { Database } from "@/lib/supabase/types";
import { requireSupabaseConfig } from "@/lib/supabase/config";

type ClientOptions = NonNullable<Parameters<typeof createClient<Database>>[2]>;

function resolveServiceRoleKey(context: string): string {
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!rawKey || !rawKey.trim()) {
    logError("supabase.service-role.missing", { context });
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Ensure the service role key is available in the server environment."
    );
  }

  return rawKey.trim();
}

const defaultOptions: NonNullable<ClientOptions> = {
  auth: {
    persistSession: false,
  },
};

export function createSupabaseServiceRoleClient(
  context: string,
  options?: ClientOptions
): SupabaseClient<Database> {
  const { url } = requireSupabaseConfig(context);
  const serviceRoleKey = resolveServiceRoleKey(context);

  return createClient<Database>(url, serviceRoleKey, {
    ...defaultOptions,
    ...options,
    auth: {
      ...defaultOptions.auth,
      ...options?.auth,
    },
  });
}
