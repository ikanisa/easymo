import * as Sentry from "npm:@sentry/deno@8.37.1";
import type { Event, EventHint } from "npm:@sentry/types@8.37.1";

const EMAIL_REGEX = /([A-Z0-9._%+-]{2})[A-Z0-9._%+-]*(@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
const PHONE_REGEX = /(\+?\d{2})\d{3,8}(\d{2})/g;
const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;
const LONG_NUMBER_REGEX = /(\d{2})\d{4,}(\d{2})/g;

const mask = (value: string, matcher: RegExp, replacer: (match: RegExpExecArray) => string) =>
  value.replace(matcher, (...args) => replacer(args as unknown as RegExpExecArray));

const scrubString = (value: string): string => {
  let result = value;
  result = mask(result, EMAIL_REGEX, (match) => `${match[1]}…${match[2]}`);
  result = mask(result, PHONE_REGEX, (match) => `${match[1]}••••${match[2]}`);
  result = mask(result, UUID_REGEX, () => "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx");
  result = mask(result, LONG_NUMBER_REGEX, (match) => `${match[1]}••••${match[2]}`);
  return result;
};

const scrubPII = <T>(value: T): T => {
  if (typeof value === "string") {
    return scrubString(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => scrubPII(entry)) as T;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrubString(value.message),
      stack: value.stack,
    } as T;
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value) as T;
  }

  if (typeof value === "symbol") {
    return value.toString() as T;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).reduce<
      Record<string, unknown>
    >((accumulator, [key, entry]) => {
      accumulator[key] = scrubPII(entry);
      return accumulator;
    }, {});
    return entries as T;
  }

  return value;
};

const normalizeError = (error: unknown) => {
  if (error instanceof Error) {
    return scrubPII({
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    });
  }

  if (typeof error === "string") {
    return { message: scrubString(error) };
  }

  return { message: "Unknown error", detail: scrubPII(error) };
};

const parseSampleRate = (raw: string | undefined, fallback: number): number => {
  if (!raw) return fallback;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, parsed));
};

const environment =
  Deno.env.get("APP_ENV") ?? Deno.env.get("DENO_ENV") ?? Deno.env.get("NODE_ENV") ?? "development";
const release = Deno.env.get("SENTRY_RELEASE") ?? Deno.env.get("GIT_COMMIT_SHA") ?? undefined;
const sentryDsn = Deno.env.get("SENTRY_DSN_SUPABASE") ?? Deno.env.get("SENTRY_DSN") ?? "";

const tracesSampleRate = parseSampleRate(
  Deno.env.get("SENTRY_TRACES_SAMPLE_RATE"),
  environment === "production" ? 0.2 : 1
);

const profilesSampleRate = parseSampleRate(
  Deno.env.get("SENTRY_PROFILES_SAMPLE_RATE"),
  environment === "production" ? 0.1 : 1
);

const scrubEvent = (event: Event, _hint?: EventHint) => scrubPII(event) as Event;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment,
    release,
    tracesSampleRate,
    profilesSampleRate,
    beforeSend: scrubEvent,
  });
}

const posthogApiKey = Deno.env.get("POSTHOG_API_KEY");
const posthogHost = Deno.env.get("POSTHOG_HOST") ?? "https://app.posthog.com";

const nativeConsole = console;

