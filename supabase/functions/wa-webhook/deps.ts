export { serve } from "https://deno.land/std@0.224.0/http/server.ts";
export { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
export type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
export { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";
export { encode as hexEncode } from "https://deno.land/std@0.224.0/encoding/hex.ts";
export { TextEncoder, TextDecoder } from "node:util";

export function base64Decode(input: string): Uint8Array {
  const binary = globalThis.atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
