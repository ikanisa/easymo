/**
 * Observability utilities for Supabase Edge Functions
 * 
 * Provides structured logging, event tracking, and metrics recording
 * following EasyMO observability ground rules.
 * 
 * @see docs/GROUND_RULES.md for usage guidelines
 */

type LogLevel = "debug" | "info" | "warn" | "error";
type MetricDimensions = Record<string, string | number | boolean | null | undefined>;

/**
 * Log a structured event with consistent formatting
 * 
 * @param event - Event name (use ENTITY_ACTION format, e.g., "USER_CREATED")
 * @param details - Structured event data
 * @param level - Log level (default: info)
 * 
 * @example
 * await logStructuredEvent("PAYMENT_PROCESSED", {
 *   userId: user.id,
 *   amount: 1000,
 *   currency: "RWF"
 * });
 */
export function logStructuredEvent(
  event: string,
  details: Record<string, unknown> = {},
  level: LogLevel = "info",
): void {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    event,
    level,
    ...details,
  };

  switch (level) {
    case "error":
      console.error(JSON.stringify(logData));
      break;
    case "warn":
      console.warn(JSON.stringify(logData));
      break;
    case "debug":
      console.debug(JSON.stringify(logData));
      break;
    default:
      console.log(JSON.stringify(logData));
  }
}

/**
 * Log an error with context
 * 
 * Stack traces are only included in development environment
 * to prevent information leakage in production.
 * 
 * @param scope - Error scope/category
 * @param error - Error object or message
 * @param context - Additional context data
 * 
 * @example
 * logError("payment_processing", error, {
 *   userId: user.id,
 *   transactionId: tx.id
 * });
 */
export function logError(
  scope: string,
  error: unknown,
  context: Record<string, unknown> = {},
): void {
  const message = error instanceof Error ? error.message : String(error);
  
  // Only include stack traces in development to prevent information leakage
  const isDevelopment = Deno.env.get("APP_ENV") === "development" ||
                       Deno.env.get("NODE_ENV") === "development";
  const stack = (isDevelopment && error instanceof Error) ? error.stack : undefined;

  logStructuredEvent(
    `ERROR_${scope.toUpperCase()}`,
    {
      scope,
      error: message,
      stack,
      ...context,
    },
    "error",
  );
}

/**
 * Normalize metric dimensions to string values
 */
function normalizeDimensions(dimensions: MetricDimensions): Record<string, string> {
  const entries = Object.entries(dimensions)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => [key, String(value)] as const);
  return Object.fromEntries(entries);
}

/**
 * Record a metric/counter
 * 
 * @param name - Metric name (use dot notation, e.g., "user.created")
 * @param value - Metric value (default: 1 for counters)
 * @param dimensions - Additional dimensions for filtering/grouping
 * 
 * @example
 * await recordMetric("payment.processed", 1, {
 *   provider: "momo",
 *   currency: "RWF",
 *   status: "success"
 * });
 */
export function recordMetric(
  name: string,
  value = 1,
  dimensions: MetricDimensions = {},
): void {
  logStructuredEvent(
    "METRIC",
    {
      metric: name,
      value,
      dimensions: normalizeDimensions(dimensions),
    },
    "info",
  );
}

/**
 * Record a duration metric
 * 
 * @param name - Metric name
 * @param startedAt - Start timestamp (from Date.now())
 * @param dimensions - Additional dimensions
 * 
 * @example
 * const startTime = Date.now();
 * // ... perform operation ...
 * await recordDurationMetric("api.duration", startTime, {
 *   endpoint: "/api/users",
 *   method: "POST"
 * });
 */
export function recordDurationMetric(
  name: string,
  startedAt: number,
  dimensions: MetricDimensions = {},
): void {
  const durationMs = Date.now() - startedAt;
  recordMetric(name, durationMs, { ...dimensions, unit: "ms" });
}

/**
 * Record a gauge metric (current value snapshot)
 * 
 * @param name - Metric name
 * @param value - Current value
 * @param dimensions - Additional dimensions
 * 
 * @example
 * await recordGauge("queue.depth", queueSize, {
 *   queue: "notifications"
 * });
 */
export function recordGauge(
  name: string,
  value: number,
  dimensions: MetricDimensions = {},
): void {
  recordMetric(name, value, { ...dimensions, type: "gauge" });
}

/**
 * Mask sensitive data for logging
 * 
 * @param value - Value to mask
 * @param visibleStart - Number of characters to show at start (default: 4)
 * @param visibleEnd - Number of characters to show at end (default: 3)
 * 
 * @example
 * const masked = maskPII("+250788123456", 7, 3);
 * // Returns: "+250788***456"
 */
export function maskPII(
  value: string | null | undefined,
  visibleStart = 4,
  visibleEnd = 3,
): string | null {
  if (!value || typeof value !== "string") return null;
  if (value.length <= visibleStart + visibleEnd) return "***";

  const start = value.slice(0, visibleStart);
  const end = value.slice(-visibleEnd);
  return `${start}***${end}`;
}

/**
 * Create a correlation ID for request tracing
 */
