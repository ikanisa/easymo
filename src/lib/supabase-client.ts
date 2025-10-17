import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServiceRoleKey, getSupabaseUrl } from './env';

let cached: SupabaseClient | null = null;

export function getSupabaseServiceClient(): SupabaseClient {
  if (cached) {
    return cached;
  }

  const url = getSupabaseUrl();
  const serviceKey = getSupabaseServiceRoleKey();

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase configuration for admin client');
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false },
    global: {
      fetch: (...args) => fetch(...args),
    },
  });

  return cached;
}
