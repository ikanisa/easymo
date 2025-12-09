import { jsonResponse } from "./mod.ts";

const DEFAULT_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type, x-idempotency-key, x-signature, x-timestamp",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};

export const corsHeaders = (overrides?: Record<string, string>) => ({
  ...DEFAULT_HEADERS,
  ...(overrides ?? {}),
});

export const preflightResponse = (overrides?: Record<string, string>) =>
  new Response(null, {
    headers: corsHeaders(overrides),
  });

export const jsonCorsResponse = (
  data: unknown,
  init?: ResponseInit,
  overrides?: Record<string, string>
) =>
  jsonResponse(data, {
    ...init,
    headers: {
      ...corsHeaders(overrides),
      ...(init?.headers ?? {}),
    },
  });

export const errorCorsResponse = (
  message: string,
  status = 400,
  overrides?: Record<string, string>
) => jsonCorsResponse({ error: message }, { status }, overrides);
