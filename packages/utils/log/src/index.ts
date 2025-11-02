export type LogLevel = "debug" | "info" | "warn" | "error";

export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  cause?: unknown;
  details?: Record<string, unknown>;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  error?: SerializedError;
}

export type LogEmitter = (entry: LogEntry) => void;
export type ErrorTrackingHook = (error: SerializedError, entry: LogEntry) => void;

export interface LoggerOptions {
  requestId?: string;
  defaultMetadata?: Record<string, unknown>;
  emitter?: LogEmitter;
  errorTrackingHook?: ErrorTrackingHook;
}

export type LoggerChildOptions = LoggerOptions;

export type LogMetadata = Record<string, unknown> & {
  error?: unknown;
  requestId?: string;
};

export interface Logger {
  readonly requestId?: string;
  child(options?: LoggerChildOptions): Logger;
  log(level: LogLevel, message: string, metadata?: LogMetadata): void;
  debug(message: string, metadata?: LogMetadata): void;
  info(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  error(message: string, metadata?: LogMetadata): void;
  error(message: string, error: unknown, metadata?: LogMetadata): void;
}

interface LoggerContext {
  requestId?: string;
  defaultMetadata: Record<string, unknown>;
  emitter: LogEmitter;
  errorTrackingHook?: ErrorTrackingHook;
}

/* eslint-disable no-console */
const defaultEmitter: LogEmitter = (entry) => {
  const payload = JSON.stringify(entry);

  switch (entry.level) {
    case "error":
      console.error(payload);
      break;
    case "warn":
      console.warn(payload);
      break;
    case "debug":
      console.debug(payload);
      break;
    default:
      console.info(payload);
      break;
  }
};
/* eslint-enable no-console */

function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    const base: SerializedError = {
      name: error.name,
      message: error.message,
      stack: error.stack ?? undefined,
    };

    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause !== undefined) {
      base.cause = cause;
    }

    const enumerable = Object.fromEntries(
      Object.entries(error).filter(([key]) => !["name", "message", "stack", "cause"].includes(key)),
    );

    if (Object.keys(enumerable).length > 0) {
      base.details = enumerable;
    }

    return base;
  }

  if (typeof error === "object" && error !== null) {
    return {
      name: "UnknownError",
      message: "Non-Error object thrown",
      details: error as Record<string, unknown>,
    };
  }

  return {
    name: "UnknownError",
    message: String(error),
  };
}

function isLogMetadata(value: unknown): value is LogMetadata {
  return typeof value === "object" && value !== null;
}

function createLoggerInstance(context: LoggerContext): Logger {
  const write = (
    level: LogLevel,
    message: string,
    metadata?: LogMetadata,
    explicitError?: unknown,
  ): void => {
    const timestamp = new Date().toISOString();
    const combinedMetadata: LogMetadata = {
      ...context.defaultMetadata,
      ...(metadata ?? {}),
    };

    const { error, requestId, ...rest } = combinedMetadata;
    const entry: LogEntry = {
      level,
      message,
      timestamp,
      requestId: typeof requestId === "string" ? requestId : context.requestId,
      metadata: Object.keys(rest).length > 0 ? rest : undefined,
    };

    const normalizedError = explicitError ?? error;
    if (normalizedError !== undefined) {
      entry.error = serializeError(normalizedError);
    }

    context.emitter(entry);

    if (entry.error && context.errorTrackingHook) {
      context.errorTrackingHook(entry.error, entry);
    }
  };

  const logger: Logger = {
    get requestId() {
      return context.requestId;
    },
    child(options?: LoggerChildOptions): Logger {
      const nextContext: LoggerContext = {
        requestId: options?.requestId ?? context.requestId,
        defaultMetadata: {
          ...context.defaultMetadata,
          ...(options?.defaultMetadata ?? {}),
        },
        emitter: options?.emitter ?? context.emitter,
        errorTrackingHook: options?.errorTrackingHook ?? context.errorTrackingHook,
      };

      return createLoggerInstance(nextContext);
    },
    log(level, message, metadata) {
      write(level, message, metadata);
    },
    debug(message, metadata) {
      write("debug", message, metadata);
    },
    info(message, metadata) {
      write("info", message, metadata);
    },
    warn(message, metadata) {
      write("warn", message, metadata);
    },
    error(message: string, arg2?: unknown, arg3?: LogMetadata) {
      if (isLogMetadata(arg2) && arg3 === undefined) {
        write("error", message, arg2);
        return;
      }

      if (isLogMetadata(arg3)) {
        write("error", message, arg3, arg2);
        return;
      }

      write("error", message, undefined, arg2);
    },
  };

  return logger;
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const context: LoggerContext = {
    requestId: options.requestId,
    defaultMetadata: options.defaultMetadata ? { ...options.defaultMetadata } : {},
    emitter: options.emitter ?? defaultEmitter,
    errorTrackingHook: options.errorTrackingHook,
  };

  return createLoggerInstance(context);
}
