import {
  handleOptions,
  json,
  logRequest,
  logResponse,
  requireAdminAuth,
} from "../_shared/admin.ts";

const OPENAI_BASE_URL = "https://api.openai.com/v1";

let fetchImpl: typeof fetch = fetch;

export function setFetchImplementationForTesting(impl: typeof fetch) {
  fetchImpl = impl;
}

export async function handler(req: Request): Promise<Response> {
  const scope = "retrieval-search";
  logRequest(scope, req);

  if (req.method === "OPTIONS") {
    return handleOptions();
  }

  const authResponse = requireAdminAuth(req);
  if (authResponse) return authResponse;

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiKey) {
    return json({ error: "missing_openai_api_key" }, 500);
  }

  const defaultVectorStore = Deno.env.get("OPENAI_RETRIEVAL_VECTOR_STORE_ID") ?? "";

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (!payload || typeof payload !== "object") {
    return json({ error: "invalid_payload" }, 400);
  }

  const {
    query,
    vectorStoreId,
    maxResults,
    rewriteQuery,
    attributeFilter,
  } = payload as Record<string, unknown>;

  if (typeof query !== "string" || query.trim().length === 0) {
    return json({ error: "missing_query" }, 400);
  }

  const resolvedVectorStore =
    typeof vectorStoreId === "string" && vectorStoreId.trim().length > 0
      ? vectorStoreId.trim()
      : defaultVectorStore;

  if (!resolvedVectorStore) {
    return json({ error: "missing_vector_store_id" }, 400);
  }

  let normalizedMaxResults = 10;
  if (typeof maxResults === "number" && Number.isFinite(maxResults)) {
    normalizedMaxResults = Math.min(Math.max(Math.trunc(maxResults), 1), 50);
  } else if (typeof maxResults === "string" && maxResults.trim().length > 0) {
    const parsed = Number.parseInt(maxResults, 10);
    if (Number.isFinite(parsed)) {
      normalizedMaxResults = Math.min(Math.max(parsed, 1), 50);
    }
  }

  let normalizedFilter: Record<string, unknown> | undefined;
  if (attributeFilter) {
    if (typeof attributeFilter === "string") {
      try {
        const parsed = JSON.parse(attributeFilter);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          normalizedFilter = parsed as Record<string, unknown>;
        } else {
          return json({ error: "attribute_filter_must_be_object" }, 400);
        }
      } catch {
        return json({ error: "invalid_attribute_filter" }, 400);
      }
    } else if (typeof attributeFilter === "object" && !Array.isArray(attributeFilter)) {
      normalizedFilter = attributeFilter as Record<string, unknown>;
    } else {
      return json({ error: "attribute_filter_must_be_object" }, 400);
    }
  }

  const openAiBody: Record<string, unknown> = {
    query: query.trim(),
    max_num_results: normalizedMaxResults,
  };

  if (typeof rewriteQuery === "boolean") {
    openAiBody.rewrite_query = rewriteQuery;
  }

  if (normalizedFilter) {
    openAiBody.attribute_filter = normalizedFilter;
  }

  const startedAt = performance.now();

  let response: Response;
  try {
    response = await fetchImpl(
      `${OPENAI_BASE_URL}/vector_stores/${resolvedVectorStore}/search`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify(openAiBody),
      },
    );
  } catch (error) {
    logResponse(scope, 502, { status: "error", reason: "fetch_failed" });
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: "openai_request_failed", message }, 502);
  }

  const durationMs = Math.round(performance.now() - startedAt);

  if (!response.ok) {
    const errorText = await response.text();
    logResponse(scope, response.status, {
      status: "error",
      duration_ms: durationMs,
    });
    return json({
      error: "openai_request_failed",
      status: response.status,
      message: errorText,
    }, response.status);
  }

  let openAiPayload: Record<string, unknown> = {};
  try {
    openAiPayload = await response.json();
  } catch {
    return json({ error: "invalid_openai_response" }, 502);
  }

  const data = Array.isArray(openAiPayload.data)
    ? openAiPayload.data
    : [];

  const rewrittenQuery = typeof openAiPayload.search_query === "string"
    ? openAiPayload.search_query
    : undefined;

  const usage = openAiPayload.usage && typeof openAiPayload.usage === "object"
    ? openAiPayload.usage
    : undefined;

  const payloadResponse = {
    status: "ok" as const,
    query: {
      original: query.trim(),
      rewritten: rewrittenQuery,
      vector_store_id: resolvedVectorStore,
    },
    results: data,
    usage,
    meta: {
      took_ms: durationMs,
      has_more: Boolean(openAiPayload.has_more),
    },
  };

  logResponse(scope, 200, {
    result_count: data.length,
    duration_ms: durationMs,
  });

  return json(payloadResponse);
}

if (import.meta.main) {
  Deno.serve(handler);
}
