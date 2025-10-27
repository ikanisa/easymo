/**
 * Structured logging utility for observability
 * 
 * Provides consistent structured logging across the application
 * with support for different log levels and contextual metadata.
 */

export interface LogContext {
  event: string;
  level?: 'debug' | 'info' | 'warn' | 'error';
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
  debug(context: Omit<LogContext, 'level'> & { event: string }): void;
  info(context: Omit<LogContext, 'level'> & { event: string }): void;
  warn(context: Omit<LogContext, 'level'> & { event: string }): void;
  error(context: Omit<LogContext, 'level'> & { event: string }): void;
  logContext(context: LogContext): void;
}

class Logger implements StructuredLogger {
  private drainUrl: string | null = null;
  private initialized = false;

  private ensureInitialized(): void {
    if (this.initialized) return;
    this.drainUrl = process.env.LOG_DRAIN_URL ?? null;
    this.initialized = true;
  }

  debug(context: Omit<LogContext, 'level'> & { event: string }): void {
    this.logContext({ ...context, level: 'debug' });
  }

  info(context: Omit<LogContext, 'level'> & { event: string }): void {
    this.logContext({ ...context, level: 'info' });
  }

  warn(context: Omit<LogContext, 'level'> & { event: string }): void {
    this.logContext({ ...context, level: 'warn' });
  }

  error(context: Omit<LogContext, 'level'> & { event: string }): void {
    this.logContext({ ...context, level: 'error' });
  }

  logContext(context: LogContext): void {
    this.ensureInitialized();

    const payload = {
      timestamp: new Date().toISOString(),
      level: context.level ?? 'info',
      ...context,
    };

    // Always log to stdout for container/kubernetes logging
    const logOutput = JSON.stringify(payload);
    
    if (context.level === 'error') {
      console.error(logOutput);
    } else {
      console.log(logOutput);
    }

    // Forward to external log drain if configured
    if (this.drainUrl) {
      this.forwardLog(payload);
    }
  }

  private forwardLog(payload: Record<string, unknown>): void {
    // Fire-and-forget to avoid blocking request lifecycle
    void fetch(this.drainUrl!, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch((err) => {
      // Log drain failures to stderr to avoid recursion
      console.error('log_drain_failed', err);
    });
  }
}

// Singleton instance
const logger = new Logger();

export const structuredLogger = logger;

/**
 * Creates a logger with a specific workflow context
 */
export function createWorkflowLogger(workflow: string): StructuredLogger {
  return {
    debug: (ctx) => logger.debug({ ...ctx, target: workflow }),
    info: (ctx) => logger.info({ ...ctx, target: workflow }),
    warn: (ctx) => logger.warn({ ...ctx, target: workflow }),
    error: (ctx) => logger.error({ ...ctx, target: workflow }),
    logContext: (ctx) => logger.logContext({ ...ctx, target: workflow }),
  };
}

/**
 * Measures duration of async operations
 */
export async function withLogging<T>(
  event: string,
  operation: () => Promise<T>,
  context: Omit<LogContext, 'event' | 'duration_ms'> = {},
): Promise<T> {
  const start = Date.now();
  
  try {
    const result = await operation();
    logger.info({
      event,
      status: 'ok',
      duration_ms: Date.now() - start,
      ...context,
    });
    return result;
  } catch (error) {
    logger.error({
      event,
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
      duration_ms: Date.now() - start,
      ...context,
    });
    throw error;
  }
}
