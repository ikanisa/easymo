const globals = globalThis as {
  __WA_WEBHOOK_MOCKS__?: {
    serve?: typeof Deno.serve;
    createClient?: (...args: any[]) => unknown;
  };
};

const serveMock = globals.__WA_WEBHOOK_MOCKS__?.serve;
const createClientMock = globals.__WA_WEBHOOK_MOCKS__?.createClient;

export const serve = serveMock ?? Deno.serve;

import {
  createClient as createClientReal,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.4";

export { createClientReal as createClient };
export type { SupabaseClient };

export const createClientFactory = createClientMock ?? createClientReal;
export const crypto = globalThis.crypto;
export { TextDecoder, TextEncoder } from "node:util";

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