const capturePosthog = async (
  service: string,
  requestId: string,
  event: string,
  properties?: Record<string, unknown>
) => {
  if (!posthogApiKey) {
    return;
  }

  try {
    await fetch(`${posthogHost}/capture/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: posthogApiKey,
        event,
        distinct_id: requestId,
        properties: {
          service,
          environment,
          ...scrubPII(properties ?? {}),
        },
      }),
    });
  } catch (error) {
    nativeConsole.warn(
      JSON.stringify({
        level: "warn",
        event: "posthog.capture_failed",
        error: normalizeError(error),
        timestamp: new Date().toISOString(),
      })
    );
  }
};

export interface StructuredLogger {
  info(event: string, payload?: Record<string, unknown>): void;
  warn(event: string, payload?: Record<string, unknown>): void;
  error(event: string, payload?: Record<string, unknown>): void;
}

const writeLog = (
  level: "info" | "warn" | "error",
  service: string,
  requestId: string,
  payload: Record<string, unknown>
) => {
  const entry = {
    level,
    service,
    requestId,
    environment,
    timestamp: new Date().toISOString(),
    ...payload,
  } as const;

  const serialized = JSON.stringify(scrubPII(entry));

  switch (level) {
    case "error":
      nativeConsole.error(serialized);
      break;
    case "warn":
      nativeConsole.warn(serialized);
      break;
    default:
      nativeConsole.log(serialized);
  }
};

const createLogger = (service: string, requestId: string): StructuredLogger => ({
  info(event, payload) {
    writeLog("info", service, requestId, { event, payload: scrubPII(payload ?? {}) });
  },
  warn(event, payload) {
    writeLog("warn", service, requestId, { event, payload: scrubPII(payload ?? {}) });
  },
  error(event, payload) {
    writeLog("error", service, requestId, { event, payload: scrubPII(payload ?? {}) });
  },
});

const flushTelemetry = async () => {
  if (!sentryDsn) {
    return;
  }
  await Sentry.flush(2000);
};

const captureException = (
  service: string,
  requestId: string,
  error: unknown,
  extras?: Record<string, unknown>
) => {
  if (!sentryDsn) {
    return;
  }

  Sentry.withScope((scope) => {
    scope.setTag("service", service);
    scope.setTag("request_id", requestId);
    scope.setContext("details", scrubPII(extras ?? {}));
    Sentry.captureException(error);
  });
};

const captureMessage = (
  service: string,
  requestId: string,
  message: string,
  extras?: Record<string, unknown>
) => {
  if (!sentryDsn) {
    return;
  }

  Sentry.withScope((scope) => {
    scope.setTag("service", service);
    scope.setTag("request_id", requestId);
    scope.setContext("details", scrubPII(extras ?? {}));
    Sentry.captureMessage(message);
  });
};

export interface ObservabilityContext {
  readonly requestId: string;
  readonly logger: StructuredLogger;
  captureException(error: unknown, extras?: Record<string, unknown>): void;
  captureMessage(message: string, extras?: Record<string, unknown>): void;
  track(event: string, properties?: Record<string, unknown>): Promise<void>;
}

type EdgeHandler = (
  request: Request,
  context: ObservabilityContext,
  info: Deno.ServeHandlerInfo
) => Response | Promise<Response>;

export const serveWithObservability = (service: string, handler: EdgeHandler) => {
  return Deno.serve(async (request, info) => {
    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
    const logger = createLogger(service, requestId);
    const startedAt = Date.now();
    const posthogTasks: Array<Promise<void>> = [];
    const originalConsole = console;
    const proxyConsole = Object.assign(Object.create(originalConsole), {
      log: (...args: unknown[]) => logger.info("console.log", { arguments: scrubPII(args) }),
      info: (...args: unknown[]) => logger.info("console.info", { arguments: scrubPII(args) }),
      warn: (...args: unknown[]) => logger.warn("console.warn", { arguments: scrubPII(args) }),
      error: (...args: unknown[]) => logger.error("console.error", { arguments: scrubPII(args) }),
      table: (data: unknown, properties?: string[] | undefined) =>
        logger.info("console.table", {
          data: scrubPII(data),
          properties: scrubPII(properties ?? null),
        }),
    }) as Console;

    (globalThis as { console: Console }).console = proxyConsole;

    const context: ObservabilityContext = {
      requestId,
      logger,
      captureException(error, extras) {
        captureException(service, requestId, error, extras);
      },
      captureMessage(message, extras) {
        captureMessage(service, requestId, message, extras);
      },
      async track(event, properties) {
        const task = capturePosthog(service, requestId, event, properties);
        posthogTasks.push(task);
        await task;
      },
    };

    logger.info("edge.request.start", {
      method: request.method,
      url: new URL(request.url).pathname,
      region: info?.region ?? null,
    });

    try {
      const response = await handler(request, context, info);

      logger.info("edge.request.complete", {
        status: response.status,
        durationMs: Date.now() - startedAt,
      });

      await Promise.all(posthogTasks);
      await flushTelemetry();
      (globalThis as { console: Console }).console = originalConsole;
      return response;
    } catch (error) {
      logger.error("edge.request.error", { error: normalizeError(error) });
      captureException(service, requestId, error, {
        method: request.method,
        url: request.url,
      });
      await Promise.all(posthogTasks);
      await flushTelemetry();
      (globalThis as { console: Console }).console = originalConsole;
      return new Response(JSON.stringify({ error: "internal_error" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
  });
};

export const createJsonErrorResponse = (message: string, status = 400) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });

export { scrubPII, normalizeError };
