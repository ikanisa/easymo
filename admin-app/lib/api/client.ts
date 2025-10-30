/**
 * Minimal API client shim so older imports like:
 *   import { apiFetch, apiClient } from "@/lib/api/client"
 * keep working.
 *
 * - `apiFetch` is the core wrapper around fetch.
 * - `apiClient` provides { get, post, fetch } for legacy callsites.
 */

export type ApiFetchInit = Omit<RequestInit, "body" | "headers"> & {
  body?: unknown;
  headers?: Record<string, string>;
  /** Next.js hint accepted by some callers; ignored here but typed to avoid TS errors */
  revalidate?: number;
};

export async function apiFetch<T = unknown>(path: string, init: ApiFetchInit = {}): Promise<T> {
  const isAbsolute = /^https?:\/\//i.test(path) || path.startsWith("/");
  const url = isAbsolute ? path : `/api${path.startsWith("/") ? path : `/${path}`}`;

  // Force headers to a plain string map to avoid weird unions from HeadersInit
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init.headers ?? {}),
  };

  // If caller passed a plain object, JSON-encode it
  let body: BodyInit | undefined;
  if (init.body !== undefined) {
    if (
      typeof init.body === "string" ||
      init.body instanceof FormData ||
      init.body instanceof Blob ||
      init.body instanceof URLSearchParams ||
      ArrayBuffer.isView(init.body) ||
      init.body instanceof ArrayBuffer
    ) {
      body = init.body as any;
    } else {
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
      body = JSON.stringify(init.body);
    }
  }

  const res = await fetch(url, {
    method: init.method ?? (body ? "POST" : "GET"),
    headers,
    body,
    credentials: init.credentials ?? "same-origin",
    cache: init.cache ?? "no-store",
    redirect: init.redirect ?? "follow",
    signal: init.signal,
    // NOTE: we intentionally ignore init.revalidate here; this shim runs in both envs
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(
      `apiFetch ${res.status} ${res.statusText} for ${url}${text ? ` – ${text.slice(0, 200)}` : ""}`
    );
    // @ts-expect-error attach for debugging
    err.status = res.status;
    throw err;
  }

  // Try JSON first; fall back to text
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}

// Convenience helpers
export const apiGet = <T = unknown>(path: string, init: ApiFetchInit = {}) =>
  apiFetch<T>(path, { ...init, method: "GET" });

export const apiPost = <T = unknown>(path: string, body?: unknown, init: ApiFetchInit = {}) =>
  apiFetch<T>(path, { ...init, method: "POST", body });

/** Legacy shape used in a few modules */
export const apiClient = {
  fetch: apiFetch,
  get: apiGet,
  post: apiPost,
};
