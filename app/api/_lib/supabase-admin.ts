import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

export function getServiceSupabaseClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase service configuration.');
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
    global: {
      fetch: (...args) => fetch(...args),
    },
  });

  return cachedClient;
}
