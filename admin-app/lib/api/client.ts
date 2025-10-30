/**
 * Minimal API client shim so older imports
 *   import { apiFetch } from "@/lib/api/client"
 * keep working across the codebase and in CI.
 *
 * This wrapper:
 * - prefixes relative paths with /api when needed
 * - sends JSON by default
 * - throws on non-2xx with a readable error
 */

export type ApiFetchInit = Omit<RequestInit, "body"> & {
  body?: unknown;
  headers?: Record<string, string>;
};

export async function apiFetch<T = unknown>(path: string, init: ApiFetchInit = {}): Promise<T> {
  const isAbsolute = /^https?:\/\//i.test(path) || path.startsWith("/");
  const url = isAbsolute ? path : `/api${path.startsWith("/") ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    "Accept": "application/json",
    ...(init.headers || {}),
  };

  // If caller passed a plain object, JSON-encode it
  let body: BodyInit | undefined;
  if (init.body !== undefined) {
    if (typeof init.body === "string" || init.body instanceof FormData || init.body instanceof Blob) {
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
    // Let callers opt into credentials if they need it
    credentials: init.credentials ?? "same-origin",
    cache: init.cache ?? "no-store",
    redirect: init.redirect ?? "follow",
    signal: init.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`apiFetch ${res.status} ${res.statusText} for ${url}${text ? ` – ${text.slice(0, 200)}` : ""}`);
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

// Convenience GET/POST helpers (optional, but handy)
export const apiGet = <T = unknown>(path: string, init: ApiFetchInit = {}) =>
  apiFetch<T>(path, { ...init, method: "GET" });

export const apiPost = <T = unknown>(path: string, body?: unknown, init: ApiFetchInit = {}) =>
  apiFetch<T>(path, { ...init, method: "POST", body });
