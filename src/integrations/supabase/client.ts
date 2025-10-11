import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

type SupabaseEnvKey = 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY';

function resolveSupabaseEnv(name: SupabaseEnvKey): string | undefined {
  const viteEnv = import.meta.env as Record<string, string | undefined> | undefined;
  const fromVite = viteEnv?.[name];
  if (typeof fromVite === 'string' && fromVite.length > 0) {
    return fromVite;
  }

  // Provide a secondary lookup for test runners or scripts that hydrate process.env
  if (typeof process !== 'undefined') {
    const fromProcess = (process.env as Record<string, string | undefined>)?.[name];
    if (typeof fromProcess === 'string' && fromProcess.length > 0) {
      return fromProcess;
    }
  }

  return undefined;
}

const SUPABASE_URL = resolveSupabaseEnv('VITE_SUPABASE_URL');
const SUPABASE_ANON_KEY = resolveSupabaseEnv('VITE_SUPABASE_ANON_KEY');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[supabase] VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY are not set. Live Supabase features are disabled.');
}

export const supabase = createClient<Database>(
  SUPABASE_URL ?? 'http://localhost:54321',
  SUPABASE_ANON_KEY ?? 'public-anon-key',
  {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
