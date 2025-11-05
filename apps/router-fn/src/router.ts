import { loadConfig, RouterConfig } from "./config.ts";
import { RouterRepository, RouterRepositoryPort } from "./repository.ts";
import { NormalizedPayload, RouteResult, TelemetryRecord, WhatsAppWebhookPayload } from "./types.ts";
import { normalizePayload, verifySignature } from "./utils.ts";

export interface RouterDependencies {
  config: RouterConfig;
  repository: RouterRepositoryPort;
  fetchFn: typeof fetch;
  uuidFn: () => string;
}

const defaultConfig = loadConfig();
const defaultRepository = RouterRepository.fromEnv(
  defaultConfig.supabaseUrl,
  defaultConfig.supabaseServiceRoleKey,
  defaultConfig.keywordCacheTtlMs,
);

const defaultDependencies: RouterDependencies = {
  config: defaultConfig,
  repository: defaultRepository,
  fetchFn: fetch,
  uuidFn: () => crypto.randomUUID(),
};

interface KeywordMapEntry {
  slug: string;
  url: string;
}

type KeywordMap = Map<string, KeywordMapEntry[]>;

function buildKeywordMap(records: Awaited<ReturnType<RouterRepository["loadDestinations"]>>): KeywordMap {
  const map: KeywordMap = new Map();
  for (const record of records) {
    const key = record.keyword.toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push({ slug: record.destinationSlug, url: record.destinationUrl });
  }
  return map;
}

