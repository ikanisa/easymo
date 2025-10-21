// Standardized HTTP helpers for Deno edge functions
export type JsonInit = ResponseInit & { headers?: HeadersInit };

export function json(data: unknown, init: JsonInit = {}): Response {
  const headers: HeadersInit = {
    "content-type": "application/json; charset=utf-8",
    ...(init.headers || {}),
  };
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function ok<T>(data: T, init: JsonInit = {}): Response {
  return json({ ok: true, data }, { status: 200, ...init });
}

export function badRequest(
  message: string,
  extra?: Record<string, unknown>,
  init: JsonInit = {},
): Response {
  return json({ ok: false, error: message, ...(extra || {}) }, {
    status: 400,
    ...init,
  });
}

export function unauthorized(
  message = "unauthorized",
  init: JsonInit = {},
): Response {
  return json({ ok: false, error: message }, { status: 401, ...init });
}

export function notFound(message = "not_found", init: JsonInit = {}): Response {
  return json({ ok: false, error: message }, { status: 404, ...init });
}

export function methodNotAllowed(
  allowed: string[],
  init: JsonInit = {},
): Response {
  return json({ ok: false, error: "method_not_allowed", allowed }, {
    status: 405,
    ...init,
  });
}

export function serverError(
  message = "internal_error",
  extra?: Record<string, unknown>,
  init: JsonInit = {},
): Response {
  return json({ ok: false, error: message, ...(extra || {}) }, {
    status: 500,
    ...init,
  });
}