export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

/**
 * Extract correlation ID from request headers
 */
export function getCorrelationId(req: Request): string {
  return req.headers.get("x-correlation-id") ||
    req.headers.get("x-request-id") ||
    generateCorrelationId();
}

/**
 * Log request with correlation tracking
 * 
 * @param scope - Request scope/endpoint name
 * @param req - Request object
 * @param extra - Additional context
 * 
 * @example
 * logRequest("user-create", req, { source: "whatsapp" });
 */
export function logRequest(
  scope: string,
  req: Request,
  extra: Record<string, unknown> = {},
): string {
  const correlationId = getCorrelationId(req);
  const url = new URL(req.url);

  logStructuredEvent(
    `${scope.toUpperCase()}_REQUEST`,
    {
      method: req.method,
      path: url.pathname,
      correlationId,
      ...extra,
    },
    "info",
  );

  return correlationId;
}

/**
 * Log response with correlation tracking
 * 
 * @param scope - Request scope/endpoint name
 * @param status - HTTP status code
 * @param extra - Additional context
 * 
 * @example
 * logResponse("user-create", 201, { userId: newUser.id, duration: 150 });
 */
export function logResponse(
  scope: string,
  status: number,
  extra: Record<string, unknown> = {},
): void {
  logStructuredEvent(
    `${scope.toUpperCase()}_RESPONSE`,
    {
      status,
      ...extra,
    },
    status >= 500 ? "error" : status >= 400 ? "warn" : "info",
  );
}

/**
 * Context object provided to edge function handlers wrapped with request instrumentation.
 * 
 * @property requestId - Unique identifier for the request, used for correlation tracking across logs and downstream services.
 * @property startedAt - Timestamp (in milliseconds) when the request started, useful for calculating request duration.
 */
type EdgeHandlerContext = {
  requestId: string;
  startedAt: number;
};

/**
 * Edge function handler signature for handlers wrapped with request instrumentation.
 * 
 * @param req - The incoming HTTP request to handle.
 * @param ctx - Context object containing request metadata (requestId and startedAt).
 * @returns A Response object or a Promise that resolves to a Response.
 * 
 * @example
 * const handler: EdgeHandler = async (req, ctx) => {
 *   console.log(`Handling request ${ctx.requestId}`);
 *   return new Response("OK", { status: 200 });
 * };
 */
type EdgeHandler = (
  req: Request,
  ctx: EdgeHandlerContext,
) => Promise<Response> | Response;

function createTracedFetch(baseFetch: typeof fetch, requestId: string): typeof fetch {
  return async (input: Request | URL | string, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set("x-request-id", requestId);
    headers.set("x-correlation-id", requestId);

    if (input instanceof Request) {
      return await baseFetch(new Request(input, { headers }));
    }

    const nextInit: RequestInit = { ...(init ?? {}), headers };
    return await baseFetch(input, nextInit);
  };
}

/**
 * Wraps a Supabase Edge Function handler with request tracing and structured logging.
 *
 * This function instruments the handler to:
 * - Automatically propagate and inject a request/correlation ID into all outgoing fetch requests.
 * - Log structured request and response events with timing and status.
 * - Intercept and restore the global fetch function for the duration of the handler.
 *
 * @param scope - Service or endpoint name for logging and event scoping (e.g., "wa-webhook").
 * @param handler - The edge function handler to wrap. Receives the instrumented Request and a context object containing the requestId and start time.
 * @returns A Deno-compatible request handler function suitable for use as a Supabase Edge Function entrypoint.
 *
 * @example
 * export const handleWaWebhook = withRequestInstrumentation("wa-webhook", async (req, ctx) => {
 *   // Your handler logic here
 *   return new Response("OK");
 * });
 */
export function withRequestInstrumentation(scope: string, handler: EdgeHandler) {
  return async (req: Request): Promise<Response> => {
    const requestId = getCorrelationId(req);
    const startedAt = Date.now();
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-request-id", requestId);
    requestHeaders.set("x-correlation-id", requestId);
    const instrumentedRequest = new Request(req, { headers: requestHeaders });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = createTracedFetch(originalFetch, requestId);

    logStructuredEvent(`${scope.toUpperCase()}_REQUEST`, {
      method: instrumentedRequest.method,
      path: new URL(instrumentedRequest.url).pathname,
      requestId,
    });

    try {
      const response = await handler(instrumentedRequest, { requestId, startedAt });
      const headers = new Headers(response.headers);
      headers.set("x-request-id", requestId);
      headers.set("x-correlation-id", requestId);
      const durationMs = Date.now() - startedAt;
      logStructuredEvent(`${scope.toUpperCase()}_RESPONSE`, {
        status: response.status,
        durationMs,
        requestId,
      });
      return new Response(response.body, { ...response, headers });
    } catch (error) {
      logStructuredEvent(`${scope.toUpperCase()}_RESPONSE`, {
        status: 500,
        requestId,
        error: error instanceof Error ? error.message : String(error),
      }, "error");
      throw error;
    } finally {
      globalThis.fetch = originalFetch;
    }
  };
}
