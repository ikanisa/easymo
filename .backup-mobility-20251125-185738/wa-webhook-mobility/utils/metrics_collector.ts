/**
 * Enhanced Metrics Collection for wa-webhook
 * 
 * Provides in-memory metrics aggregation with periodic flushing.
 * Complements existing observability without replacing it.
 * 
 * @see docs/GROUND_RULES.md
 */

interface MetricValue {
  count: number;
  sum: number;
  min: number;
  max: number;
  dimensions: Record<string, string>;
}

interface HistogramBucket {
  le: number; // less than or equal
  count: number;
}

type IntervalHandle = number & { unref?: () => void };

class MetricsCollector {
  private counters: Map<string, Map<string, number>> = new Map();
  private gauges: Map<string, Map<string, number>> = new Map();
  private histograms: Map<string, Map<string, number[]>> = new Map();
  private flushInterval?: IntervalHandle;
  private readonly FLUSH_INTERVAL_MS = 30000; // 30 seconds

  constructor() {
    this.startFlushing();
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, value: number = 1, dimensions: Record<string, string | number> = {}): void {
    const key = this.getDimensionKey(dimensions);
    
    if (!this.counters.has(name)) {
      this.counters.set(name, new Map());
    }
    
    const counter = this.counters.get(name)!;
    counter.set(key, (counter.get(key) || 0) + value);
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number, dimensions: Record<string, string | number> = {}): void {
    const key = this.getDimensionKey(dimensions);
    
    if (!this.gauges.has(name)) {
      this.gauges.set(name, new Map());
    }
    
    this.gauges.get(name)!.set(key, value);
  }

  /**
   * Record a histogram value (for durations, sizes, etc.)
   */
  recordHistogram(name: string, value: number, dimensions: Record<string, string | number> = {}): void {
    const key = this.getDimensionKey(dimensions);
    
    if (!this.histograms.has(name)) {
      this.histograms.set(name, new Map());
    }
    
    const histogram = this.histograms.get(name)!;
    if (!histogram.has(key)) {
      histogram.set(key, []);
    }
    
    histogram.get(key)!.push(value);
  }

  /**
   * Get dimension key for grouping
   */
  private getDimensionKey(dimensions: Record<string, string | number>): string {
    if (Object.keys(dimensions).length === 0) return "default";
    
    const sorted = Object.entries(dimensions)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(",");
    
    return sorted;
  }

  /**
   * Parse dimension key back to object
   */
  private parseDimensionKey(key: string): Record<string, string> {
    if (key === "default") return {};
    
    const dimensions: Record<string, string> = {};
    key.split(",").forEach(pair => {
      const [k, v] = pair.split(":");
      if (k && v) dimensions[k] = v;
    });
    
    return dimensions;
  }

