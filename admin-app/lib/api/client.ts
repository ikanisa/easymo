import { randomUUID } from "crypto";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type FetchOptions<TBody> = {
  method?: HttpMethod;
  body?: TBody;
  headers?: Record<string, string>;
  cache?: RequestCache;
  signal?: AbortSignal;
  revalidate?: number | false;
  tags?: string[];
};

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

export async function apiFetch<TResponse, TBody = unknown>(
  input: string,
  options: FetchOptions<TBody> = {},
): Promise<ApiResponse<TResponse>> {
  const requestId = randomUUID();
  const headers = new Headers(options.headers ?? {});
  headers.set("x-request-id", requestId);
  headers.set("Accept", "application/json");

  let body: BodyInit | undefined;
  if (options.body != null) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(input, {
      method: options.method ?? "GET",
      body,
      headers,
      cache: options.cache,
      signal: options.signal,
      next: {
        revalidate: options.revalidate,
        tags: options.tags,
      },
    });

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
