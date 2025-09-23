export { serve } from "https://deno.land/std@0.224.0/http/server.ts";
export { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
export type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
export { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";
export { TextEncoder, TextDecoder } from "node:util";

export function base64Decode(input: string): Uint8Array {
  const binary = globalThis.atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function hexEncode(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}
