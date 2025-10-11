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

const CLIENT_ACTOR_STORAGE_KEY = 'admin:actorId';

function getClientActorId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const cookieMatch = document.cookie
    ?.split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith('admin_actor_id='));

  if (cookieMatch) {
    const [, value] = cookieMatch.split('=');
    if (value) return decodeURIComponent(value);
  }

  const stored = window.sessionStorage?.getItem(CLIENT_ACTOR_STORAGE_KEY);
  if (stored) return stored;

  const fallback = process.env.NEXT_PUBLIC_DEFAULT_ACTOR_ID ?? null;
  if (fallback) {
    window.sessionStorage?.setItem(CLIENT_ACTOR_STORAGE_KEY, fallback);
  }
  return fallback ?? null;
}

function resolveActorId(): string | null {
  if (typeof window === 'undefined') {
    return process.env.ADMIN_DEFAULT_ACTOR_ID ?? null;
  }
  return getClientActorId();
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

export async function apiFetch<TResponse, TBody = unknown>(
  input: string,
  options: FetchOptions<TBody> = {},
): Promise<ApiResponse<TResponse>> {
  const requestId = randomUUID();
  const headers = new Headers(options.headers ?? {});
  headers.set("x-request-id", requestId);
  headers.set("Accept", "application/json");

  const actorId = resolveActorId();
  if (actorId && !headers.has('x-actor-id')) {
    headers.set('x-actor-id', actorId);
  }

  let url = input;
  if (!/^https?:/i.test(input)) {
    const base = typeof window === 'undefined'
      ? process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      : '';
    if (base) {
      url = base.replace(/\/$/, '') + (input.startsWith('/') ? input : `/${input}`);
    }
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
