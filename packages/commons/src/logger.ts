import { randomUUID } from "crypto";
import pino, { type LogFn,type LoggerOptions, stdTimeFunctions } from "pino";

import {
  getRequestContext,
  getRequestId,
  getSpanId,
  getTraceId,
  setRequestId,
  setSpanId,
  setTraceId,
  withRequestContext,
} from "./request-context";

const level = process.env.LOG_LEVEL ?? "info";
const serviceName = process.env.SERVICE_NAME ?? process.env.APP_NAME ?? "easymo";
const logDrainUrl = process.env.LOG_DRAIN_URL;

const levelMap: Record<number, string> = {
  10: "trace",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "fatal",
};

const buildPayload = (args: Parameters<LogFn>, level: number) => {
  const context = getRequestContext();
  const payload: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level: levelMap[level] ?? level,
    service: serviceName,
  };

  if (context) {
    payload.trace_id = context.traceId;
    payload.span_id = context.spanId;
    payload.request_id = context.requestId;
    if (context.userId) payload.user_id = context.userId;
    if (context.sessionId) payload.session_id = context.sessionId;
    if (context.metadata) Object.assign(payload, context.metadata);
  } else {
    const traceId = getTraceId();
    if (traceId) payload.trace_id = traceId;
    const spanId = getSpanId();
    if (spanId) payload.span_id = spanId;
    const requestId = getRequestId();
    if (requestId) payload.request_id = requestId;
  }

  if (args.length > 0) {
    const [first, ...rest] = args;
    if (typeof first === "object" && first !== null) {
      Object.assign(payload, first as Record<string, unknown>);
      if (rest.length > 0 && typeof rest[0] === "string") {
        payload.message = rest[0];
      }
      if (rest.length > 1) {
        payload.args = rest.slice(1);
      }
    } else {
      payload.message = typeof first === "string" ? first : String(first);
      if (rest.length > 0) {
        payload.args = rest;
      }
    }
  }

  return payload;
};

const forwardToDrain = async (payload: Record<string, unknown>) => {
  if (!logDrainUrl) return;
  try {
    await fetch(logDrainUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`log_drain_failed ${message}\n`);
  }
};

const options: LoggerOptions = {
  level,
  base: { service: serviceName },
  timestamp: stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label.toUpperCase() }),
  },
  mixin: () => {
    const context = getRequestContext();
    if (!context) {
      const traceId = getTraceId();
      return traceId ? { trace_id: traceId } : {};
    }
    const mixin: Record<string, unknown> = {
      trace_id: context.traceId,
      span_id: context.spanId,
      request_id: context.requestId,
    };
    if (context.userId) mixin.user_id = context.userId;
    if (context.sessionId) mixin.session_id = context.sessionId;
    if (context.metadata) Object.assign(mixin, context.metadata);
    return mixin;
  },
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
          },
        },
};

if (logDrainUrl) {
  options.hooks = {
    logMethod(args, method, levelValue) {
      const payload = buildPayload(args, levelValue);
      queueMicrotask(() => {
        void forwardToDrain(payload);
      });
      method.apply(this, args);
    },
  };
}

export const logger = pino(options);

export const childLogger = (bindings: Record<string, unknown>) => logger.child(bindings);

export const withTelemetryContext = async <T>(
  fn: () => Promise<T> | T,
  seed?: {
    requestId?: string;
    traceId?: string;
    spanId?: string;
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<T> => {
  return await withRequestContext(async () => await fn(), {
    requestId: seed?.requestId ?? getRequestId() ?? randomUUID(),
    traceId: seed?.traceId ?? seed?.requestId ?? getTraceId() ?? randomUUID(),
    spanId: seed?.spanId ?? randomUUID(),
    userId: seed?.userId,
    sessionId: seed?.sessionId,
    metadata: seed?.metadata,
  });
};

export const attachTraceToLogger = (traceId: string) => setTraceId(traceId);
export const attachRequestToLogger = (requestId: string) => setRequestId(requestId);
export const attachSpanToLogger = (spanId: string) => setSpanId(spanId);
