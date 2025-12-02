/**
 * Metrics Collector
 * Performance metrics collection and reporting
 */

import { logStructuredEvent } from "./logger.ts";

// ============================================================================
// TYPES
// ============================================================================

export type MetricType = "counter" | "gauge" | "histogram" | "timer";

export type Metric = {
  name: string;
  type: MetricType;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
};

// ============================================================================
// METRICS STORAGE
// ============================================================================

const counters = new Map<string, number>();
const gauges = new Map<string, number>();
const histograms = new Map<string, number[]>();

// ============================================================================
// COUNTER METRICS
// ============================================================================

export function incrementCounter(name: string, labels: Record<string, string> = {}, value: number = 1): void {
  const key = buildKey(name, labels);
  const current = counters.get(key) || 0;
  counters.set(key, current + value);
}

export function getCounter(name: string, labels: Record<string, string> = {}): number {
  const key = buildKey(name, labels);
  return counters.get(key) || 0;
}

// ============================================================================
// GAUGE METRICS
// ============================================================================

export function setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
  const key = buildKey(name, labels);
  gauges.set(key, value);
}

export function getGauge(name: string, labels: Record<string, string> = {}): number {
  const key = buildKey(name, labels);
  return gauges.get(key) || 0;
}

export function incrementGauge(name: string, labels: Record<string, string> = {}, value: number = 1): void {
  const key = buildKey(name, labels);
  const current = gauges.get(key) || 0;
  gauges.set(key, current + value);
}

export function decrementGauge(name: string, labels: Record<string, string> = {}, value: number = 1): void {
  const key = buildKey(name, labels);
  const current = gauges.get(key) || 0;
  gauges.set(key, current - value);
}

// ============================================================================
// HISTOGRAM METRICS
// ============================================================================

export function recordHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
  const key = buildKey(name, labels);
  const values = histograms.get(key) || [];
  values.push(value);
  
  if (values.length > 1000) {
    values.shift();
  }
  
  histograms.set(key, values);
}

export function getHistogramStats(name: string, labels: Record<string, string> = {}): {
  count: number; sum: number; avg: number; min: number; max: number; p50: number; p90: number; p99: number;
} {
  const key = buildKey(name, labels);
  const values = histograms.get(key) || [];
  
  if (values.length === 0) {
    return { count: 0, sum: 0, avg: 0, min: 0, max: 0, p50: 0, p90: 0, p99: 0 };
  }
  
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  
  return {
    count: sorted.length,
    sum,
    avg: sum / sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    p99: percentile(sorted, 99),
  };
}

// ============================================================================
// TIMER METRICS
// ============================================================================

export function startTimer(): () => number {
  const start = performance.now();
  return () => performance.now() - start;
}

export async function timeAsync<T>(
  name: string,
  operation: () => Promise<T>,
  labels: Record<string, string> = {}
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  let success = true;
  
  try {
    const result = await operation();
    return { result, durationMs: performance.now() - start };
  } catch (error) {
    success = false;
    throw error;
  } finally {
    const durationMs = performance.now() - start;
    recordHistogram(`${name}_duration_ms`, durationMs, { ...labels, success: String(success) });
    incrementCounter(`${name}_total`, { ...labels, success: String(success) });
  }
}

export function timeSync<T>(
  name: string,
  operation: () => T,
  labels: Record<string, string> = {}
): { result: T; durationMs: number } {
  const start = performance.now();
  let success = true;
  
  try {
    const result = operation();
    return { result, durationMs: performance.now() - start };
  } catch (error) {
    success = false;
    throw error;
  } finally {
    const durationMs = performance.now() - start;
    recordHistogram(`${name}_duration_ms`, durationMs, { ...labels, success: String(success) });
    incrementCounter(`${name}_total`, { ...labels, success: String(success) });
  }
}

// ============================================================================
// REQUEST METRICS
// ============================================================================

