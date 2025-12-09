import { createContentSecurityPolicy } from "./csp";
import { HSTS_HEADER, SECURITY_HEADERS } from "./constants";
import { createNonce, createRequestId } from "./random";

export type SecurityMiddlewareInit = {
  requestHeaders: Headers;
  defaultLocale?: string;
  isDev?: boolean;
  supabaseUrl?: string;
};

export type SecurityMiddlewareContext = {
  nonce: string;
  requestId: string;
  requestHeaders: Headers;
  applyResponseHeaders: (headers: Headers) => void;
};

export function createSecurityMiddlewareContext({
  requestHeaders,
  defaultLocale,
  isDev = false,
  supabaseUrl,
}: SecurityMiddlewareInit): SecurityMiddlewareContext {
  const nonce = createNonce();
  const updatedRequestHeaders = new Headers(requestHeaders);
  updatedRequestHeaders.set("x-csp-nonce", nonce);

  if (defaultLocale) {
    updatedRequestHeaders.set("x-next-intl-locale", defaultLocale);
  }

  const requestId = updatedRequestHeaders.get("x-request-id") ?? createRequestId();
  updatedRequestHeaders.set("x-request-id", requestId);

  const csp = createContentSecurityPolicy({ nonce, isDev, supabaseUrl });

  return {
    nonce,
    requestId,
    requestHeaders: updatedRequestHeaders,
    applyResponseHeaders(responseHeaders: Headers) {
      responseHeaders.set("Content-Security-Policy", csp);

      for (const header of SECURITY_HEADERS) {
        responseHeaders.set(header.key, header.value);
      }

      if (!isDev) {
        responseHeaders.set(HSTS_HEADER.key, HSTS_HEADER.value);
      }

      responseHeaders.set("X-Request-ID", requestId);
    },
  };
}
