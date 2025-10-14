export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function jsonOk(body: unknown, status = 200): Response {
  return jsonResponse(body, { status });
}

export function jsonError(body: unknown, status = 400): Response {
  return jsonResponse(body, { status });
}
