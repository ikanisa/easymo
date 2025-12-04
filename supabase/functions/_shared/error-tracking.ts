/**
 * Error Tracking Integration
 * Sentry SDK for Deno runtime
 */

// Note: For Deno, we use a lightweight error tracking approach
// Full Sentry SDK can be added via npm: package if needed

export interface ErrorContext {
  userId?: string;
  correlationId?: string;
  endpoint?: string;
  metadata?: Record<string, unknown>;
}

export interface ErrorTrackingConfig {
  dsn: string;
  environment: string;
  release?: string;
  sampleRate?: number;
}

/**
 * Initialize error tracking
 */
export function initErrorTracking(config: ErrorTrackingConfig): void {
  // Store config globally for use in error handlers
  (globalThis as any).__errorTrackingConfig = config;
  
  console.log(JSON.stringify({
    event: "ERROR_TRACKING_INITIALIZED",
    environment: config.environment,
    release: config.release,
  }));
}

/**
 * Capture exception with context
 */
export async function captureException(
  error: Error,
  context?: ErrorContext
): Promise<void> {
  const config = (globalThis as any).__errorTrackingConfig as ErrorTrackingConfig;
  
  if (!config?.dsn) {
    console.error("Error tracking not configured:", error);
    return;
  }

  // Sample errors based on sample rate
  if (config.sampleRate && Math.random() > config.sampleRate) {
    return;
  }

  try {
    const payload = {
      timestamp: new Date().toISOString(),
      level: "error",
      platform: "deno",
      server_name: Deno.env.get("HOSTNAME") || "supabase-function",
      environment: config.environment,
      release: config.release,
      exception: {
        type: error.name,
        value: error.message,
        stacktrace: error.stack,
      },
      user: context?.userId ? { id: context.userId } : undefined,
      tags: {
        endpoint: context?.endpoint,
        correlation_id: context?.correlationId,
      },
      extra: context?.metadata,
    };

    // Send to Sentry
    const response = await fetch(`${config.dsn}/api/envelope/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      console.error("Failed to send error to Sentry:", response.status);
    }
  } catch (sendError) {
    // Don't fail the application if error tracking fails
    console.error("Error tracking failed:", sendError);
  }
}

/**
 * Capture message (for warnings, info)
 */
export async function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
  context?: ErrorContext
): Promise<void> {
  const config = (globalThis as any).__errorTrackingConfig as ErrorTrackingConfig;
  
  if (!config?.dsn) {
    return;
  }

  try {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      platform: "deno",
      environment: config.environment,
      message: {
        formatted: message,
      },
      user: context?.userId ? { id: context.userId } : undefined,
      tags: {
        endpoint: context?.endpoint,
        correlation_id: context?.correlationId,
      },
      extra: context?.metadata,
    };

    await fetch(`${config.dsn}/api/envelope/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    console.error("Error tracking message failed:", error);
  }
}

/**
 * Add breadcrumb for debugging context
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>
): void {
  // Store breadcrumbs in global context for next error
  const breadcrumbs = (globalThis as any).__breadcrumbs || [];
  breadcrumbs.push({
    timestamp: Date.now(),
    category,
    message,
    data,
  });
  
  // Keep only last 20 breadcrumbs
  if (breadcrumbs.length > 20) {
    breadcrumbs.shift();
  }
  
  (globalThis as any).__breadcrumbs = breadcrumbs;
}

/**
 * Set user context for error tracking
 */
export function setUserContext(userId: string, metadata?: Record<string, unknown>): void {
  (globalThis as any).__userContext = {
    id: userId,
    ...metadata,
  };
}

/**
 * Wrap async function with error tracking
 */
export function withErrorTracking<T>(
  fn: () => Promise<T>,
  context?: ErrorContext
): Promise<T> {
  return fn().catch((error) => {
    captureException(error, context);
    throw error;
  });
}

/**
 * Performance monitoring
 */
export class PerformanceMonitor {
  private startTime: number;
  private operation: string;

  constructor(operation: string) {
    this.operation = operation;
    this.startTime = Date.now();
  }

  finish(metadata?: Record<string, unknown>): void {
    const duration = Date.now() - this.startTime;
    
    // Log slow operations (> 1s)
    if (duration > 1000) {
      console.warn(JSON.stringify({
        event: "SLOW_OPERATION",
        operation: this.operation,
        duration,
        ...metadata,
      }));
    }

    addBreadcrumb("performance", this.operation, {
      duration,
      ...metadata,
    });
  }
}
