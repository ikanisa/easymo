/**
 * Simple console logger for admin app
 * Replaces Pino to avoid worker thread issues in Next.js
 */

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogContext {
  [key: string]: unknown;
}

class SimpleLogger {
  private level: LogLevel;
  private service: string;

  constructor(service: string = 'admin-app', level: LogLevel = 'info') {
    this.service = service;
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
    const currentLevelIndex = levels.indexOf(this.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(level: LogLevel, context: LogContext, message?: string): string {
    const timestamp = new Date().toISOString();
    const logEntry: Record<string, unknown> = {
      timestamp,
      level: level.toUpperCase(),
      service: this.service,
      ...context,
    };

    if (typeof message === 'string' && message.length > 0) {
      logEntry.message = message;
    }

    return JSON.stringify(logEntry);
  }

  private log(level: LogLevel, context: LogContext | string, message?: string) {
    if (!this.shouldLog(level)) return;

    let ctx: LogContext;
    let msg: string | undefined;

    if (typeof context === 'string') {
      msg = context;
      ctx = {};
    } else {
      ctx = context;
      msg = message;
    }

    const formatted = this.formatMessage(level, ctx, msg);

    switch (level) {
      case 'fatal':
      case 'error':
        console.error(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'trace':
      case 'debug':
        console.debug(formatted);
        break;
      default:
        console.log(formatted);
    }
  }

  trace(context: LogContext | string, message?: string) {
    this.log('trace', context, message);
  }

  debug(context: LogContext | string, message?: string) {
    this.log('debug', context, message);
  }

  info(context: LogContext | string, message?: string) {
    this.log('info', context, message);
  }

  warn(context: LogContext | string, message?: string) {
    this.log('warn', context, message);
  }

  error(context: LogContext | string, message?: string) {
    this.log('error', context, message);
  }

  fatal(context: LogContext | string, message?: string) {
    this.log('fatal', context, message);
  }

  child(bindings: LogContext): SimpleLogger {
    const childLogger = new SimpleLogger(this.service, this.level);
    // Store bindings to be included in all logs
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (level: LogLevel, context: LogContext | string, message?: string) => {
      if (typeof context === 'string') {
        originalLog(level, { ...bindings }, context);
      } else {
        originalLog(level, { ...bindings, ...context }, message);
      }
    };
    return childLogger;
  }
}

// Create singleton instance
const logLevel = (process.env.LOG_LEVEL ?? 'info') as LogLevel;
const serviceName = process.env.SERVICE_NAME ?? 'admin-app';

export const logger = new SimpleLogger(serviceName, logLevel);
export const childLogger = (bindings: LogContext) => logger.child(bindings);
