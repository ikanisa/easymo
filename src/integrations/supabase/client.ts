import { createClient } from '@supabase/supabase-js';
import { env } from '../../env';
import type { Database } from './types';

const resolveFromProcess = (key: string): string | undefined => {
  if (typeof process === 'undefined') return undefined;
  const value = (process.env as Record<string, string | undefined>)[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const SUPABASE_URL = env.VITE_SUPABASE_URL ?? resolveFromProcess('VITE_SUPABASE_URL');
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY ?? resolveFromProcess('VITE_SUPABASE_ANON_KEY');

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
