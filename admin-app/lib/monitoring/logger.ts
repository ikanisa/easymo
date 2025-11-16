type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: Error;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private formatEntry(entry: LogEntry): string {
    const { level, message, timestamp, context, error } = entry;
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    const errorStr = error ? `\n${error.stack}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}${errorStr}`;
  }

  private createEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      error,
    };
  }

  debug(message: string, context?: Record<string, unknown>) {
    if (this.isDevelopment) {
      const entry = this.createEntry('debug', message, context);
      console.debug(this.formatEntry(entry));
    }
  }

  info(message: string, context?: Record<string, unknown>) {
    const entry = this.createEntry('info', message, context);
    console.info(this.formatEntry(entry));
  }

  warn(message: string, context?: Record<string, unknown>) {
    const entry = this.createEntry('warn', message, context);
    console.warn(this.formatEntry(entry));
  }

  error(message: string, error?: Error, context?: Record<string, unknown>) {
    const entry = this.createEntry('error', message, context, error);
    console.error(this.formatEntry(entry));
    
    // Send to error tracking service in production
    if (!this.isDevelopment && typeof window !== 'undefined') {
      // TODO: Send to Sentry, LogRocket, etc.
    }
  }
}

export const logger = new Logger();
