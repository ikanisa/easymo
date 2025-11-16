/**
 * Performance Monitoring Utilities
 * 
 * Utilities for monitoring application performance and health in production.
 */

// ============================================================================
// Performance Metrics
// ============================================================================

interface PerformanceMetric {
  name: string;
  value: number;
  unit: "ms" | "bytes" | "count";
  timestamp: string;
  tags?: Record<string, string>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly maxMetrics = 100;

  /**
   * Record a timing metric
   */
  recordTiming(name: string, durationMs: number, tags?: Record<string, string>) {
    this.addMetric({
      name,
      value: durationMs,
      unit: "ms",
      timestamp: new Date().toISOString(),
      tags,
    });
  }

  /**
   * Record a count metric
   */
  recordCount(name: string, count: number, tags?: Record<string, string>) {
    this.addMetric({
      name,
      value: count,
      unit: "count",
      timestamp: new Date().toISOString(),
      tags,
    });
  }

  /**
   * Record a size metric
   */
  recordSize(name: string, bytes: number, tags?: Record<string, string>) {
    this.addMetric({
      name,
      value: bytes,
      unit: "bytes",
      timestamp: new Date().toISOString(),
      tags,
    });
  }

  /**
   * Time a function execution
   */
  async time<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const duration = performance.now() - start;
      this.recordTiming(name, duration, tags);
    }
  }

  /**
   * Get all recorded metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics = [];
  }

  private addMetric(metric: PerformanceMetric) {
    this.metrics.push(metric);
    
    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Log in development
    if (process.env.NODE_ENV === "development") {
      console.log("[METRIC]", {
        name: metric.name,
        value: metric.value,
        unit: metric.unit,
        tags: metric.tags,
      });
    }
  }
}

export const performanceMonitor = new PerformanceMonitor();

// ============================================================================
// API Call Monitoring
// ============================================================================

interface ApiCallMetrics {
  endpoint: string;
  method: string;
  status: number;
  duration: number;
  timestamp: string;
  error?: string;
}

class ApiMonitor {
  private calls: ApiCallMetrics[] = [];
  private readonly maxCalls = 50;

  /**
   * Record an API call
   */
  recordCall(metrics: ApiCallMetrics) {
    this.calls.push(metrics);

    if (this.calls.length > this.maxCalls) {
      this.calls.shift();
    }

    // Log slow API calls
    if (metrics.duration > 1000) {
      console.warn("[SLOW_API]", {
        endpoint: metrics.endpoint,
        duration: `${metrics.duration}ms`,
        status: metrics.status,
      });
    }

    // Log failed API calls
    if (metrics.status >= 400) {
      console.error("[API_FAILURE]", {
        endpoint: metrics.endpoint,
        method: metrics.method,
        status: metrics.status,
        error: metrics.error,
      });
    }
  }

  /**
   * Get recent API calls
   */
  getRecentCalls(limit = 10): ApiCallMetrics[] {
    return this.calls.slice(-limit);
  }

  /**
   * Get failed API calls
   */
  getFailedCalls(): ApiCallMetrics[] {
    return this.calls.filter((call) => call.status >= 400);
  }

  /**
   * Get slow API calls (>1s)
   */
  getSlowCalls(): ApiCallMetrics[] {
    return this.calls.filter((call) => call.duration > 1000);
  }

  /**
   * Clear all recorded calls
   */
  clear() {
    this.calls = [];
  }
}

export const apiMonitor = new ApiMonitor();

// ============================================================================
// Error Tracking
// ============================================================================

interface ErrorEvent {
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  timestamp: string;
  url?: string;
  userAgent?: string;
}

class ErrorTracker {
  private errors: ErrorEvent[] = [];
  private readonly maxErrors = 50;

  /**
   * Track an error
   */
  trackError(error: unknown, context?: Record<string, unknown>) {
    const errorEvent: ErrorEvent = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context,
      timestamp: new Date().toISOString(),
      url: typeof window !== "undefined" ? window.location.href : undefined,
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    };

    this.errors.push(errorEvent);

    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // Always log errors
    console.error("[ERROR_TRACKED]", {
      message: errorEvent.message,
      context: errorEvent.context,
      timestamp: errorEvent.timestamp,
    });
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit = 10): ErrorEvent[] {
    return this.errors.slice(-limit);
  }

  /**
   * Clear all tracked errors
   */
  clear() {
    this.errors = [];
  }
}

export const errorTracker = new ErrorTracker();

// ============================================================================
// Health Check
// ============================================================================

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  checks: {
    name: string;
    status: "pass" | "fail";
    message?: string;
    duration?: number;
  }[];
  timestamp: string;
}

export async function checkHealth(): Promise<HealthStatus> {
  const checks: HealthStatus["checks"] = [];
  const start = Date.now();

  // Check API availability
  try {
    const apiStart = performance.now();
    const response = await fetch("/api/health", {
      method: "GET",
      cache: "no-store",
    });
    const duration = performance.now() - apiStart;

    checks.push({
      name: "api",
      status: response.ok ? "pass" : "fail",
      message: response.ok ? undefined : `Status: ${response.status}`,
      duration,
    });
  } catch (error) {
    checks.push({
      name: "api",
      status: "fail",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  // Check performance metrics
  const recentErrors = errorTracker.getRecentErrors(5);
  checks.push({
    name: "error_rate",
    status: recentErrors.length < 3 ? "pass" : "fail",
    message:
      recentErrors.length >= 3
        ? `${recentErrors.length} errors in last 5 events`
        : undefined,
  });

  // Check slow API calls
  const slowCalls = apiMonitor.getSlowCalls();
  checks.push({
    name: "api_performance",
    status: slowCalls.length < 3 ? "pass" : "fail",
    message:
      slowCalls.length >= 3 ? `${slowCalls.length} slow API calls` : undefined,
  });

  // Determine overall status
  const failedChecks = checks.filter((c) => c.status === "fail");
  const status =
    failedChecks.length === 0
      ? "healthy"
      : failedChecks.length <= 1
        ? "degraded"
        : "unhealthy";

  return {
    status,
    checks,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// Export all monitoring utilities
// ============================================================================

export const monitoring = {
  performance: performanceMonitor,
  api: apiMonitor,
  errors: errorTracker,
  checkHealth,
};
