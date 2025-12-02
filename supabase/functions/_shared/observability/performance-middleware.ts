/**
 * Performance Middleware
 * Tracks request performance and reports metrics
 */

import { 
  recordRequestMetrics, 
  recordHistogram, 
  incrementCounter,
  startTimer 
} from "./metrics.ts";
import { logStructuredEvent } from "./logger.ts";

// ============================================================================
// TYPES
// ============================================================================

export type PerformanceConfig = {
  enabled: boolean;
  slowThresholdMs: number;
  logSlowRequests: boolean;
  sampleRate: number;
};

export type RequestMetadata = {
  requestId: string;
  service: string;
  path: string;
  method: string;
  startTime: number;
};

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: PerformanceConfig = {
  enabled: true,
  slowThresholdMs: 1000,
  logSlowRequests: true,
  sampleRate: 1.0,
};

// ============================================================================
// PERFORMANCE TRACKING
// ============================================================================

export function performanceMiddleware(config: Partial<PerformanceConfig> = {}) {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  return async (
    req: Request,
    handler: (req: Request) => Promise<Response>,
    metadata: Partial<RequestMetadata> = {}
  ): Promise<Response> => {
    if (!fullConfig.enabled) {
      return handler(req);
    }

    const url = new URL(req.url);
    const startTime = performance.now();
    const requestId = metadata.requestId || req.headers.get("x-request-id") || crypto.randomUUID();

    incrementCounter("concurrent_requests", { service: metadata.service || "unknown" });

    let response: Response;
    let error: Error | null = null;

    try {
      response = await handler(req);
    } catch (e) {
      error = e instanceof Error ? e : new Error(String(e));
      throw e;
    } finally {
      const durationMs = performance.now() - startTime;
      const statusCode = response?.status || (error ? 500 : 0);

      recordRequestMetrics(
        metadata.service || "unknown",
        url.pathname,
        req.method,
        statusCode,
        durationMs
      );

      if (fullConfig.logSlowRequests && durationMs > fullConfig.slowThresholdMs) {
        logStructuredEvent("SLOW_REQUEST", {
          requestId,
          path: url.pathname,
          method: req.method,
          durationMs,
          statusCode,
          threshold: fullConfig.slowThresholdMs,
        }, "warn");
      }

      incrementCounter("concurrent_requests_completed", { service: metadata.service || "unknown" });
    }

    return response!;
  };
}

let coldStartTracked = false;
const serviceStartTime = performance.now();

export function trackColdStart(service: string): void {
  if (coldStartTracked) return;
  
  const coldStartDuration = performance.now() - serviceStartTime;
  recordHistogram("cold_start_duration_ms", coldStartDuration, { service });
  incrementCounter("cold_starts_total", { service });
  
  logStructuredEvent("COLD_START", {
    service,
    durationMs: coldStartDuration.toFixed(2),
  });
  
  coldStartTracked = true;
}

export async function trackHandler<T>(
  name: string,
  handler: () => Promise<T>,
  labels: Record<string, string> = {}
): Promise<T> {
  const timer = startTimer();
  let success = true;
  
  try {
    return await handler();
  } catch (error) {
    success = false;
    throw error;
  } finally {
    const durationMs = timer();
    recordHistogram(`handler_duration_ms`, durationMs, { name, ...labels, success: String(success) });
    incrementCounter(`handler_calls_total`, { name, ...labels, success: String(success) });
  }
}

export async function trackDatabaseOp<T>(
  operation: string,
  table: string,
  op: () => Promise<T>
): Promise<T> {
  const timer = startTimer();
  let success = true;
  
  try {
    return await op();
  } catch (error) {
    success = false;
    throw error;
  } finally {
    const durationMs = timer();
    recordHistogram("db_operation_duration_ms", durationMs, { operation, table, success: String(success) });
  }
}

export async function trackApiCall<T>(
  api: string,
  operation: string,
  call: () => Promise<T>
): Promise<T> {
  const timer = startTimer();
  let success = true;
  
  try {
    return await call();
  } catch (error) {
    success = false;
    throw error;
  } finally {
    const durationMs = timer();
    recordHistogram("api_call_duration_ms", durationMs, { api, operation, success: String(success) });
  }
}
