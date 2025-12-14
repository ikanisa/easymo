/**
 * Performance Timing Utility (Phase 3)
 * Tracks operation duration and success/failure metrics
 */

import { logStructuredEvent } from "./observability/index.ts";

export interface TimingResult<T> {
  result: T;
  durationMs: number;
}

/**
 * Wrap async operation with timing
 */
export async function withTiming<T>(
  operation: string,
  fn: () => Promise<T>,
  context: Record<string, unknown> = {}
): Promise<TimingResult<T>> {
  const start = performance.now();
  
  try {
    const result = await fn();
    const durationMs = performance.now() - start;
    
    logStructuredEvent(`${operation}_COMPLETED`, {
      durationMs,
      success: true,
      ...context,
    }, "info");
    
    return { result, durationMs };
  } catch (error) {
    const durationMs = performance.now() - start;
    
    logStructuredEvent(`${operation}_FAILED`, {
      durationMs,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      ...context,
    }, "error");
    
    throw error;
  }
}

/**
 * Track operation metrics (for Prometheus/PostHog integration)
 */
export async function recordMetric(
  metric: string,
  value: number,
  tags: Record<string, string> = {}
): Promise<void> {
  // Log as structured event for now
  // Can be enhanced to push to PostHog/Prometheus later
  logStructuredEvent("METRIC_RECORDED", {
    metric,
    value,
    tags,
    timestamp: Date.now(),
  }, "info");
}

/**
 * Log slow operations
 */
export async function withSlowOpWarning<T>(
  operation: string,
  fn: () => Promise<T>,
  thresholdMs: number = 1000,
  context: Record<string, unknown> = {}
): Promise<T> {
  const { result, durationMs } = await withTiming(operation, fn, context);
  
  if (durationMs > thresholdMs) {
    logStructuredEvent("SLOW_OPERATION", {
      operation,
      durationMs,
      thresholdMs,
      ...context,
    }, "warn");
  }
  
  return result;
}
