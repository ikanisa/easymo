logStructuredEvent("DEBUG", { data: "DEBUG: utils/http.ts loaded from", import.meta.url });
const DEFAULT_TIMEOUT_MS = Math.max(
  Number(Deno.env.get("WA_HTTP_TIMEOUT_MS") ?? "10000") || 10000,
  1000,
);
const MAX_RETRIES = Math.max(
  Number(Deno.env.get("WA_HTTP_MAX_RETRIES") ?? "1") || 1,
  0,
);
const BASE_RETRY_DELAY_MS = Math.max(
  Number(Deno.env.get("WA_HTTP_RETRY_DELAY_MS") ?? "200") || 200,
  0,
);

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type FetchOptions = RequestInit & {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
};

export const fetchConfig = {
  implementation: globalThis.fetch,
};

export function setFetchImplementation(impl: any) {
  logStructuredEvent("DEBUG", { data: "DEBUG: setFetchImplementation called", impl });
  fetchConfig.implementation = impl;
}

export async function fetchWithTimeout(
  input: Request | URL | string,
  options: FetchOptions = {},
): Promise<Response> {
  const timeoutMs = Math.max(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 1);
  const retries = Math.max(options.retries ?? MAX_RETRIES, 0);
  const retryDelayMs = Math.max(
    options.retryDelayMs ?? BASE_RETRY_DELAY_MS,
    0,
  );

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      logStructuredEvent("DEBUG", { data: "DEBUG: fetchWithTimeout using implementation", fetchConfig.implementation });
      const response = await fetchConfig.implementation(input, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timer);
      return response;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      const isAbortError = error instanceof DOMException &&
        error.name === "AbortError";
      const isNetworkError = error instanceof TypeError;
      if (attempt >= retries || (!isAbortError && !isNetworkError)) {
        throw error;
      }
      if (retryDelayMs > 0) {
        await delay(retryDelayMs * Math.max(attempt, 1));
      }
    }
    attempt += 1;
  }

  throw lastError ?? new Error("fetch failed");
}