async function forwardToDestination(
  dependencies: RouterDependencies,
  destination: KeywordMapEntry,
  payload: NormalizedPayload,
  originalPayload: WhatsAppWebhookPayload,
): Promise<RouteResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), dependencies.config.downstreamFetchTimeoutMs);
  try {
    const response = await dependencies.fetchFn(destination.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ normalized: payload, original: originalPayload }),
      signal: controller.signal,
    });
    return {
      keyword: payload.keyword ?? "unknown",
      destinationUrl: destination.url,
      destinationSlug: destination.slug,
      status: response.status,
      responseTime: Date.now() - start,
    };
  } catch (error) {
    return {
      keyword: payload.keyword ?? "unknown",
      destinationUrl: destination.url,
      destinationSlug: destination.slug,
      status: 0,
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function processMessage(
  dependencies: RouterDependencies,
  payload: NormalizedPayload,
  originalPayload: WhatsAppWebhookPayload,
  keywordMap: KeywordMap,
  correlationId: string,
): Promise<void> {
  if (!payload.messageId) return;
  await dependencies.repository.recordTelemetry({ event: "message_accepted", messageId: payload.messageId });

  const idempotency = await dependencies.repository.upsertIdempotency(payload.messageId, payload.from);
  if (idempotency && !idempotency.inserted) {
    await dependencies.repository.recordTelemetry({
      event: "message_duplicate",
      messageId: payload.messageId,
      metadata: { correlationId },
    });
    await dependencies.repository.persistRouterLog(payload.messageId, payload.text, payload.keyword, "duplicate", {
      correlationId,
      reason: "already_processed",
    });
    return;
  }

  const rateLimit = await dependencies.repository.enforceRateLimit(
    payload.from,
    dependencies.config.rateLimitMaxMessages,
    dependencies.config.rateLimitWindowSeconds,
  );
  if (rateLimit && !rateLimit.allowed) {
    await dependencies.repository.recordTelemetry({
      event: "message_rate_limited",
      messageId: payload.messageId,
      metadata: { correlationId, count: rateLimit.count },
    });
    await dependencies.repository.persistRouterLog(payload.messageId, payload.text, payload.keyword, "rate_limited", {
      correlationId,
      count: rateLimit.count,
    });
    return;
  }

  const keyword = payload.keyword?.toLowerCase();
  const destinations = keyword ? keywordMap.get(keyword) ?? [] : [];
  if (destinations.length === 0) {
    await dependencies.repository.recordTelemetry({
      event: "keyword_unmatched",
      messageId: payload.messageId,
      keyword: keyword ?? "",
      metadata: { correlationId },
    });
    await dependencies.repository.persistRouterLog(payload.messageId, payload.text, keyword, "unmatched", {
      correlationId,
      keyword: keyword ?? "",
    });
    return;
  }

  const fanoutPromises = destinations.map((destination) =>
    forwardToDestination(dependencies, destination, payload, originalPayload)
      .then(async (result) => {
        await dependencies.repository.persistRouterLog(
          payload.messageId,
          payload.text,
          keyword,
          result.error ? "error" : "routed",
          {
            correlationId,
            destination: destination.slug,
            targetUrl: destination.url,
            targetStatus: result.status,
            responseTime: result.responseTime,
            error: result.error,
          },
        );
        if (result.error) {
          const telemetry: TelemetryRecord = {
            event: "downstream_error",
            messageId: payload.messageId,
            keyword,
            metadata: {
              correlationId,
              destination: destination.slug,
              status: result.status,
              error: result.error,
            },
          };
          await dependencies.repository.recordTelemetry(telemetry);
        } else {
          await dependencies.repository.recordTelemetry({
            event: "message_routed",
            messageId: payload.messageId,
            keyword,
            metadata: {
              correlationId,
              destination: destination.slug,
              status: result.status,
            },
          });
        }
      })
  );

  await Promise.allSettled(fanoutPromises);
}

async function handlePostRequest(
  dependencies: RouterDependencies,
  req: Request,
  correlationId: string,
): Promise<Response> {
  const rawBody = await req.text();
  console.log(JSON.stringify({ event: "REQUEST_RECEIVED", correlationId, bodySize: rawBody.length }));

  const signatureValid = await verifySignature(req, rawBody, dependencies.config.waAppSecret);
  if (!signatureValid) {
    console.log(JSON.stringify({ event: "SIGNATURE_VERIFICATION_FAILED", correlationId }));
    return new Response("Unauthorized", { status: 401 });
  }
  console.log(JSON.stringify({ event: "SIGNATURE_VERIFIED", correlationId }));

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    console.log(JSON.stringify({ event: "JSON_PARSE_ERROR", correlationId, error: String(error) }));
    return new Response("Bad Request", { status: 400 });
  }

  const normalized = normalizePayload(payload);
  console.log(JSON.stringify({ event: "PAYLOAD_NORMALIZED", correlationId, messageCount: normalized.length }));
  if (normalized.length === 0) {
    return new Response("ok", { status: 200 });
  }

  const destinations = await dependencies.repository.loadDestinations(dependencies.config.destinationAllowlist);
  const keywordMap = buildKeywordMap(destinations);
  console.log(JSON.stringify({ event: "DESTINATIONS_LOADED", correlationId, keywords: Array.from(keywordMap.keys()) }));

  void (async () => {
    try {
      await Promise.allSettled(
        normalized.map((message) => processMessage(dependencies, message, payload, keywordMap, correlationId)),
      );
    } catch (error) {
      console.error(JSON.stringify({ event: "PROCESSING_FAILURE", correlationId, error: String(error) }));
    }
  })();

  return new Response("ok", { status: 200 });
}

async function handleWithDependencies(
  dependencies: RouterDependencies,
  req: Request,
): Promise<Response> {
  const correlationId = dependencies.uuidFn();
  try {
    if (!dependencies.config.routerEnabled) {
      console.log(JSON.stringify({ event: "ROUTER_DISABLED", correlationId }));
      return new Response("Service Unavailable", { status: 503 });
    }

    if (req.method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      console.log(JSON.stringify({ event: "WEBHOOK_VERIFICATION_REQUEST", correlationId, mode }));
      if (mode === "subscribe" && token === dependencies.config.waVerifyToken) {
        return new Response(challenge ?? "", { status: 200 });
      }
      return new Response("Forbidden", { status: 403 });
    }

    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    return await handlePostRequest(dependencies, req, correlationId);
  } catch (error) {
    console.error(JSON.stringify({
      event: "UNHANDLED_ERROR",
      correlationId,
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }));
    return new Response("ok", { status: 200 });
  }
}

export function createRouterHandler(overrides: Partial<RouterDependencies> = {}): (req: Request) => Promise<Response> {
  const dependencies: RouterDependencies = {
    ...defaultDependencies,
    ...overrides,
    config: overrides.config ?? defaultDependencies.config,
    repository: overrides.repository ?? defaultDependencies.repository,
    fetchFn: overrides.fetchFn ?? defaultDependencies.fetchFn,
    uuidFn: overrides.uuidFn ?? defaultDependencies.uuidFn,
  };
  return (req: Request) => handleWithDependencies(dependencies, req);
}

const defaultHandler = createRouterHandler();

export function handleRequest(req: Request): Promise<Response> {
  return defaultHandler(req);
}
