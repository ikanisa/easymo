// Minimal type shims so TS can typecheck Deno/URL imports used by Supabase edge code

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export interface SupabaseClient<_T = any, _S = any, _U = any> {}
  export function createClient(
    url: string,
    key: string,

    options?: any
  ): SupabaseClient<any, any, any>;
}

// Present in Supabase edge runtime; tests only need the type surface
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};