export function recordRequestMetrics(
  service: string,
  path: string,
  method: string,
  statusCode: number,
  durationMs: number
): void {
  const labels = { service, path, method, status: String(statusCode) };
  
  incrementCounter("http_requests_total", labels);
  recordHistogram("http_request_duration_ms", durationMs, labels);
  
  if (statusCode >= 400) {
    incrementCounter("http_errors_total", labels);
  }
}

export function recordDatabaseMetrics(
  operation: string,
  table: string,
  durationMs: number,
  success: boolean
): void {
  const labels = { operation, table, success: String(success) };
  
  incrementCounter("db_queries_total", labels);
  recordHistogram("db_query_duration_ms", durationMs, labels);
}

export function recordApiMetrics(
  api: string,
  operation: string,
  statusCode: number,
  durationMs: number
): void {
  const labels = { api, operation, status: String(statusCode) };
  
  incrementCounter("external_api_requests_total", labels);
  recordHistogram("external_api_duration_ms", durationMs, labels);
}

// ============================================================================
// METRICS EXPORT
// ============================================================================

export function getAllMetrics(): {
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<string, ReturnType<typeof getHistogramStats>>;
} {
  const counterObj: Record<string, number> = {};
  const gaugeObj: Record<string, number> = {};
  const histogramObj: Record<string, ReturnType<typeof getHistogramStats>> = {};
  
  counters.forEach((value, key) => {
    counterObj[key] = value;
  });
  
  gauges.forEach((value, key) => {
    gaugeObj[key] = value;
  });
  
  histograms.forEach((_, key) => {
    const [name, ...labelParts] = key.split("|");
    histogramObj[key] = getHistogramStats(name, parseLabels(labelParts.join("|")));
  });
  
  return { counters: counterObj, gauges: gaugeObj, histograms: histogramObj };
}

export function resetMetrics(): void {
  counters.clear();
  gauges.clear();
  histograms.clear();
}

export function exportPrometheusMetrics(): string {
  const lines: string[] = [];
  
  counters.forEach((value, key) => {
    const { name, labels } = parseKey(key);
    const labelStr = formatLabels(labels);
    lines.push(`${name}${labelStr} ${value}`);
  });
  
  gauges.forEach((value, key) => {
    const { name, labels } = parseKey(key);
    const labelStr = formatLabels(labels);
    lines.push(`${name}${labelStr} ${value}`);
  });
  
  histograms.forEach((_, key) => {
    const { name, labels } = parseKey(key);
    const stats = getHistogramStats(name, labels);
    const labelStr = formatLabels(labels);
    
    lines.push(`${name}_count${labelStr} ${stats.count}`);
    lines.push(`${name}_sum${labelStr} ${stats.sum}`);
    lines.push(`${name}_avg${labelStr} ${stats.avg}`);
    lines.push(`${name}_p50${labelStr} ${stats.p50}`);
    lines.push(`${name}_p90${labelStr} ${stats.p90}`);
    lines.push(`${name}_p99${labelStr} ${stats.p99}`);
  });
  
  return lines.join("\n");
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function buildKey(name: string, labels: Record<string, string>): string {
  const labelStr = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v}"`)
    .join(",");
  return labelStr ? `${name}|${labelStr}` : name;
}

function parseKey(key: string): { name: string; labels: Record<string, string> } {
  const [name, labelStr] = key.split("|");
  return { name, labels: parseLabels(labelStr || "") };
}

function parseLabels(labelStr: string): Record<string, string> {
  if (!labelStr) return {};
  
  const labels: Record<string, string> = {};
  const matches = labelStr.matchAll(/(\w+)="([^"]+)"/g);
  
  for (const match of matches) {
    labels[match[1]] = match[2];
  }
  
  return labels;
}

function formatLabels(labels: Record<string, string>): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return "";
  
  return "{" + entries.map(([k, v]) => `${k}="${v}"`).join(",") + "}";
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}
