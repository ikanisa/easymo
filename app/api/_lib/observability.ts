import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import pino, { LoggerOptions, Logger as PinoLogger } from 'pino';

export type RouteInstrumentationOptions = {
  latencyTargetMs?: number;
  errorBudget?: number;
  drainPayloadExtras?: Record<string, unknown>;
};

export type RouteContext = {
  traceId: string;
  spanId: string;
  logger: PinoLogger;
  request: Request;
  startedAt: number;
  slo: {
    latencyTargetMs: number;
    errorBudget: number;
  };
};

type DrainPayload = {
  traceId: string;
  spanId: string;
  route: string;
  method: string;
  status?: number;
  duration_ms: number;
  slo: RouteContext['slo'];
  timestamp: string;
  kind: 'api_request';
  extras?: Record<string, unknown>;
  error?: string;
};

const storage = new AsyncLocalStorage<RouteContext>();

const baseLoggerOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  redact: {
    paths: (process.env.LOG_REDACT_PATHS ?? '')
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean),
  },
  transport:
    process.env.NODE_ENV === 'production' || process.env.PINO_NO_PRETTY === 'true'
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: true,
          },
        },
};

const baseLogger = pino(baseLoggerOptions);
const drainLogger = baseLogger.child({ component: 'log-drain' });

const LOG_DRAIN_URL = process.env.LOG_DRAIN_URL;
const METRICS_DRAIN_URL = process.env.METRICS_DRAIN_URL;

async function postToDrain(url: string, payload: DrainPayload) {
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-observability-source': 'api',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    drainLogger.debug({ event: 'log_drain.failure', url, err: error instanceof Error ? error.message : String(error) });
  }
}

function emitToDrains(payload: DrainPayload) {
  if (LOG_DRAIN_URL) {
    void postToDrain(LOG_DRAIN_URL, payload);
  }
  if (METRICS_DRAIN_URL) {
    void postToDrain(METRICS_DRAIN_URL, payload);
  }
}

function resolveTraceId(request: Request): string {
  return (
    request.headers.get('x-trace-id') ??
    request.headers.get('x-request-id') ??
    request.headers.get('x-correlation-id') ??
    randomUUID()
  );
}

export function getLogger(bindings: Record<string, unknown> = {}) {
  const context = storage.getStore();
  if (!context) {
    return baseLogger.child(bindings);
  }
  return context.logger.child({ ...bindings, traceId: context.traceId, spanId: context.spanId });
}

export function getActiveTraceId(): string | undefined {
  return storage.getStore()?.traceId;
}

export async function withRouteInstrumentation(
  routeName: string,
  request: Request,
  handler: (context: RouteContext) => Promise<Response>,
  options: RouteInstrumentationOptions = {},
): Promise<Response> {
  const traceId = resolveTraceId(request);
  const spanId = randomUUID();
  const latencyTargetMs = options.latencyTargetMs ?? Number(process.env.API_LATENCY_SLO_MS ?? '500');
  const errorBudget = options.errorBudget ?? Number(process.env.API_ERROR_BUDGET ?? '0.01');
  const startedAt = Date.now();

  const logger = baseLogger.child({ traceId, spanId, route: routeName });
  const context: RouteContext = {
    traceId,
    spanId,
    logger,
    request,
    startedAt,
    slo: {
      latencyTargetMs,
      errorBudget,
    },
  };

  return storage.run(context, async () => {
    const url = new URL(request.url);
    logger.info({ event: 'request.start', method: request.method, path: url.pathname, slo: context.slo });

    try {
      const response = await handler(context);
      const duration = Date.now() - startedAt;
      const payload: DrainPayload = {
        traceId,
        spanId,
        route: routeName,
        method: request.method,
        status: response.status,
        duration_ms: duration,
        slo: context.slo,
        timestamp: new Date().toISOString(),
        kind: 'api_request',
        extras: options.drainPayloadExtras,
      };

      if (duration > latencyTargetMs) {
        logger.warn({
          event: 'slo.latency_violation',
          duration_ms: duration,
          target_ms: latencyTargetMs,
        });
      }

      if (response.status >= 500) {
        logger.error({
          event: 'slo.error_budget_alert',
          status: response.status,
          error_budget: errorBudget,
        });
        payload.error = `status_${response.status}`;
      }

      logger.info({
        event: 'request.complete',
        status: response.status,
        duration_ms: duration,
      });

      emitToDrains(payload);

      return response;
    } catch (error) {
      const duration = Date.now() - startedAt;
      const payload: DrainPayload = {
        traceId,
        spanId,
        route: routeName,
        method: request.method,
        duration_ms: duration,
        slo: context.slo,
        timestamp: new Date().toISOString(),
        kind: 'api_request',
        extras: options.drainPayloadExtras,
        error: error instanceof Error ? error.message : String(error),
      };

      logger.error({
        event: 'request.error',
        duration_ms: duration,
        err: error,
      });

      emitToDrains(payload);
      throw error;
    }
  });
}

export function createChildSpan(spanName: string, metadata: Record<string, unknown> = {}) {
  const context = storage.getStore();
  const spanId = randomUUID();
  const logger = context ? context.logger.child({ spanId, spanName }) : baseLogger.child({ spanId, spanName });
  const startedAt = Date.now();

  return {
    logger,
    spanId,
    end(successMetadata: Record<string, unknown> = {}) {
      const duration = Date.now() - startedAt;
      logger.info({ event: 'span.complete', duration_ms: duration, ...metadata, ...successMetadata });
    },
    fail(error: unknown, errorMetadata: Record<string, unknown> = {}) {
      const duration = Date.now() - startedAt;
      logger.error({ event: 'span.error', duration_ms: duration, err: error, ...metadata, ...errorMetadata });
    },
  };
}

export const sloCatalogue = {
  apiLatencyTargetMs: Number(process.env.API_LATENCY_SLO_MS ?? '500'),
  apiErrorBudget: Number(process.env.API_ERROR_BUDGET ?? '0.01'),
};
