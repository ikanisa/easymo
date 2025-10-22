type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type FetchOptions<TBody> = {
  method?: HttpMethod;
  body?: TBody;
  headers?: Record<string, string>;
  cache?: RequestCache;
  signal?: AbortSignal;
  revalidate?: number | false;
  tags?: string[];
  credentials?: RequestCredentials;
};

function generateRequestId(): string {
  try {
    const cryptoRef = globalThis.crypto as { randomUUID?: () => string } | undefined;
    if (cryptoRef?.randomUUID) {
      return cryptoRef.randomUUID();
    }
  } catch (_) {
    // ignore and fall back
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export type ApiResponse<T> =
  | {
    ok: true;
    status: number;
    data: T;
    requestId: string;
  }
  | {
    ok: false;
    status: number;
    error: unknown;
    requestId: string;
  };

type NextFetchInit = RequestInit & { next?: { revalidate?: number | false; tags?: string[] } };

function resolveInternalApiBaseUrl(): string | undefined {
  const configuredBase =
    process.env.INTERNAL_API_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL;

  if (configuredBase) {
    return configuredBase;
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:8080";
  }

  return undefined;
}

export async function apiFetch<TResponse, TBody = unknown>(
  input: string,
  options: FetchOptions<TBody> = {},
): Promise<ApiResponse<TResponse>> {
  const requestId = generateRequestId();
  const headers = new Headers(options.headers ?? {});
  headers.set("x-request-id", requestId);
  headers.set("Accept", "application/json");

  const isRelativeRequest = !/^https?:/i.test(input);
  let url = input;

  if (isRelativeRequest && typeof window === "undefined") {
    const base = resolveInternalApiBaseUrl();

    if (!base) {
      return {
        ok: false,
        status: 0,
        error: new Error("Internal API base URL is not configured for server-side fetches."),
        requestId,
      };
    }

    url = base.replace(/\/$/, "") + (input.startsWith("/") ? input : `/${input}`);
  }

  let body: BodyInit | undefined;
  if (options.body != null) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      body,
      headers,
      cache: options.cache,
      signal: options.signal,
      credentials: options.credentials ?? 'same-origin',
      next: {
        revalidate: options.revalidate,
        tags: options.tags,
      },
    } as NextFetchInit);

    const status = response.status;
    const text = await response.text();
    const data = text ? (JSON.parse(text) as TResponse) : ({} as TResponse);

    if (!response.ok) {
      return { ok: false, status, error: data, requestId };
    }

    return { ok: true, status, data, requestId };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error,
      requestId,
    };
  }
}
