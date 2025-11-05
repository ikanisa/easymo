export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogMetadata = {
  requestId?: string;
  error?: unknown;
} & Record<string, unknown>;

export type LogRecord = {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  requestId?: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
};

export type LoggerContext = {
  requestId?: string;
} & Record<string, unknown>;

export type LogEmitter = (record: LogRecord) => void;
export type ErrorTracker = (error: unknown, record: LogRecord) => void;

export type LoggerOptions = {
  service: string;
  requestId?: string;
  defaultContext?: Record<string, unknown>;
  onLog?: LogEmitter;
  trackError?: ErrorTracker;
};

export type Logger = {
  child: (context: LoggerContext) => Logger;
  withRequest: (requestId: string) => Logger;
  debug: (message: string, metadata?: LogMetadata) => void;
  info: (message: string, metadata?: LogMetadata) => void;
  warn: (message: string, metadata?: LogMetadata) => void;
  error: (message: string, metadata?: LogMetadata) => void;
};

const LEVEL_WRITERS: Record<LogLevel, (payload: string) => void> = {
  debug: (payload: string) => console.debug(payload),
  info: (payload: string) => console.log(payload),
  warn: (payload: string) => console.warn(payload),
  error: (payload: string) => console.error(payload),
};

const defaultEmitter: LogEmitter = (record) => {
  const payload = JSON.stringify(record);
  LEVEL_WRITERS[record.level](payload);
};

const serializeError = (error: unknown): LogRecord["error"] | undefined => {
  if (!error) {
    return undefined;
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === "object") {
    const nonNullError = error as Record<string, unknown> | null;
    if (!nonNullError) {
      return undefined;
    }

    const name = (nonNullError as { name?: string }).name ?? "Error";
    const message = "message" in nonNullError
      ? String((nonNullError as { message?: unknown }).message)
      : JSON.stringify(nonNullError);

    return {
      name,
      message,
    };
  }

  if (typeof error === "symbol" || typeof error === "function") {
    return {
      name: "Error",
      message: error.toString(),
    };
  }

  return {
    name: "Error",
    message: String(error as string | number | boolean | bigint),
  };
};

type InternalLoggerState = {
  service: string;
  requestId?: string;
  defaultContext: Record<string, unknown>;
  emit: LogEmitter;
  trackError?: ErrorTracker;
};

const buildContext = (
  baseContext: Record<string, unknown>,
  metadata?: LogMetadata,
): { context?: Record<string, unknown>; requestId?: string; error?: unknown } => {
  if (!metadata) {
    return { context: Object.keys(baseContext).length > 0 ? { ...baseContext } : undefined };
  }

  const { requestId, error, ...rest } = metadata;
  const mergedContext = { ...baseContext, ...rest };
  const hasContext = Object.keys(mergedContext).length > 0;

  return {
    requestId,
    error,
    context: hasContext ? mergedContext : undefined,
  };
};

const createLogRecord = (
  state: InternalLoggerState,
  level: LogLevel,
  message: string,
  metadata?: LogMetadata,
): LogRecord => {
  const { context, requestId, error } = buildContext(state.defaultContext, metadata);
  const resolvedRequestId = requestId ?? state.requestId;
  const record: LogRecord = {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: state.service,
  };

  if (resolvedRequestId) {
    record.requestId = resolvedRequestId;
  }

  if (context) {
    record.context = context;
  }

  const serializedError = serializeError(error);
  if (serializedError) {
    record.error = serializedError;
  }

  return record;
};

const dispatchRecord = (
  state: InternalLoggerState,
  level: LogLevel,
  message: string,
  metadata?: LogMetadata,
): void => {
  const record = createLogRecord(state, level, message, metadata);
  state.emit(record);

  if (level === "error" && state.trackError) {
    const explicitError = metadata?.error;
    const structured = record.error
      ? Object.assign(new Error(record.error.message), {
          name: record.error.name,
          stack: record.error.stack,
        })
      : undefined;
    const errorForTracking = explicitError ?? structured ?? new Error(message);
    state.trackError(errorForTracking, record);
  }
};

export const createLogger = ({
  service,
  requestId,
  defaultContext = {},
  onLog = defaultEmitter,
  trackError,
}: LoggerOptions): Logger => {
  const state: InternalLoggerState = {
    service,
    requestId,
    defaultContext,
    emit: onLog,
    trackError,
  };

  const child = (context: LoggerContext): Logger => {
    const nextContext: Record<string, unknown> = { ...state.defaultContext };
    const { requestId: childRequestId, ...rest } = context;

    for (const [key, value] of Object.entries(rest)) {
      nextContext[key] = value;
    }

    return createLogger({
      service: state.service,
      requestId: childRequestId ?? state.requestId,
      defaultContext: nextContext,
      onLog: state.emit,
      trackError: state.trackError,
    });
  };

  return {
    child,
    withRequest(nextRequestId: string) {
      return child({ requestId: nextRequestId });
    },
    debug(message: string, metadata?: LogMetadata) {
      dispatchRecord(state, "debug", message, metadata);
    },
    info(message: string, metadata?: LogMetadata) {
      dispatchRecord(state, "info", message, metadata);
    },
    warn(message: string, metadata?: LogMetadata) {
      dispatchRecord(state, "warn", message, metadata);
    },
    error(message: string, metadata?: LogMetadata) {
      dispatchRecord(state, "error", message, metadata);
    },
  };
};
