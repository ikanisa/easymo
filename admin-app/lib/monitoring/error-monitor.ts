// Error tracking and monitoring

export interface ErrorEvent {
  timestamp: string;
  errorType: string;
  message: string;
  stack?: string;
  endpoint?: string;
  userId?: string;
  provider?: string;
  metadata?: Record<string, any>;
}

class ErrorMonitor {
  private errors: ErrorEvent[] = [];
  private maxErrors = 1000;

  log(error: Error | ErrorEvent, context?: Record<string, any>) {
    const errorEvent: ErrorEvent =
      error instanceof Error
        ? {
            timestamp: new Date().toISOString(),
            errorType: error.name,
            message: error.message,
            stack: error.stack,
            ...context,
          }
        : error;

    this.errors.push(errorEvent);

    // Keep only recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // Log to console
    console.error("[ERROR]", {
      type: errorEvent.errorType,
      message: errorEvent.message,
      endpoint: errorEvent.endpoint,
      provider: errorEvent.provider,
    });
  }

  getErrors(limit: number = 100): ErrorEvent[] {
    return this.errors.slice(-limit);
  }

  getErrorStats(): {
    total: number;
    byType: Record<string, number>;
    byEndpoint: Record<string, number>;
    byProvider: Record<string, number>;
  } {
    const stats = {
      total: this.errors.length,
      byType: {} as Record<string, number>,
      byEndpoint: {} as Record<string, number>,
      byProvider: {} as Record<string, number>,
    };

    this.errors.forEach((err) => {
      stats.byType[err.errorType] = (stats.byType[err.errorType] || 0) + 1;
      if (err.endpoint) {
        stats.byEndpoint[err.endpoint] = (stats.byEndpoint[err.endpoint] || 0) + 1;
      }
      if (err.provider) {
        stats.byProvider[err.provider] = (stats.byProvider[err.provider] || 0) + 1;
      }
    });

    return stats;
  }

  clear() {
    this.errors = [];
  }
}

export const errorMonitor = new ErrorMonitor();

// Wrapper for async operations with error tracking
export async function withErrorTracking<T>(
  fn: () => Promise<T>,
  context: { endpoint: string; userId?: string; provider?: string }
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    errorMonitor.log(error as Error, context);
    throw error;
  }
}
