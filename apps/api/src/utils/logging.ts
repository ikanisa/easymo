import { logger as sharedLogger, withTelemetryContext } from '@easymo/commons';

export interface LogContext {
  event: string;
  target?: string;
  actor?: string;
  entity?: string;
  status?: 'ok' | 'degraded' | 'error';
  message?: string;
  details?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  duration_ms?: number;
  [key: string]: unknown;
}

export interface StructuredLogger {
  debug(context: LogContext): void;
  info(context: LogContext): void;
  warn(context: LogContext): void;
  error(context: LogContext): void;
  logContext(context: LogContext): void;
}

const emit = (level: 'debug' | 'info' | 'warn' | 'error', context: LogContext) => {
  const { event, message, ...rest } = context;
  const payload = {
    event,
    message,
    ...rest,
  };

  switch (level) {
    case 'debug':
      sharedLogger.debug(payload);
      break;
    case 'info':
      sharedLogger.info(payload);
      break;
    case 'warn':
      sharedLogger.warn(payload);
      break;
    case 'error':
      sharedLogger.error(payload);
      break;
  }
};

export const structuredLogger: StructuredLogger = {
  debug: (context) => emit('debug', context),
  info: (context) => emit('info', context),
  warn: (context) => emit('warn', context),
  error: (context) => emit('error', context),
  logContext: (context) => emit('info', context),
};

export function createWorkflowLogger(workflow: string): StructuredLogger {
  return {
    debug: (ctx) => structuredLogger.debug({ ...ctx, target: workflow }),
    info: (ctx) => structuredLogger.info({ ...ctx, target: workflow }),
    warn: (ctx) => structuredLogger.warn({ ...ctx, target: workflow }),
    error: (ctx) => structuredLogger.error({ ...ctx, target: workflow }),
    logContext: (ctx) => structuredLogger.logContext({ ...ctx, target: workflow }),
  };
}

export async function withLogging<T>(
  event: string,
  operation: () => Promise<T>,
  context: Omit<LogContext, 'event' | 'duration_ms'> = {},
): Promise<T> {
  const start = Date.now();

  return await withTelemetryContext(async () => {
    try {
      const result = await operation();
      structuredLogger.info({
        event,
        status: 'ok',
        duration_ms: Date.now() - start,
        ...context,
      });
      return result;
    } catch (error) {
      structuredLogger.error({
        event,
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
        duration_ms: Date.now() - start,
        ...context,
      });
      throw error;
    }
  }, { metadata: context });
}