  /**
   * Calculate histogram statistics
   */
  private calculateHistogramStats(values: number[]): {
    count: number;
    sum: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    if (values.length === 0) {
      return { count: 0, sum: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const min = sorted[0];
    const max = sorted[count - 1];
    const avg = sum / count;

    const percentile = (p: number) => {
      const index = Math.ceil((p / 100) * count) - 1;
      return sorted[Math.max(0, index)];
    };

    return {
      count,
      sum,
      min,
      max,
      avg: Math.round(avg * 100) / 100,
      p50: percentile(50),
      p95: percentile(95),
      p99: percentile(99),
    };
  }

  /**
   * Flush metrics to logs
   */
  flush(): void {
    const timestamp = new Date().toISOString();

    // Flush counters
    for (const [name, dimensionMap] of this.counters.entries()) {
      for (const [dimKey, value] of dimensionMap.entries()) {
        const dimensions = this.parseDimensionKey(dimKey);
        console.log(JSON.stringify({
          event: "METRIC_COUNTER",
          timestamp,
          metric: name,
          value,
          dimensions,
        }));
      }
    }

    // Flush gauges
    for (const [name, dimensionMap] of this.gauges.entries()) {
      for (const [dimKey, value] of dimensionMap.entries()) {
        const dimensions = this.parseDimensionKey(dimKey);
        console.log(JSON.stringify({
          event: "METRIC_GAUGE",
          timestamp,
          metric: name,
          value,
          dimensions,
        }));
      }
    }

    // Flush histograms
    for (const [name, dimensionMap] of this.histograms.entries()) {
      for (const [dimKey, values] of dimensionMap.entries()) {
        const dimensions = this.parseDimensionKey(dimKey);
        const stats = this.calculateHistogramStats(values);
        console.log(JSON.stringify({
          event: "METRIC_HISTOGRAM",
          timestamp,
          metric: name,
          ...stats,
          dimensions,
        }));
      }
    }

    // Clear all metrics after flush
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  /**
   * Get metrics in Prometheus format (for /metrics endpoint)
   */
  getPrometheusMetrics(): string {
    const lines: string[] = [];

    // Export counters
    for (const [name, dimensionMap] of this.counters.entries()) {
      lines.push(`# TYPE ${name} counter`);
      for (const [dimKey, value] of dimensionMap.entries()) {
        const dimensions = this.parseDimensionKey(dimKey);
        const labels = Object.entries(dimensions)
          .map(([k, v]) => `${k}="${v}"`)
          .join(",");
        const labelStr = labels ? `{${labels}}` : "";
        lines.push(`${name}${labelStr} ${value}`);
      }
    }

    // Export gauges
    for (const [name, dimensionMap] of this.gauges.entries()) {
      lines.push(`# TYPE ${name} gauge`);
      for (const [dimKey, value] of dimensionMap.entries()) {
        const dimensions = this.parseDimensionKey(dimKey);
        const labels = Object.entries(dimensions)
          .map(([k, v]) => `${k}="${v}"`)
          .join(",");
        const labelStr = labels ? `{${labels}}` : "";
        lines.push(`${name}${labelStr} ${value}`);
      }
    }

    // Export histograms
    for (const [name, dimensionMap] of this.histograms.entries()) {
      lines.push(`# TYPE ${name} histogram`);
      for (const [dimKey, values] of dimensionMap.entries()) {
        const dimensions = this.parseDimensionKey(dimKey);
        const stats = this.calculateHistogramStats(values);
        const labels = Object.entries(dimensions)
          .map(([k, v]) => `${k}="${v}"`)
          .join(",");
        const labelStr = labels ? `{${labels}}` : "";
        
        lines.push(`${name}_count${labelStr} ${stats.count}`);
        lines.push(`${name}_sum${labelStr} ${stats.sum}`);
        lines.push(`${name}_min${labelStr} ${stats.min}`);
        lines.push(`${name}_max${labelStr} ${stats.max}`);
        lines.push(`${name}_avg${labelStr} ${stats.avg}`);
      }
    }

    return lines.join("\n") + "\n";
  }

  /**
   * Get summary statistics
   */
  getStats(): any {
    return {
      counters: this.counters.size,
      gauges: this.gauges.size,
      histograms: this.histograms.size,
    };
  }

  /**
   * Start periodic flushing
   */
  private startFlushing(): void {
    const handle = setInterval(() => {
      this.flush();
    }, this.FLUSH_INTERVAL_MS) as IntervalHandle;
    handle.unref?.();
    this.flushInterval = handle;
  }

  /**
   * Stop flushing and cleanup
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush(); // Final flush
  }
}

// Singleton instance
let metricsInstance: MetricsCollector | null = null;

export function getMetricsCollector(): MetricsCollector {
  if (!metricsInstance) {
    metricsInstance = new MetricsCollector();
  }
  return metricsInstance;
}

export function incrementMetric(
  name: string,
  value: number = 1,
  dimensions: Record<string, string | number> = {}
): void {
  getMetricsCollector().incrementCounter(name, value, dimensions);
}

export function setMetricGauge(
  name: string,
  value: number,
  dimensions: Record<string, string | number> = {}
): void {
  getMetricsCollector().setGauge(name, value, dimensions);
}

export function recordMetricHistogram(
  name: string,
  value: number,
  dimensions: Record<string, string | number> = {}
): void {
  getMetricsCollector().recordHistogram(name, value, dimensions);
}

export function getMetricsStats() {
  return getMetricsCollector().getStats();
}

export function flushMetrics(): void {
  getMetricsCollector().flush();
}

export function getPrometheusMetrics(): string {
  return getMetricsCollector().getPrometheusMetrics();
}

// For testing
export function __resetMetrics(): void {
  metricsInstance?.destroy();
  metricsInstance = null;
}

// Cleanup on unload
globalThis.addEventListener("unload", () => {
  metricsInstance?.destroy();
});
